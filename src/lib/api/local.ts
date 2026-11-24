// MODO LOCAL: todo se guarda en este navegador (IndexedDB). Sirve para presentar sin internet
// y para probar. Las pestañas abiertas en el mismo navegador se sincronizan en vivo.

import { get, set } from 'idb-keyval';
import type { Api, SolicitudFirma } from './tipos';
import type { Adenda, Alerta, Config, Contrato, EventoTiempoReal, Obra, PerfilTrabajador, Snapshot, SolicitudMarca, Trabajador } from '../types';
import { CONFIG_INICIAL } from '../types';
import { generarDemo, EMPRESAS_INICIALES } from '../seed';
import { fechaLima } from '../tiempo';
import { codigoAlta, sha256, uuid } from '../util';
import { procesarFirma, procesarMarca, type BaseLocal } from './logica';

const CLAVE = 'reap-asistencia-db-v1';
const canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('reap-asistencia') : null;
const oyentes = new Set<(e: EventoTiempoReal) => void>();

let cache: BaseLocal | null = null;
let cola: Promise<unknown> = Promise.resolve();

function vacia(): BaseLocal {
  return {
    version: 1, demo_fecha: null, config: { ...CONFIG_INICIAL }, empresas: EMPRESAS_INICIALES.map((e) => ({ ...e })),
    obras: [], trabajadores: [], contratos: [], adendas: [], marcaciones: [], alertas: [], aprobaciones: [],
  };
}

/** Inserta/renueva los datos de demostración sin tocar lo creado por el usuario. */
function aplicarDemo(db: BaseLocal) {
  const d = generarDemo();
  for (const e of d.empresas) if (!db.empresas.some((x) => x.id === e.id)) db.empresas.push({ ...e });
  for (const o of d.obras) if (!db.obras.some((x) => x.id === o.id)) db.obras.push(o);
  for (const t of d.trabajadores) if (!db.trabajadores.some((x) => x.id === t.id)) db.trabajadores.push(t);
  const sinDemo = <T extends { demo?: boolean }>(xs: T[]) => xs.filter((x) => !x.demo);
  db.contratos = [...sinDemo(db.contratos), ...d.contratos.filter((c) => db.trabajadores.some((t) => t.id === c.trabajador_id))];
  db.adendas = [...sinDemo(db.adendas), ...d.adendas];
  db.marcaciones = [...sinDemo(db.marcaciones), ...d.marcaciones];
  db.alertas = [...sinDemo(db.alertas), ...d.alertas];
  db.aprobaciones = [...sinDemo(db.aprobaciones), ...d.aprobaciones];
  db.demo_fecha = fechaLima();
}

async function cargar(): Promise<BaseLocal> {
  if (cache) return cache;
  let db = (await get(CLAVE)) as BaseLocal | undefined;
  if (!db) db = vacia();
  db.config = { ...CONFIG_INICIAL, ...db.config };
  if (db.demo_fecha !== fechaLima()) {
    aplicarDemo(db);
    await set(CLAVE, db);
  }
  cache = db;
  return db;
}

/** Ejecuta cambios en serie y los guarda. */
function mutar<T>(fn: (db: BaseLocal) => T | Promise<T>, evento?: EventoTiempoReal | ((r: T) => EventoTiempoReal | EventoTiempoReal[] | null)): Promise<T> {
  const p = cola.then(async () => {
    const db = await cargar();
    const r = await fn(db);
    await set(CLAVE, db);
    const evs = typeof evento === 'function' ? evento(r) : evento;
    for (const ev of Array.isArray(evs) ? evs : evs ? [evs] : []) emitir(ev);
    return r;
  });
  cola = p.catch(() => {});
  return p;
}

function emitir(e: EventoTiempoReal) {
  for (const o of oyentes) o(e);
  canal?.postMessage(e);
}

canal?.addEventListener('message', async (ev) => {
  cache = null; // otra pestaña cambió los datos
  for (const o of oyentes) o(ev.data as EventoTiempoReal);
});

const sinBiometria = (t: Trabajador): Trabajador => ({ ...t, embedding: undefined });
const copia = <T,>(x: T): T => structuredClone(x);

export function crearApiLocal(): Api {
  return {
    modo: 'local',

    async empresas() { return copia((await cargar()).empresas); },

    async perfil(empresaId, dni) {
      const db = await cargar();
      const t = db.trabajadores.find((x) => x.empresa_id === empresaId && x.dni === dni.trim() && x.activo);
      if (!t) return null;
      const hoy = fechaLima();
      const pareja = t.pareja_id ? db.trabajadores.find((x) => x.id === t.pareja_id) : null;
      const perfil: PerfilTrabajador = {
        trabajador: (({ embedding, codigo_alta, ...r }) => r)(t),
        empresa: db.empresas.find((e) => e.id === t.empresa_id)!,
        obra: db.obras.find((o) => o.id === t.obra_id) || null,
        pareja: pareja ? { nombres: pareja.nombres, apellidos: pareja.apellidos } : null,
        contrato: db.contratos.find((c) => c.trabajador_id === t.id) || null,
        adendas: db.adendas.filter((a) => a.trabajador_id === t.id),
        marcas_hoy: db.marcaciones.filter((m) => m.trabajador_id === t.id && fechaLima(m.hora_marca) === hoy),
        config: db.config,
      };
      perfil.trabajador.tiene_rostro = !!t.embedding;
      return copia(perfil);
    },

    enrolar(trabajadorId, codigo, captura, dispositivoId) {
      return mutar((db) => {
        const t = db.trabajadores.find((x) => x.id === trabajadorId);
        if (!t) return { ok: false, mensaje: 'Trabajador no encontrado.' };
        if (t.embedding) return { ok: false, mensaje: 'Este trabajador ya tiene un rostro registrado. Pide a RR. HH. que lo reinicie.' };
        if (t.codigo_alta !== codigo.trim()) return { ok: false, mensaje: 'Código de alta incorrecto. Pídelo a RR. HH.' };
        const ahora = new Date().toISOString();
        t.embedding = captura.embedding;
        t.tiene_rostro = true;
        t.foto_enrolamiento = captura.foto;
        t.dispositivo_id = dispositivoId;
        t.enrolado_at = ahora;
        t.consentimiento_at = ahora;
        t.demo = false; // ya no se pisa al renovar la demo
        return { ok: true, mensaje: 'Rostro registrado correctamente.' };
      }, { tipo: 'trabajador' });
    },

    marcar(req: SolicitudMarca) {
      return mutar((db) => procesarMarca(db, req), (r) => [
        ...r.alertas.map((a) => ({ tipo: 'alerta' as const, dato: a })),
        ...(r.res.marcacion ? [{ tipo: 'marcacion' as const, dato: r.res.marcacion }] : []),
      ]).then((r) => r.res);
    },

    async historial(trabajadorId, desde) {
      const db = await cargar();
      return copia({
        marcas: db.marcaciones.filter((m) => m.trabajador_id === trabajadorId && fechaLima(m.hora_marca) >= desde),
        aprobaciones: db.aprobaciones.filter((a) => a.trabajador_id === trabajadorId && a.fecha >= desde),
      });
    },

    verAdenda(trabajadorId, adendaId) {
      return mutar((db) => {
        const a = db.adendas.find((x) => x.id === adendaId && x.trabajador_id === trabajadorId);
        if (a && !a.vista_at) a.vista_at = new Date().toISOString();
      }, { tipo: 'adenda' });
    },

    async firmarAdenda(req: SolicitudFirma) {
      const codigo = (await sha256(`${req.adenda_id}|${req.trabajador_id}|${Date.now()}|${req.captura.embedding.slice(0, 8).join(',')}`)).slice(0, 16);
      const r = await mutar((db) => procesarFirma(db, req, codigo), (r) => [
        ...(r.alerta ? [{ tipo: 'alerta' as const, dato: r.alerta }] : []),
        ...(r.adenda ? [{ tipo: 'adenda' as const, dato: r.adenda }] : []),
      ]);
      return { ok: r.ok, mensaje: r.mensaje, adenda: r.adenda ? copia(r.adenda) : undefined };
    },

    async pendientesSinConexion() { return 0; },
    async enviarPendientes() { return 0; },

    // ---------- Admin
    async sesionAdmin() {
      try { return localStorage.getItem('reap-admin-local') ? { email: 'demo@reap' } : null; } catch { return null; }
    },
    async ingresarAdmin() {
      try { localStorage.setItem('reap-admin-local', '1'); } catch { /* sin almacenamiento */ }
      return { ok: true, mensaje: 'Bienvenido' };
    },
    async salirAdmin() { try { localStorage.removeItem('reap-admin-local'); } catch { /* */ } },

    async snapshot(desde) {
      const db = await cargar();
      const s: Snapshot = {
        empresas: db.empresas, obras: db.obras, trabajadores: db.trabajadores.map(sinBiometria), contratos: db.contratos,
        adendas: db.adendas, marcaciones: db.marcaciones.filter((m) => fechaLima(m.hora_marca) >= desde),
        alertas: db.alertas.filter((a) => fechaLima(a.fecha) >= desde), aprobaciones: db.aprobaciones, config: db.config,
      };
      return copia(s);
    },

    guardarEmpresa(e) {
      return mutar((db) => {
        const i = db.empresas.findIndex((x) => x.id === e.id);
        if (i >= 0) db.empresas[i] = { ...e }; else db.empresas.push({ ...e });
      }, { tipo: 'recarga' });
    },

    guardarObra(o: Obra) {
      return mutar((db) => {
        const obra = { ...o, id: o.id || uuid() };
        const i = db.obras.findIndex((x) => x.id === obra.id);
        if (i >= 0) db.obras[i] = obra; else db.obras.push(obra);
        return copia(obra);
      }, { tipo: 'recarga' });
    },

    guardarTrabajador(t: Trabajador, contrato?: Contrato) {
      return mutar((db) => {
        const i = db.trabajadores.findIndex((x) => x.id === t.id);
        let res: Trabajador;
        if (i >= 0) {
          const prev = db.trabajadores[i];
          res = { ...prev, ...t, embedding: prev.embedding, tiene_rostro: prev.tiene_rostro, foto_enrolamiento: prev.foto_enrolamiento, codigo_alta: prev.codigo_alta };
          db.trabajadores[i] = res;
        } else {
          res = { ...t, id: t.id || uuid(), codigo_alta: codigoAlta(), tiene_rostro: false, embedding: null, foto_enrolamiento: null, enrolado_at: null, consentimiento_at: null, dispositivo_id: null, demo: false };
          db.trabajadores.push(res);
        }
        // Pareja recíproca
        if (res.pareja_id) {
          const p = db.trabajadores.find((x) => x.id === res.pareja_id);
          if (p) p.pareja_id = res.id;
        }
        if (contrato) {
          const c = { ...contrato, id: contrato.id || uuid(), trabajador_id: res.id, empresa_id: res.empresa_id, demo: false };
          const j = db.contratos.findIndex((x) => x.id === c.id);
          if (j >= 0) db.contratos[j] = c; else db.contratos.push(c);
        }
        return sinBiometria(res);
      }, { tipo: 'trabajador' });
    },

    reiniciarRostro(id) {
      return mutar((db) => {
        const t = db.trabajadores.find((x) => x.id === id);
        if (!t) return '';
        t.embedding = null; t.tiene_rostro = false; t.foto_enrolamiento = null; t.enrolado_at = null; t.dispositivo_id = null;
        t.codigo_alta = codigoAlta();
        return t.codigo_alta;
      }, { tipo: 'trabajador' });
    },

    guardarConfig(c: Config) { return mutar((db) => { db.config = { ...c }; }, { tipo: 'recarga' }); },

    enviarAdenda(contratoId, nuevaFechaFin) {
      return mutar((db) => {
        const c = db.contratos.find((x) => x.id === contratoId);
        if (!c) throw new Error('Contrato no encontrado');
        const prev = db.adendas.filter((a) => a.contrato_id === contratoId);
        const a: Adenda = {
          id: uuid(), contrato_id: c.id, trabajador_id: c.trabajador_id, empresa_id: c.empresa_id, numero: prev.length + 1,
          fecha_fin_anterior: c.fecha_fin || fechaLima(), nueva_fecha_fin: nuevaFechaFin, enviada_at: new Date().toISOString(),
          vista_at: null, estado: 'enviada', firmada_at: null, firma_foto: null, firma_similitud: null, firma_lat: null,
          firma_lng: null, firma_dispositivo: null, codigo_verificacion: null,
        };
        db.adendas.push(a);
        return copia(a);
      }, (a) => ({ tipo: 'adenda', dato: a }));
    },

    resolverAlerta(id, estado: Alerta['estado']) {
      return mutar((db) => { const a = db.alertas.find((x) => x.id === id); if (a) a.estado = estado; }, { tipo: 'recarga' });
    },

    resolverHorasExtra(items, estado) {
      return mutar((db) => {
        const ahora = new Date().toISOString();
        for (const it of items) {
          const a = db.aprobaciones.find((x) => x.trabajador_id === it.trabajador_id && x.fecha === it.fecha);
          if (a) { a.estado = estado; a.resuelto_at = ahora; a.demo = false; }
          else db.aprobaciones.push({ id: uuid(), trabajador_id: it.trabajador_id, fecha: it.fecha, estado, resuelto_at: ahora });
        }
      }, { tipo: 'recarga' });
    },

    cargarDemo() { return mutar((db) => { aplicarDemo(db); }, { tipo: 'recarga' }); },

    async urlFoto(ruta) { return ruta; },

    suscribir(cb) { oyentes.add(cb); return () => { oyentes.delete(cb); }; },
  };
}
