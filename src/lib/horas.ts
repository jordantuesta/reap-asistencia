// Cálculo de horas trabajadas, tardanzas y horas extra (normativa peruana).
// - Jornada ordinaria: config.jornada_min (8 h) en días laborables.
// - Refrigerio: no forma parte de la jornada; mínimo legal 45 min.
// - Horas extra (D.S. 007-2002-TR): sobretasa mínima 25 % las 2 primeras horas, 35 % desde la tercera.
// - Días no laborables trabajados: todo el tiempo se registra como extra (se marca para revisión).

import type { AprobacionHE, Config, Marcacion, TipoMarca, Trabajador } from './types';
import { diaSemana, fechaLima, hhmmAMin, minutosDelDia } from './tiempo';

export interface DiaResumen {
  trabajador_id: string;
  fecha: string;
  marcas: Partial<Record<TipoMarca, Marcacion>>;
  laborable: boolean;
  completa: boolean;
  trabajadoMin: number;
  refrigerioMin: number;
  tardanzaMin: number;
  extraMin: number;
  extra25Min: number;
  extra35Min: number;
  observaciones: string[];
}

export function agruparPorDia(marcas: Marcacion[]): Map<string, Marcacion[]> {
  const m = new Map<string, Marcacion[]>();
  for (const x of marcas) {
    const k = x.trabajador_id + '|' + fechaLima(x.hora_marca);
    const arr = m.get(k);
    if (arr) arr.push(x); else m.set(k, [x]);
  }
  return m;
}

export function resumirDia(trabajadorId: string, fecha: string, marcasDia: Marcacion[], cfg: Config, esHoy = false): DiaResumen {
  const marcas: Partial<Record<TipoMarca, Marcacion>> = {};
  for (const m of [...marcasDia].sort((a, b) => a.hora_marca.localeCompare(b.hora_marca))) {
    if (!marcas[m.tipo]) marcas[m.tipo] = m;
  }
  const laborable = cfg.dias_laborables.includes(diaSemana(fecha));
  const obs: string[] = [];
  const min = (t: TipoMarca) => (marcas[t] ? minutosDelDia(marcas[t]!.hora_marca) : null);
  const ent = min('entrada');
  const sRef = min('salida_refrigerio');
  const rRef = min('regreso_refrigerio');
  const sal = min('salida');

  let refrigerio = 0;
  if (sRef != null && rRef != null) {
    refrigerio = Math.max(0, rRef - sRef);
    if (refrigerio < 45) obs.push('Refrigerio menor a 45 min');
    else if (refrigerio > cfg.refrigerio_min + 10) obs.push(`Refrigerio excedido (${Math.round(refrigerio)} min)`);
  } else if (ent != null && sal != null) {
    refrigerio = cfg.refrigerio_min;
    if (!esHoy) obs.push('Refrigerio sin marcar (se descuenta el estándar)');
  }

  let trabajado = 0;
  if (ent != null && sal != null) trabajado = Math.max(0, sal - ent - refrigerio);
  const completa = ent != null && sal != null;
  if (ent != null && sal == null && !esHoy) obs.push('Falta marcar salida');

  let tardanza = 0;
  if (ent != null && laborable) {
    const tarde = ent - hhmmAMin(cfg.hora_entrada);
    if (tarde > cfg.tolerancia_min) tardanza = Math.round(tarde);
  }

  const jornada = laborable ? cfg.jornada_min : 0;
  let extra = completa ? Math.max(0, trabajado - jornada) : 0;
  if (extra < cfg.extra_minimo_min) extra = 0;
  extra = Math.floor(extra);
  if (!laborable && completa && trabajado > 0) obs.push('Trabajó en día no laborable');
  const extra25 = Math.min(extra, 120);
  const extra35 = Math.max(0, extra - 120);

  for (const m of Object.values(marcas)) {
    if (m?.estado === 'observada') {
      for (const o of m.observaciones) if (!obs.includes(o)) obs.push(o);
    }
  }

  return {
    trabajador_id: trabajadorId,
    fecha,
    marcas,
    laborable,
    completa,
    trabajadoMin: Math.round(trabajado),
    refrigerioMin: Math.round(refrigerio),
    tardanzaMin: tardanza,
    extraMin: extra,
    extra25Min: extra25,
    extra35Min: extra35,
    observaciones: obs,
  };
}

/** Resúmenes diarios para un conjunto de marcaciones. */
export function resumenes(marcas: Marcacion[], cfg: Config, hoy = fechaLima()): DiaResumen[] {
  const out: DiaResumen[] = [];
  for (const [k, arr] of agruparPorDia(marcas)) {
    const [tid, fecha] = k.split('|');
    out.push(resumirDia(tid, fecha, arr, cfg, fecha === hoy));
  }
  return out.sort((a, b) => (a.fecha === b.fecha ? a.trabajador_id.localeCompare(b.trabajador_id) : b.fecha.localeCompare(a.fecha)));
}

export function valorHora(remuneracionMensual: number): number {
  return remuneracionMensual / 30 / 8;
}

export function pagoExtra(remuneracion: number, extra25Min: number, extra35Min: number): number {
  const vh = valorHora(remuneracion);
  return vh * 1.25 * (extra25Min / 60) + vh * 1.35 * (extra35Min / 60);
}

export type EstadoHE = 'pendiente' | 'aprobada' | 'rechazada';

export function estadoHE(aprobaciones: AprobacionHE[], trabajadorId: string, fecha: string): EstadoHE {
  const a = aprobaciones.find((x) => x.trabajador_id === trabajadorId && x.fecha === fecha);
  return a ? a.estado : 'pendiente';
}

export interface TotalesTrabajador {
  trabajador: Trabajador;
  dias: number;
  trabajadoMin: number;
  tardanzaMin: number;
  tardanzas: number;
  extra25Min: number;
  extra35Min: number;
  extraAprobada25: number;
  extraAprobada35: number;
  extraPendienteMin: number;
  pagoAprobado: number;
}

export function totalesPorTrabajador(
  trabajadores: Trabajador[],
  dias: DiaResumen[],
  aprobaciones: AprobacionHE[],
): TotalesTrabajador[] {
  return trabajadores.map((t) => {
    const ds = dias.filter((d) => d.trabajador_id === t.id);
    let a25 = 0, a35 = 0, pend = 0;
    for (const d of ds) {
      if (d.extraMin <= 0) continue;
      const e = estadoHE(aprobaciones, t.id, d.fecha);
      if (e === 'aprobada') { a25 += d.extra25Min; a35 += d.extra35Min; }
      else if (e === 'pendiente') pend += d.extraMin;
    }
    return {
      trabajador: t,
      dias: ds.filter((d) => d.marcas.entrada).length,
      trabajadoMin: ds.reduce((s, d) => s + d.trabajadoMin, 0),
      tardanzaMin: ds.reduce((s, d) => s + d.tardanzaMin, 0),
      tardanzas: ds.filter((d) => d.tardanzaMin > 0).length,
      extra25Min: ds.reduce((s, d) => s + d.extra25Min, 0),
      extra35Min: ds.reduce((s, d) => s + d.extra35Min, 0),
      extraAprobada25: a25,
      extraAprobada35: a35,
      extraPendienteMin: pend,
      pagoAprobado: pagoExtra(t.remuneracion, a25, a35),
    };
  });
}

/** Siguiente marca que le toca al trabajador hoy. */
export function siguienteMarca(marcasHoy: Marcacion[]): TipoMarca | null {
  const hechas = new Set(marcasHoy.map((m) => m.tipo));
  for (const t of ['entrada', 'salida_refrigerio', 'regreso_refrigerio', 'salida'] as TipoMarca[]) {
    if (!hechas.has(t)) return t;
  }
  return null;
}
