// MODO EN VIVO con Supabase (PostgreSQL en la nube).
// - El celular nunca recibe plantillas biométricas: la comparación facial se hace dentro de la base
//   de datos (función app_marcar), igual que la hora oficial y la geocerca.
// - Si no hay señal, la marca se guarda en el celular y se envía sola al volver la conexión.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { del, get, set } from 'idb-keyval';
import type { Api, SolicitudFirma } from './tipos';
import type {
  Adenda, AprobacionHE, Alerta, Config, Contrato, Empresa, EventoTiempoReal, Marcacion, Obra, PerfilTrabajador,
  ResultadoMarca, Snapshot, SolicitudMarca, Trabajador,
} from '../types';
import { CONFIG_INICIAL } from '../types';
import { generarDemo } from '../seed';
import { fechaLima, isoDesdeLima } from '../tiempo';
import { codigoAlta, uuid } from '../util';
import { obtenerUbicacion } from '../geo';

const COLUMNAS_TRABAJADOR =
  'id,empresa_id,dni,nombres,apellidos,cargo,telefono,obra_id,pareja_id,remuneracion,codigo_alta,enrolado_at,tiene_rostro,foto_enrolamiento,dispositivo_id,consentimiento_at,activo,demo';

const CLAVE_COLA = 'reap-cola-marcas';

function dataUrlABlob(dataUrl: string): Blob {
  const [cab, b64] = dataUrl.split(',');
  const mime = cab.match(/data:(.*?);/)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = String((e as { message?: string })?.message || e || '');
  return /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(msg);
}

interface MarcaEnCola { id: string; req: SolicitudMarca; }

export function crearApiSupabase(url: string, clave: string): Api {
  const sb: SupabaseClient = createClient(url, clave, { auth: { persistSession: true, storageKey: 'reap-sesion-admin' } });
  const cacheUrls = new Map<string, { url: string; vence: number }>();

  async function subirFoto(carpeta: string, dataUrl: string): Promise<string> {
    const ruta = `${carpeta}/${fechaLima()}/${uuid()}.jpg`;
    const { error } = await sb.storage.from('evidencias').upload(ruta, dataUrlABlob(dataUrl), { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    return ruta;
  }

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    return data as T;
  }

  /** Trae todas las filas (Supabase devuelve máximo 1000 por consulta). */
  async function todo<T>(tabla: string, columnas = '*', filtro?: (q: any) => any): Promise<T[]> {
    const out: T[] = [];
    for (let desde = 0; ; desde += 1000) {
      let q = sb.from(tabla).select(columnas).range(desde, desde + 999);
      if (filtro) q = filtro(q);
      const { data, error } = await q;
      if (error) throw error;
      out.push(...((data || []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }

  async function leerCola(): Promise<MarcaEnCola[]> { return ((await get(CLAVE_COLA)) as MarcaEnCola[] | undefined) || []; }
  async function guardarCola(c: MarcaEnCola[]) { if (c.length) await set(CLAVE_COLA, c); else await del(CLAVE_COLA); }

  async function enviarMarca(req: SolicitudMarca): Promise<ResultadoMarca> {
    const foto = req.captura.foto.startsWith('data:') ? await subirFoto('marcas', req.captura.foto) : req.captura.foto;
    const r = await rpc<ResultadoMarca>('app_marcar', {
      p_trabajador: req.trabajador_id,
      p_embedding: req.captura.embedding,
      p_real: req.captura.real,
      p_vida: req.captura.vida,
      p_reto: req.captura.reto_superado,
      p_foto: foto,
      p_dispositivo: req.dispositivo_id,
      p_hora_dispositivo: req.hora_dispositivo,
      p_lat_cap: req.ubic_captura?.lat ?? null,
      p_lng_cap: req.ubic_captura?.lng ?? null,
      p_prec_cap: req.ubic_captura?.precision ?? null,
      p_lat_sub: req.ubic_subida?.lat ?? null,
      p_lng_sub: req.ubic_subida?.lng ?? null,
      p_prec_sub: req.ubic_subida?.precision ?? null,
      p_sin_conexion: req.sin_conexion,
    });
    return r;
  }

  const api: Api = {
    modo: 'supabase',

    async empresas() {
      const { data, error } = await sb.from('empresas').select('*').order('nombre');
      if (error) throw error;
      return data as Empresa[];
    },

    async perfil(empresaId, dni) {
      return (await rpc<PerfilTrabajador | null>('app_perfil', { p_empresa: empresaId, p_dni: dni.trim() })) || null;
    },

    async enrolar(trabajadorId, codigo, captura, dispositivoId) {
      const foto = await subirFoto('rostros', captura.foto);
      return rpc('app_enrolar', { p_trabajador: trabajadorId, p_codigo: codigo.trim(), p_embedding: captura.embedding, p_foto: foto, p_dispositivo: dispositivoId });
    },

    async marcar(req) {
      try {
        return await enviarMarca(req);
      } catch (e) {
        if (!esErrorDeRed(e)) throw e;
        const c = await leerCola();
        c.push({ id: uuid(), req: { ...req, sin_conexion: true } });
        await guardarCola(c);
        return { ok: false, motivo: 'en_cola', mensaje: 'Sin conexión: tu marca quedó guardada en el celular y se enviará sola cuando vuelva la señal.' };
      }
    },

    async pendientesSinConexion() { return (await leerCola()).length; },

    async enviarPendientes() {
      const c = await leerCola();
      if (!c.length || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
      let enviados = 0;
      let ubicSubida = null;
      try { ubicSubida = await obtenerUbicacion({ maxEdadMs: 60000, timeoutMs: 8000 }); } catch { /* se envía sin ubicación de subida */ }
      const resto: MarcaEnCola[] = [];
      for (const item of c) {
        try {
          await enviarMarca({ ...item.req, ubic_subida: ubicSubida, sin_conexion: true });
          enviados++;
        } catch (e) {
          if (esErrorDeRed(e)) resto.push(item); // se reintenta luego; otros errores se descartan
        }
      }
      await guardarCola(resto);
      return enviados;
    },

    async historial(trabajadorId, desde) {
      return rpc('app_historial', { p_trabajador: trabajadorId, p_desde: desde });
    },

    async verAdenda(trabajadorId, adendaId) {
      await rpc('app_ver_adenda', { p_trabajador: trabajadorId, p_adenda: adendaId });
    },

    async firmarAdenda(req: SolicitudFirma) {
      const foto = await subirFoto('firmas', req.captura.foto);
      return rpc('app_firmar_adenda', {
        p_trabajador: req.trabajador_id, p_adenda: req.adenda_id, p_embedding: req.captura.embedding,
        p_real: req.captura.real, p_vida: req.captura.vida, p_reto: req.captura.reto_superado, p_foto: foto,
        p_lat: req.ubicacion?.lat ?? null, p_lng: req.ubicacion?.lng ?? null, p_dispositivo: req.dispositivo_id,
      });
    },

    // ---------- Admin
    async sesionAdmin() {
      const { data } = await sb.auth.getSession();
      return data.session ? { email: data.session.user.email || '' } : null;
    },
    async ingresarAdmin(email, clave) {
      const { error } = await sb.auth.signInWithPassword({ email, password: clave });
      return error ? { ok: false, mensaje: 'Correo o contraseña incorrectos.' } : { ok: true, mensaje: 'Bienvenido' };
    },
    async salirAdmin() { await sb.auth.signOut(); },

    async snapshot(desde) {
      const desdeIso = isoDesdeLima(desde, '00:00');
      const [empresas, obras, trabajadores, contratos, adendas, marcaciones, alertas, aprobaciones, cfg] = await Promise.all([
        todo<Empresa>('empresas'),
        todo<Obra>('obras'),
        todo<Trabajador>('trabajadores', COLUMNAS_TRABAJADOR),
        todo<Contrato>('contratos'),
        todo<Adenda>('adendas'),
        todo<Marcacion>('marcaciones', '*', (q) => q.gte('hora_marca', desdeIso).order('hora_marca')),
        todo<Alerta>('alertas', '*', (q) => q.gte('fecha', desdeIso).order('fecha')),
        todo<AprobacionHE>('aprobaciones'),
        sb.from('configuracion').select('datos').eq('id', 1).maybeSingle(),
      ]);
      const config: Config = { ...CONFIG_INICIAL, ...((cfg.data?.datos as Partial<Config>) || {}) };
      const s: Snapshot = { empresas, obras, trabajadores, contratos, adendas, marcaciones, alertas, aprobaciones, config };
      return s;
    },

    async guardarEmpresa(e) {
      const { error } = await sb.from('empresas').upsert(e);
      if (error) throw error;
    },

    async guardarObra(o) {
      const obra = { ...o, id: o.id || uuid() };
      const { error } = await sb.from('obras').upsert(obra);
      if (error) throw error;
      return obra;
    },

    async guardarTrabajador(t, contrato) {
      const { embedding, ...resto } = t;
      const nuevo = !t.id;
      const fila = { ...resto, id: t.id || uuid(), demo: nuevo ? false : t.demo };
      if (nuevo) Object.assign(fila, { codigo_alta: codigoAlta(), foto_enrolamiento: null, enrolado_at: null, consentimiento_at: null, dispositivo_id: null });
      const { tiene_rostro, ...sinGenerada } = fila as typeof fila & { tiene_rostro?: boolean };
      const { data, error } = await sb.from('trabajadores').upsert(sinGenerada).select(COLUMNAS_TRABAJADOR).single();
      if (error) throw error;
      if (fila.pareja_id) await sb.from('trabajadores').update({ pareja_id: fila.id }).eq('id', fila.pareja_id);
      if (contrato) {
        const c = { ...contrato, id: contrato.id || uuid(), trabajador_id: fila.id, empresa_id: fila.empresa_id, demo: false };
        const r = await sb.from('contratos').upsert(c);
        if (r.error) throw r.error;
      }
      return data as unknown as Trabajador;
    },

    async reiniciarRostro(id) {
      const codigo = codigoAlta();
      const { error } = await sb.from('trabajadores').update({
        embedding: null, foto_enrolamiento: null, enrolado_at: null, dispositivo_id: null, codigo_alta: codigo,
      }).eq('id', id);
      if (error) throw error;
      return codigo;
    },

    async guardarConfig(c) {
      const { error } = await sb.from('configuracion').upsert({ id: 1, datos: c });
      if (error) throw error;
    },

    async enviarAdenda(contratoId, nuevaFechaFin) {
      const { data: c, error: e1 } = await sb.from('contratos').select('*').eq('id', contratoId).single();
      if (e1) throw e1;
      const { count } = await sb.from('adendas').select('id', { count: 'exact', head: true }).eq('contrato_id', contratoId);
      const a: Adenda = {
        id: uuid(), contrato_id: c.id, trabajador_id: c.trabajador_id, empresa_id: c.empresa_id, numero: (count || 0) + 1,
        fecha_fin_anterior: c.fecha_fin || fechaLima(), nueva_fecha_fin: nuevaFechaFin, enviada_at: new Date().toISOString(),
        vista_at: null, estado: 'enviada', firmada_at: null, firma_foto: null, firma_similitud: null, firma_lat: null,
        firma_lng: null, firma_dispositivo: null, codigo_verificacion: null, demo: false,
      };
      const { error } = await sb.from('adendas').insert(a);
      if (error) throw error;
      return a;
    },

    async resolverAlerta(id, estado) {
      const { error } = await sb.from('alertas').update({ estado }).eq('id', id);
      if (error) throw error;
    },

    async resolverHorasExtra(items, estado) {
      const ahora = new Date().toISOString();
      const filas = items.map((i) => ({ trabajador_id: i.trabajador_id, fecha: i.fecha, estado, resuelto_at: ahora, demo: false }));
      const { error } = await sb.from('aprobaciones').upsert(filas, { onConflict: 'trabajador_id,fecha' });
      if (error) throw error;
    },

    async cargarDemo() {
      const d = generarDemo();
      const chk = (r: { error: unknown }) => { if (r.error) throw r.error; };
      chk(await sb.from('empresas').upsert(d.empresas, { ignoreDuplicates: true }));
      chk(await sb.from('obras').upsert(d.obras, { ignoreDuplicates: true }));
      chk(await sb.from('trabajadores').upsert(d.trabajadores.map(({ embedding, tiene_rostro, ...r }) => r), { ignoreDuplicates: true }));
      for (const tabla of ['adendas', 'alertas', 'marcaciones', 'aprobaciones', 'contratos']) {
        chk(await sb.from(tabla).delete().eq('demo', true));
      }
      const lotes = async (tabla: string, filas: object[]) => {
        for (let i = 0; i < filas.length; i += 500) chk(await sb.from(tabla).insert(filas.slice(i, i + 500)));
      };
      // No duplicar contratos de quienes ya tienen uno editado/creado en vivo
      const { data: contratosReales } = await sb.from('contratos').select('id,trabajador_id');
      const conContrato = new Set((contratosReales || []).map((x: { trabajador_id: string }) => x.trabajador_id));
      await lotes('contratos', d.contratos.filter((c) => !conContrato.has(c.trabajador_id)));
      const idsContrato = new Set([...(contratosReales || []).map((x: { id: string }) => x.id), ...d.contratos.map((c) => c.id)]);
      await lotes('adendas', d.adendas.filter((a) => idsContrato.has(a.contrato_id)));
      await lotes('marcaciones', d.marcaciones);
      await lotes('alertas', d.alertas);
      await lotes('aprobaciones', d.aprobaciones);
    },

    async urlFoto(ruta) {
      if (!ruta) return null;
      if (ruta.startsWith('data:') || ruta.startsWith('http')) return ruta;
      const c = cacheUrls.get(ruta);
      if (c && c.vence > Date.now()) return c.url;
      const { data } = await sb.storage.from('evidencias').createSignedUrl(ruta, 3600);
      if (!data?.signedUrl) return null;
      cacheUrls.set(ruta, { url: data.signedUrl, vence: Date.now() + 3500 * 1000 });
      return data.signedUrl;
    },

    suscribir(cb: (e: EventoTiempoReal) => void) {
      const ch = sb.channel('reap-panel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'marcaciones' }, (p) => cb({ tipo: 'marcacion', dato: p.new }))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas' }, (p) => cb({ tipo: 'alerta', dato: p.new }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'adendas' }, (p) => cb({ tipo: 'adenda', dato: p.new }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trabajadores' }, () => cb({ tipo: 'trabajador' }))
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };
  return api;
}
