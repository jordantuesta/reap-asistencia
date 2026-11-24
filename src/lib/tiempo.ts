// Utilidades de fecha/hora en hora de Lima (UTC-5, sin horario de verano).
const OFFSET_MS = -5 * 60 * 60 * 1000;

/** Date "desplazada" para leer sus campos UTC como si fueran hora de Lima. */
function lima(d: Date | string | number): Date {
  return new Date(new Date(d).getTime() + OFFSET_MS);
}

export function fechaLima(d: Date | string | number = new Date()): string {
  return lima(d).toISOString().slice(0, 10);
}

export function horaLima(d: Date | string | number): string {
  return lima(d).toISOString().slice(11, 16);
}

export function horaSegLima(d: Date | string | number): string {
  return lima(d).toISOString().slice(11, 19);
}

/** Minutos desde la medianoche (Lima). */
export function minutosDelDia(d: Date | string | number): number {
  const x = lima(d);
  return x.getUTCHours() * 60 + x.getUTCMinutes() + x.getUTCSeconds() / 60;
}

/** 0 = domingo ... 6 = sábado, en Lima. */
export function diaSemana(fecha: string): number {
  return new Date(fecha + 'T12:00:00Z').getUTCDay();
}

/** Convierte una fecha YYYY-MM-DD + "HH:mm" de Lima a ISO UTC. */
export function isoDesdeLima(fecha: string, hhmm: string, seg = 0): string {
  const [h, m] = hhmm.split(':').map(Number);
  const base = Date.parse(fecha + 'T00:00:00Z') - OFFSET_MS;
  return new Date(base + (h * 60 + m) * 60000 + seg * 1000).toISOString();
}

export function sumarDias(fecha: string, n: number): string {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta + 'T12:00:00Z') - Date.parse(desde + 'T12:00:00Z')) / 86400000);
}

/** Lunes de la semana de la fecha dada. */
export function lunesDe(fecha: string): string {
  const dow = diaSemana(fecha);
  return sumarDias(fecha, dow === 0 ? -6 : 1 - dow);
}

export function hhmmAMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minAHhmm(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** 135 -> "2 h 15 min" */
export function duracion(min: number): string {
  const m = Math.round(min);
  if (m <= 0) return '0 min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/** 135 -> "2.25" */
export function horasDecimal(min: number): string {
  return (Math.round((min / 60) * 100) / 100).toFixed(2);
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];

export function nombreDia(fecha: string): string { return DIAS[diaSemana(fecha)]; }
export function nombreDiaCorto(fecha: string): string { return DIAS_CORTOS[diaSemana(fecha)]; }
export function nombreMes(mes: number): string { return MESES[mes]; }

/** "lunes 23 de noviembre" */
export function fechaLarga(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${nombreDia(fecha)} ${d} de ${MESES[m - 1]}`;
}

/** "23 nov" */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

/** "23/11/2026" */
export function fechaNum(fecha: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y}`;
}

/** "23 de noviembre de 2026" */
export function fechaDocumento(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

export function saludo(d = new Date()): string {
  const m = minutosDelDia(d);
  if (m < 12 * 60) return 'Buenos días';
  if (m < 19 * 60) return 'Buenas tardes';
  return 'Buenas noches';
}

/** "hace 5 min", "hace 2 h", o la fecha. */
export function hace(iso: string, ahora = Date.now()): string {
  const s = Math.max(0, (ahora - Date.parse(iso)) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `${fechaCorta(fechaLima(iso))}, ${horaLima(iso)}`;
}
