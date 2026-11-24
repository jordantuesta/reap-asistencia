// Datos de DEMOSTRACIÓN (ficticios): 2 razones sociales, 6 obras en Lima, 22 trabajadores
// y ~3 semanas de marcaciones relativas a la fecha de hoy.
// Las personas, DNI y obras son inventados. Los nombres de las razones sociales se editan en Configuración.

import type { AprobacionHE, Adenda, Alerta, Contrato, Empresa, Marcacion, Obra, TipoMarca, Trabajador } from './types';
import { diaSemana, fechaLima, isoDesdeLima, lunesDe, minAHhmm, minutosDelDia, sumarDias } from './tiempo';
import { uuid } from './util';

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const pad = (n: number) => String(n).padStart(12, '0');
export const ID_EMPRESA_1 = 'a0000000-0000-4000-8000-' + pad(1);
export const ID_EMPRESA_2 = 'a0000000-0000-4000-8000-' + pad(2);
const idObra = (i: number) => 'c0000000-0000-4000-8000-' + pad(i + 1);
const idTrab = (i: number) => 'b0000000-0000-4000-8000-' + pad(i + 1);
const idContrato = (i: number) => 'd0000000-0000-4000-8000-' + pad(i + 1);

export const EMPRESAS_INICIALES: Empresa[] = [
  { id: ID_EMPRESA_1, nombre: 'Corporación REAP S.A.C.', nombre_corto: 'Corporación REAP', ruc: '', color: '#2A5580' },
  { id: ID_EMPRESA_2, nombre: 'REAP Servicios Técnicos S.A.C.', nombre_corto: 'REAP Servicios', ruc: '', color: '#D9860B' },
];

const OBRAS: Omit<Obra, 'id'>[] = [
  { nombre: 'Edificio Mirador Larco', cliente: 'Inmobiliaria Horizonte', direccion: 'Av. José Larco 1150', distrito: 'Miraflores', lat: -12.12655, lng: -77.03012, radio_m: 150, activa: true },
  { nombre: 'Torre Begonias 450', cliente: 'Grupo Inversiones Andinas', direccion: 'Calle Las Begonias 450', distrito: 'San Isidro', lat: -12.09512, lng: -77.02361, radio_m: 150, activa: true },
  { nombre: 'Residencial Parque Surco', cliente: 'Constructora Pacífico Sur', direccion: 'Av. Caminos del Inca 2300', distrito: 'Santiago de Surco', lat: -12.13862, lng: -76.99451, radio_m: 200, activa: true },
  { nombre: 'Centro Empresarial Javier Prado', cliente: 'Desarrolladora Lima Centro', direccion: 'Av. Javier Prado Este 2875', distrito: 'San Borja', lat: -12.08941, lng: -77.00183, radio_m: 150, activa: true },
  { nombre: 'Condominio Los Cedros', cliente: 'Inmobiliaria Valle Verde', direccion: 'Av. La Fontana 980', distrito: 'La Molina', lat: -12.08055, lng: -76.93812, radio_m: 200, activa: true },
  { nombre: 'Edificio Salaverry 2100', cliente: 'Edifica Perú Desarrollos', direccion: 'Av. Salaverry 2100', distrito: 'Jesús María', lat: -12.08493, lng: -77.05049, radio_m: 150, activa: true },
];

// [nombres, apellidos, cargo, empresa(0/1), obra, remuneración, índice de pareja]
const PERSONAS: [string, string, string, 0 | 1, number, number, number | null][] = [
  ['Carlos Alberto', 'Huamán Quispe', 'Técnico instalador', 0, 0, 3200, 1],
  ['Luis Fernando', 'Mamani Flores', 'Ayudante de instalación', 0, 0, 2000, 0],
  ['Jorge Luis', 'Ramírez Torres', 'Técnico instalador', 0, 1, 3300, 3],
  ['Miguel Ángel', 'Chávez Rojas', 'Ayudante de instalación', 0, 1, 1950, 2],
  ['Pedro Pablo', 'Vargas Mendoza', 'Técnico de ajuste', 0, 2, 3500, 5],
  ['Juan Carlos', 'Pérez Castillo', 'Ayudante de instalación', 0, 2, 2050, 4],
  ['Ricardo', 'Salazar Ríos', 'Técnico instalador', 0, 5, 3150, 7],
  ['Diego Armando', 'Gutiérrez Paredes', 'Ayudante de instalación', 0, 5, 1900, 6],
  ['Raúl Ernesto', 'Espinoza Vega', 'Técnico electromecánico', 0, 3, 3400, 9],
  ['Óscar', 'Cárdenas Silva', 'Ayudante de instalación', 0, 3, 1950, 8],
  ['Víctor Hugo', 'Alarcón Medina', 'Supervisor de obra', 0, 0, 5200, null],
  ['José Antonio', 'Condori Apaza', 'Técnico instalador', 1, 4, 3250, 12],
  ['Martín', 'Ruiz Huerta', 'Ayudante de instalación', 1, 4, 2000, 11],
  ['Fernando', 'León Cabrera', 'Técnico de mantenimiento', 1, 1, 3100, 14],
  ['Alberto', 'Quispe Ticona', 'Ayudante de instalación', 1, 1, 1950, 13],
  ['Héctor Manuel', 'Soto Villanueva', 'Técnico instalador', 1, 2, 3200, 16],
  ['Daniel', 'Navarro Pinto', 'Ayudante de instalación', 1, 2, 1900, 15],
  ['César Augusto', 'Rojas Calderón', 'Técnico electromecánico', 1, 5, 3350, 18],
  ['Iván', 'Toledo Arce', 'Ayudante de instalación', 1, 5, 1950, 17],
  ['Wilmer', 'Ccahuana Puma', 'Técnico instalador', 1, 3, 3150, 20],
  ['Kevin', 'Huanca Mayta', 'Ayudante de instalación', 1, 3, 1900, 19],
  ['Rosa María', 'Delgado Inga', 'Supervisora SSOMA', 1, 4, 4800, null],
];

// Días hasta el fin de contrato (relativo a hoy). null = plazo indeterminado.
const FIN_CONTRATO: (number | null)[] = [45, 6, 120, 4, 90, 11, -3, 28, 75, 13, null, 150, 19, 60, 24, 180, 82, 105, 30, 66, 140, null];

export interface DatosDemo {
  empresas: Empresa[];
  obras: Obra[];
  trabajadores: Trabajador[];
  contratos: Contrato[];
  adendas: Adenda[];
  marcaciones: Marcacion[];
  alertas: Alerta[];
  aprobaciones: AprobacionHE[];
}

function desplazar(lat: number, lng: number, metros: number, rnd: () => number) {
  const ang = rnd() * Math.PI * 2;
  const d = metros * Math.sqrt(rnd());
  return { lat: lat + (d * Math.cos(ang)) / 111320, lng: lng + (d * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180)) };
}

export function generarDemo(ahora = new Date()): DatosDemo {
  const hoy = fechaLima(ahora);
  const ahoraMin = minutosDelDia(ahora);
  const fijo = prng(20261127);
  const rnd = prng(hashStr(hoy));

  const obras: Obra[] = OBRAS.map((o, i) => ({ ...o, id: idObra(i), demo: true }));

  const trabajadores: Trabajador[] = PERSONAS.map(([nombres, apellidos, cargo, e, obra, rem, pareja], i) => ({
    id: idTrab(i),
    empresa_id: e === 0 ? ID_EMPRESA_1 : ID_EMPRESA_2,
    dni: String(Math.floor(40000000 + fijo() * 38000000)),
    nombres,
    apellidos,
    cargo,
    telefono: '9' + String(Math.floor(10000000 + fijo() * 89999999)),
    obra_id: idObra(obra),
    pareja_id: pareja == null ? null : idTrab(pareja),
    remuneracion: rem,
    codigo_alta: String(Math.floor(100000 + fijo() * 899999)),
    enrolado_at: isoDesdeLima(sumarDias(hoy, -40 - i), '09:15'),
    tiene_rostro: false,
    foto_enrolamiento: null,
    dispositivo_id: 'demo-' + (i + 1),
    consentimiento_at: isoDesdeLima(sumarDias(hoy, -40 - i), '09:12'),
    activo: true,
    demo: true,
    embedding: null,
  }));

  // ---- Contratos y adendas
  const contratos: Contrato[] = [];
  const adendas: Adenda[] = [];
  trabajadores.forEach((t, i) => {
    const fin = FIN_CONTRATO[i];
    const esSup = fin == null;
    const inicio = sumarDias(hoy, -(esSup ? 700 : 150 + Math.floor(fijo() * 200)));
    contratos.push({
      id: idContrato(i),
      trabajador_id: t.id,
      empresa_id: t.empresa_id,
      modalidad: esSup ? 'Plazo indeterminado' : i === 13 ? 'Inicio o incremento de actividad' : 'Obra determinada o servicio específico',
      cargo: t.cargo,
      fecha_inicio: inicio,
      fecha_fin: fin == null ? null : sumarDias(hoy, fin),
      remuneracion: t.remuneracion,
      demo: true,
    });
  });
  // Adenda ya firmada (Pedro Vargas): su contrato vencía hace 10 días y se renovó.
  adendas.push({
    id: uuid(), contrato_id: idContrato(4), trabajador_id: idTrab(4), empresa_id: ID_EMPRESA_1, numero: 1,
    fecha_fin_anterior: sumarDias(hoy, -10), nueva_fecha_fin: sumarDias(hoy, 90),
    enviada_at: isoDesdeLima(sumarDias(hoy, -16), '10:20'), vista_at: isoDesdeLima(sumarDias(hoy, -16), '12:41'),
    estado: 'firmada', firmada_at: isoDesdeLima(sumarDias(hoy, -15), '07:56'), firma_foto: null, firma_similitud: 0.91,
    firma_lat: OBRAS[2].lat + 0.0003, firma_lng: OBRAS[2].lng - 0.0002, firma_dispositivo: 'demo-5',
    codigo_verificacion: '7f3a9c21e4b05d88', demo: true,
  });
  // Adenda enviada y pendiente de firma (Luis Mamani, vence en 6 días).
  adendas.push({
    id: uuid(), contrato_id: idContrato(1), trabajador_id: idTrab(1), empresa_id: ID_EMPRESA_1, numero: 1,
    fecha_fin_anterior: sumarDias(hoy, 6), nueva_fecha_fin: sumarDias(hoy, 96),
    enviada_at: isoDesdeLima(sumarDias(hoy, -1), '16:05'), vista_at: null, estado: 'enviada', firmada_at: null,
    firma_foto: null, firma_similitud: null, firma_lat: null, firma_lng: null, firma_dispositivo: null,
    codigo_verificacion: null, demo: true,
  });

  // ---- Marcaciones
  const marcaciones: Marcacion[] = [];
  const alertas: Alerta[] = [];
  const aprobaciones: AprobacionHE[] = [];
  const lunesActual = lunesDe(hoy);

  const mk = (t: Trabajador, fecha: string, tipo: TipoMarca, minuto: number, extra: Partial<Marcacion> = {}): Marcacion => {
    const obra = obras.find((o) => o.id === t.obra_id)!;
    const p = desplazar(obra.lat, obra.lng, obra.radio_m * 0.55, rnd);
    const hora = isoDesdeLima(fecha, minAHhmm(Math.floor(minuto)), Math.floor(rnd() * 59));
    const servidor = new Date(Date.parse(hora) + 1500 + rnd() * 2500).toISOString();
    return {
      id: uuid(), trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra.id, tipo,
      hora_marca: hora, hora_servidor: servidor, hora_dispositivo: hora,
      lat_captura: p.lat, lng_captura: p.lng, prec_captura: Math.round(6 + rnd() * 20),
      lat_subida: p.lat + (rnd() - 0.5) * 0.00008, lng_subida: p.lng + (rnd() - 0.5) * 0.00008, prec_subida: Math.round(6 + rnd() * 20),
      distancia_m: null, dentro_obra: true,
      similitud: Math.round((0.7 + rnd() * 0.25) * 100) / 100, vida: Math.round((0.62 + rnd() * 0.36) * 100) / 100,
      foto: null, dispositivo_id: t.dispositivo_id, dispositivo_distinto: false, sin_conexion: false,
      estado: 'valida', observaciones: [], demo: true, ...extra,
    };
  };

  const fijarDistancia = (m: Marcacion) => {
    const obra = obras.find((o) => o.id === m.obra_id)!;
    const R = 6371000, rad = (x: number) => (x * Math.PI) / 180;
    const dLat = rad(m.lat_captura! - obra.lat), dLng = rad(m.lng_captura! - obra.lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(obra.lat)) * Math.cos(rad(m.lat_captura!)) * Math.sin(dLng / 2) ** 2;
    m.distancia_m = Math.round(2 * R * Math.asin(Math.sqrt(a)));
    m.dentro_obra = m.distancia_m <= obra.radio_m;
  };

  // Guion de incidentes (para que el panel cuente historias reales)
  type Incidente = { dia: number; t: number; tipo: 'suplantacion' | 'vida' | 'fuera' | 'dispositivo' | 'sin_conexion' };
  const incidentes: Incidente[] = [
    { dia: -1, t: 0, tipo: 'suplantacion' },   // Luis intentó marcar por Carlos; Carlos llegó tarde
    { dia: -3, t: 19, tipo: 'suplantacion' },
    { dia: -6, t: 7, tipo: 'vida' },
    { dia: -2, t: 15, tipo: 'fuera' },
    { dia: -4, t: 9, tipo: 'fuera' },
    { dia: -8, t: 13, tipo: 'dispositivo' },
    { dia: -2, t: 5, tipo: 'sin_conexion' },
    { dia: -5, t: 17, tipo: 'sin_conexion' },
    { dia: 0, t: 2, tipo: 'suplantacion' },    // hoy
  ];

  for (let d = -21; d <= 0; d++) {
    const fecha = sumarDias(hoy, d);
    const dow = diaSemana(fecha);
    if (dow === 0) continue;
    const esSabado = dow === 6;
    const esHoy = d === 0;

    // Agrupar por pareja: llegan juntos
    const vistos = new Set<number>();
    for (let i = 0; i < trabajadores.length; i++) {
      if (vistos.has(i)) continue;
      const parejaIdx = PERSONAS[i][6];
      const grupo = parejaIdx == null ? [i] : [i, parejaIdx];
      grupo.forEach((g) => vistos.add(g));
      const obraIdx = PERSONAS[i][4];
      if (esSabado && !(obraIdx === 0 || obraIdx === 4) ) continue;
      if (esSabado && d < -8) continue; // solo un sábado trabajado reciente

      const llegada = esSabado ? 470 + rnd() * 15 : rnd() < 0.13 ? 492 + rnd() * 30 : 465 + rnd() * 18;
      const haceExtra = !esSabado && rnd() < 0.32;
      const salida = esSabado ? 780 + rnd() * 10 : haceExtra ? 1050 + rnd() * 140 : 1020 + rnd() * 14;
      const sRef = 780 + rnd() * 6;
      const rRef = sRef + 55 + rnd() * (rnd() < 0.1 ? 25 : 8);

      for (const gi of grupo) {
        const t = trabajadores[gi];
        if (rnd() < 0.05 && !esHoy) continue; // falta
        const inc = incidentes.find((x) => x.dia === d && x.t === gi);
        let entrada = llegada + (rnd() - 0.5) * 4;
        if (inc?.tipo === 'suplantacion') entrada = 512 + rnd() * 25; // en realidad llegó tarde

        const marcasDia: [TipoMarca, number][] = esSabado
          ? [['entrada', entrada], ['salida', salida + (rnd() - 0.5) * 4]]
          : [['entrada', entrada], ['salida_refrigerio', sRef + rnd() * 2], ['regreso_refrigerio', rRef + rnd() * 2], ['salida', salida + (rnd() - 0.5) * 4]];

        const olvidoSalida = !esHoy && rnd() < 0.02;
        for (const [tipo, minuto] of marcasDia) {
          if (esHoy && minuto > ahoraMin) continue;
          if (tipo === 'salida' && olvidoSalida) continue;
          const m = mk(t, fecha, tipo, minuto);
          if (inc?.tipo === 'fuera' && tipo === 'entrada') {
            const lejos = desplazar(OBRAS[obraIdx].lat, OBRAS[obraIdx].lng, 0, rnd);
            m.lat_captura = lejos.lat + 0.019; m.lng_captura = lejos.lng - 0.011;
            m.lat_subida = m.lat_captura; m.lng_subida = m.lng_captura;
            m.estado = 'observada'; m.observaciones = ['Marcó fuera del radio de la obra'];
          }
          if (inc?.tipo === 'dispositivo' && tipo === 'entrada') {
            m.dispositivo_distinto = true; m.dispositivo_id = 'demo-otro'; m.estado = 'observada';
            m.observaciones = ['Marcó desde un celular distinto al registrado'];
          }
          if (inc?.tipo === 'sin_conexion' && tipo === 'regreso_refrigerio') {
            m.sin_conexion = true;
            m.hora_servidor = new Date(Date.parse(m.hora_marca) + (38 + rnd() * 30) * 60000).toISOString();
            const sub = desplazar(m.lat_captura!, m.lng_captura!, 0, rnd);
            m.lat_subida = sub.lat + 0.009; m.lng_subida = sub.lng + 0.012;
            m.estado = 'observada'; m.observaciones = ['Marcada sin conexión: se usó la hora del celular'];
          }
          fijarDistancia(m);
          if (m.dentro_obra === false && m.estado === 'valida') { m.estado = 'observada'; m.observaciones = ['Marcó fuera del radio de la obra']; }
          marcaciones.push(m);

          if (inc && tipo === 'entrada') {
            const obra = obras.find((o) => o.id === t.obra_id)!;
            if (inc.tipo === 'suplantacion') {
              const intento = isoDesdeLima(fecha, minAHhmm(465 + Math.floor(rnd() * 14)), Math.floor(rnd() * 59));
              if (!esHoy || minutosDelDia(intento) <= ahoraMin) {
                alertas.push({
                  id: uuid(), trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra.id, tipo: 'rostro_no_coincide', fecha: intento,
                  foto: null, lat: m.lat_captura, lng: m.lng_captura, similitud: Math.round((0.12 + rnd() * 0.22) * 100) / 100,
                  detalle: `Se intentó registrar la ENTRADA con un rostro distinto al registrado. El trabajador marcó con su propio rostro a las ${minAHhmm(Math.floor(entrada))}.`,
                  estado: esHoy ? 'nueva' : 'revisada', demo: true,
                });
              }
            } else if (inc.tipo === 'vida') {
              alertas.push({
                id: uuid(), trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra.id, tipo: 'prueba_vida',
                fecha: isoDesdeLima(fecha, minAHhmm(Math.floor(entrada) - 9)), foto: null, lat: m.lat_captura, lng: m.lng_captura, similitud: null,
                detalle: 'Se detectó una foto o pantalla frente a la cámara (no superó la prueba de vida).', estado: 'revisada', demo: true,
              });
            } else if (inc.tipo === 'fuera') {
              alertas.push({
                id: uuid(), trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra.id, tipo: 'fuera_de_obra', fecha: m.hora_marca,
                foto: null, lat: m.lat_captura, lng: m.lng_captura, similitud: m.similitud,
                detalle: `Marcó la ENTRADA a ${((m.distancia_m || 0) / 1000).toFixed(1)} km de ${obra.nombre}.`, estado: 'nueva', demo: true,
              });
            } else if (inc.tipo === 'dispositivo') {
              alertas.push({
                id: uuid(), trabajador_id: t.id, empresa_id: t.empresa_id, obra_id: obra.id, tipo: 'dispositivo_distinto', fecha: m.hora_marca,
                foto: null, lat: m.lat_captura, lng: m.lng_captura, similitud: m.similitud,
                detalle: 'Marcó desde un celular distinto al registrado. El rostro sí coincidió.', estado: 'revisada', demo: true,
              });
            }
          }
        }
      }
    }
  }

  // ---- Aprobaciones de horas extra (semanas anteriores ya resueltas; la semana actual queda pendiente)
  const fechasPasadas = new Set<string>();
  for (const m of marcaciones) {
    const f = fechaLima(m.hora_marca);
    if (f < lunesActual) fechasPasadas.add(m.trabajador_id + '|' + f);
  }
  for (const k of fechasPasadas) {
    const [tid, fecha] = k.split('|');
    aprobaciones.push({
      id: uuid(), trabajador_id: tid, fecha, estado: rnd() < 0.9 ? 'aprobada' : 'rechazada',
      resuelto_at: isoDesdeLima(sumarDias(lunesDe(fecha), 7), '09:30'), demo: true,
    });
  }

  return { empresas: EMPRESAS_INICIALES, obras, trabajadores, contratos, adendas, marcaciones, alertas, aprobaciones };
}
