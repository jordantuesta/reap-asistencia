// Reglas de negocio del "servidor" para el MODO LOCAL.
// En modo Supabase estas mismas reglas corren en la base de datos (supabase/schema.sql → app_marcar, etc.).

import type { Adenda, Alerta, Marcacion, ResultadoMarca, Snapshot, SolicitudMarca, TipoAlerta } from '../types';
import { NOMBRE_MARCA, marcaConArticulo } from '../types';
import { distanciaM } from '../geo';
import { siguienteMarca } from '../horas';
import { fechaLima, horaLima } from '../tiempo';
import { similitudFacial, uuid } from '../util';
import type { SolicitudFirma } from './tipos';

export interface BaseLocal extends Snapshot {
  version: number;
  demo_fecha: string | null;
}

function nuevaAlerta(db: BaseLocal, a: Omit<Alerta, 'id' | 'estado'>): Alerta {
  const al: Alerta = { ...a, id: uuid(), estado: 'nueva' };
  db.alertas.push(al);
  return al;
}

export function procesarMarca(db: BaseLocal, req: SolicitudMarca): { res: ResultadoMarca; alertas: Alerta[] } {
  const cfg = db.config;
  const t = db.trabajadores.find((x) => x.id === req.trabajador_id);
  const alertas: Alerta[] = [];
  if (!t || !t.activo) return { res: { ok: false, mensaje: 'Trabajador no encontrado o inactivo.' }, alertas };
  if (!t.embedding) return { res: { ok: false, motivo: 'sin_rostro', mensaje: 'Primero debes registrar tu rostro.' }, alertas };

  const ahora = new Date().toISOString();
  const horaMarca = req.sin_conexion ? req.hora_dispositivo : ahora;
  const obra = db.obras.find((o) => o.id === t.obra_id) || null;
  const u = req.ubic_captura;
  const dist = obra && u ? Math.round(distanciaM(u.lat, u.lng, obra.lat, obra.lng)) : null;
  const dentro = dist == null || !obra ? null : dist <= obra.radio_m;
  const base = {
    trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra?.id ?? null,
    fecha: horaMarca, foto: req.captura.foto, lat: u?.lat ?? null, lng: u?.lng ?? null,
  };

  // 1) Prueba de vida
  const vida = Math.min(req.captura.vida, req.captura.real);
  if (!req.captura.reto_superado || vida < cfg.umbral_vida) {
    alertas.push(nuevaAlerta(db, { ...base, tipo: 'prueba_vida', similitud: null, detalle: 'No superó la prueba de vida (posible foto o pantalla frente a la cámara).' }));
    return { res: { ok: false, motivo: 'prueba_vida', mensaje: 'No pudimos confirmar que eres una persona real frente a la cámara. Intenta de nuevo con buena luz.' }, alertas };
  }

  // 2) Reconocimiento facial 1:1
  const sim = similitudFacial(req.captura.embedding, t.embedding);
  const tipo = siguienteMarca(db.marcaciones.filter((m) => m.trabajador_id === t.id && fechaLima(m.hora_marca) === fechaLima(horaMarca)));
  if (sim < cfg.umbral_similitud) {
    alertas.push(nuevaAlerta(db, {
      ...base, tipo: 'rostro_no_coincide', similitud: sim,
      detalle: `Se intentó registrar ${tipo ? marcaConArticulo(tipo) : 'una marca'} con un rostro distinto al registrado (similitud ${Math.round(sim * 100)}%).`,
    }));
    return { res: { ok: false, motivo: 'rostro_no_coincide', similitud: sim, mensaje: 'El rostro no coincide con el trabajador registrado. Este intento quedó registrado.' }, alertas };
  }

  if (!tipo) return { res: { ok: false, motivo: 'jornada_completa', similitud: sim, mensaje: 'Ya registraste tus 4 marcas de hoy.' }, alertas };

  // 3) Geocerca
  if (dentro === false && cfg.bloquear_fuera_obra) {
    alertas.push(nuevaAlerta(db, { ...base, tipo: 'fuera_de_obra', similitud: sim, detalle: `Intentó marcar a ${dist} m de ${obra?.nombre}. Marca bloqueada.` }));
    return { res: { ok: false, motivo: 'fuera_de_obra', similitud: sim, distancia_m: dist, dentro_obra: false, mensaje: `Estás a ${dist} m de la obra. Debes estar dentro de ${obra?.radio_m} m para marcar.` }, alertas };
  }

  const obs: string[] = [];
  if (dentro === false) {
    obs.push('Marcó fuera del radio de la obra');
    alertas.push(nuevaAlerta(db, { ...base, tipo: 'fuera_de_obra', similitud: sim, detalle: `Marcó ${marcaConArticulo(tipo)} a ${dist! >= 1000 ? (dist! / 1000).toFixed(1) + ' km' : dist + ' m'} de ${obra?.nombre}.` }));
  }
  if (!u) obs.push('Sin ubicación al tomar la foto');
  const dispDistinto = !!t.dispositivo_id && t.dispositivo_id !== req.dispositivo_id;
  if (dispDistinto) {
    obs.push('Marcó desde un celular distinto al registrado');
    alertas.push(nuevaAlerta(db, { ...base, tipo: 'dispositivo_distinto', similitud: sim, detalle: 'Marcó desde un celular distinto al registrado. El rostro sí coincidió.' }));
  }
  if (req.sin_conexion) obs.push('Marcada sin conexión: se usó la hora del celular');

  const m: Marcacion = {
    id: uuid(), trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra?.id ?? null, tipo,
    hora_marca: horaMarca, hora_servidor: ahora, hora_dispositivo: req.hora_dispositivo,
    lat_captura: u?.lat ?? null, lng_captura: u?.lng ?? null, prec_captura: u?.precision ?? null,
    lat_subida: req.ubic_subida?.lat ?? u?.lat ?? null, lng_subida: req.ubic_subida?.lng ?? u?.lng ?? null, prec_subida: req.ubic_subida?.precision ?? u?.precision ?? null,
    distancia_m: dist, dentro_obra: dentro, similitud: sim, vida: Math.round(vida * 100) / 100,
    foto: req.captura.foto, dispositivo_id: req.dispositivo_id, dispositivo_distinto: dispDistinto,
    sin_conexion: req.sin_conexion, estado: obs.length ? 'observada' : 'valida', observaciones: obs,
  };
  db.marcaciones.push(m);
  return {
    res: { ok: true, marcacion: m, similitud: sim, distancia_m: dist, dentro_obra: dentro, mensaje: `${NOMBRE_MARCA[tipo]} registrada a las ${horaLima(horaMarca)}.` },
    alertas,
  };
}

export function procesarFirma(db: BaseLocal, req: SolicitudFirma, codigo: string): { ok: boolean; mensaje: string; adenda?: Adenda; alerta?: Alerta } {
  const t = db.trabajadores.find((x) => x.id === req.trabajador_id);
  const a = db.adendas.find((x) => x.id === req.adenda_id && x.trabajador_id === req.trabajador_id);
  if (!t || !a) return { ok: false, mensaje: 'Documento no encontrado.' };
  if (a.estado !== 'enviada') return { ok: false, mensaje: 'Este documento ya fue firmado.' };
  if (!t.embedding) return { ok: false, mensaje: 'Primero debes registrar tu rostro.' };
  const vida = Math.min(req.captura.vida, req.captura.real);
  if (!req.captura.reto_superado || vida < db.config.umbral_vida) return { ok: false, mensaje: 'No superó la prueba de vida.' };
  const sim = similitudFacial(req.captura.embedding, t.embedding);
  if (sim < db.config.umbral_similitud) {
    const alerta = nuevaAlerta(db, {
      trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: t.obra_id, tipo: 'rostro_no_coincide' as TipoAlerta,
      fecha: new Date().toISOString(), foto: req.captura.foto, lat: req.ubicacion?.lat ?? null, lng: req.ubicacion?.lng ?? null,
      similitud: sim, detalle: `Se intentó FIRMAR la adenda N.° ${a.numero} con un rostro distinto al registrado.`,
    });
    return { ok: false, mensaje: 'El rostro no coincide. No se firmó el documento.', alerta };
  }
  a.estado = 'firmada';
  a.firmada_at = new Date().toISOString();
  a.firma_foto = req.captura.foto;
  a.firma_similitud = sim;
  a.firma_lat = req.ubicacion?.lat ?? null;
  a.firma_lng = req.ubicacion?.lng ?? null;
  a.firma_dispositivo = req.dispositivo_id;
  a.codigo_verificacion = codigo;
  if (!a.vista_at) a.vista_at = a.firmada_at;
  const c = db.contratos.find((x) => x.id === a.contrato_id);
  if (c) c.fecha_fin = a.nueva_fecha_fin;
  return { ok: true, mensaje: 'Adenda firmada correctamente.', adenda: a };
}
