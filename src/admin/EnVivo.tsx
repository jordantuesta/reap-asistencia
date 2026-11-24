import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, CalendarClock, ChevronRight, Clock4, HardHat, ScanFace, ShieldAlert, Timer, UserCheck, UserX } from 'lucide-react';
import type { Marcacion, Trabajador } from '../lib/types';
import { NOMBRE_ALERTA, NOMBRE_MARCA } from '../lib/types';
import { pagoExtra } from '../lib/horas';
import { fechaCorta, fechaLarga, fechaLima, hace, hhmmAMin, horaLima, horasCortas, lunesDe, mayus, minutosDelDia, nombreDiaCorto, sumarDias } from '../lib/tiempo';
import { nombreCorto, pct, soles } from '../lib/util';
import { Avatar, FotoEvidencia, Insignia, Tarjeta } from '../ui/comunes';
import Mapa from '../ui/Mapa';
import { COLOR_25, COLOR_35, diasRestantes, useDatos } from './datos';
import { Titulo } from './Panel';

type Estado = 'sin_marcar' | 'en_obra' | 'refrigerio' | 'salio';

function estadoDe(marcas: Marcacion[]): Estado {
  const tipos = new Set(marcas.map((m) => m.tipo));
  if (tipos.has('salida')) return 'salio';
  if (tipos.has('salida_refrigerio') && !tipos.has('regreso_refrigerio')) return 'refrigerio';
  if (tipos.has('entrada')) return 'en_obra';
  return 'sin_marcar';
}

const ESTADO: Record<Estado, { t: string; tono: 'verde' | 'ambar' | 'gris' | 'azul' }> = {
  en_obra: { t: 'En obra', tono: 'verde' },
  refrigerio: { t: 'Refrigerio', tono: 'ambar' },
  salio: { t: 'Salió', tono: 'azul' },
  sin_marcar: { t: 'Sin marcar', tono: 'gris' },
};

export default function EnVivo() {
  const d = useDatos();
  const { s, hoy } = d;
  const ahoraMin = minutosDelDia(new Date());

  const hoyPorTrab = useMemo(() => {
    const m = new Map<string, Marcacion[]>();
    for (const x of d.marcaciones) if (fechaLima(x.hora_marca) === hoy) { const a = m.get(x.trabajador_id) || []; a.push(x); m.set(x.trabajador_id, a); }
    for (const a of m.values()) a.sort((p, q) => p.hora_marca.localeCompare(q.hora_marca));
    return m;
  }, [d.marcaciones, hoy]);

  const estados = new Map<string, Estado>(d.trabajadores.map((t) => [t.id, estadoDe(hoyPorTrab.get(t.id) || [])]));
  const presentes = [...estados.values()].filter((e) => e === 'en_obra' || e === 'refrigerio').length;
  const yaPasoEntrada = ahoraMin > hhmmAMin(s.config.hora_entrada) + s.config.tolerancia_min;
  const laborable = s.config.dias_laborables.includes(new Date(hoy + 'T12:00:00Z').getUTCDay());
  const sinMarcar = d.trabajadores.filter((t) => estados.get(t.id) === 'sin_marcar');
  const diasHoy = d.dias.filter((x) => x.fecha === hoy);
  const tardanzas = diasHoy.filter((x) => x.tardanzaMin > 0);
  const alertasHoy = d.alertas.filter((a) => fechaLima(a.fecha) === hoy);
  const alertasNuevas = d.alertas.filter((a) => a.estado === 'nueva');
  const lunes = lunesDe(hoy);
  const semana = d.dias.filter((x) => x.fecha >= lunes);
  const extraSemana = semana.reduce((a, x) => a + x.extraMin, 0);
  const pagoSemana = semana.reduce((a, x) => a + pagoExtra(d.trab.get(x.trabajador_id)?.remuneracion || 0, x.extra25Min, x.extra35Min), 0);
  const porVencer = d.contratos.filter((c) => { const r = diasRestantes(c, hoy); return r != null && r >= 0 && r <= 15; });

  // Riesgo legal: contrato vencido y el trabajador sigue marcando
  const riesgos = d.contratos
    .filter((c) => c.fecha_fin && c.fecha_fin < hoy)
    .map((c) => ({ c, t: d.trab.get(c.trabajador_id), marcasDespues: d.marcaciones.filter((m) => m.trabajador_id === c.trabajador_id && fechaLima(m.hora_marca) > c.fecha_fin!).length }))
    .filter((x) => x.t && x.marcasDespues > 0 && !s.adendas.some((a) => a.contrato_id === x.c.id && a.estado === 'enviada'));

  const actividad = [
    ...d.marcaciones.filter((m) => fechaLima(m.hora_marca) === hoy).map((m) => ({ k: 'm' as const, fecha: m.hora_marca, m })),
    ...alertasHoy.map((a) => ({ k: 'a' as const, fecha: a.fecha, a })),
  ].sort((p, q) => q.fecha.localeCompare(p.fecha)).slice(0, 12);

  const obrasActivas = s.obras.filter((o) => o.activa && d.trabajadores.some((t) => t.obra_id === o.id));

  const puntos = [
    ...d.trabajadores.flatMap((t) => {
      const ms = hoyPorTrab.get(t.id);
      const ult = ms?.[ms.length - 1];
      if (!ult || ult.lat_captura == null || estados.get(t.id) === 'salio') return [];
      return [{ lat: ult.lat_captura, lng: ult.lng_captura!, color: ult.dentro_obra === false ? '#D9860B' : '#059669', etiqueta: `${nombreCorto(t)} · ${NOMBRE_MARCA[ult.tipo]} ${horaLima(ult.hora_marca)}` }];
    }),
    ...alertasHoy.filter((a) => a.lat != null).map((a) => ({ lat: a.lat!, lng: a.lng!, color: '#DC2626', radio: 8, etiqueta: `Alerta: ${NOMBRE_ALERTA[a.tipo]}` })),
  ];

  return (
    <div>
      <Titulo titulo="Asistencia en vivo" sub={<>{mayus(fechaLarga(hoy))} · actualizado {hace(new Date(d.actualizado).toISOString())}</>} />

      {riesgos.map(({ c, t }) => (
        <div key={c.id} className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
          <AlertTriangle className="shrink-0 text-red-600" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold text-red-800">Contrato vencido: {nombreCorto(t!)} sigue marcando asistencia</p>
            <p className="text-red-700/90">Venció el {fechaCorta(c.fecha_fin!)}. Si sigue trabajando sin renovación, el contrato puede considerarse indefinido (art. 77 LPCL).</p>
          </div>
          <Link to="/admin/contratos" className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500">Enviar adenda</Link>
        </div>
      ))}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icono={<UserCheck size={18} />} titulo="En obra ahora" valor={`${presentes}`} sub={`de ${d.trabajadores.length} trabajadores`} />
        <Kpi icono={<Timer size={18} />} titulo="Tardanzas hoy" valor={`${tardanzas.length}`} sub={tardanzas.length ? `${tardanzas.reduce((a, x) => a + x.tardanzaMin, 0)} min en total` : 'Todos puntuales'} tono={tardanzas.length ? 'ambar' : undefined} />
        <Kpi icono={<UserX size={18} />} titulo="Sin marcar" valor={laborable && yaPasoEntrada ? `${sinMarcar.length}` : '—'} sub={laborable ? (yaPasoEntrada ? 'tras la hora de entrada' : `entrada a las ${s.config.hora_entrada}`) : 'día no laborable'} />
        <Kpi icono={<ShieldAlert size={18} />} titulo="Alertas por revisar" valor={`${alertasNuevas.length}`} sub={`${alertasHoy.length} hoy`} tono={alertasNuevas.length ? 'rojo' : undefined} enlace="/admin/alertas" />
        <Kpi icono={<Clock4 size={18} />} titulo="Horas extra semana" valor={horasCortas(extraSemana)} sub={`≈ ${soles(pagoSemana)}`} enlace="/admin/horas-extra" />
        <Kpi icono={<CalendarClock size={18} />} titulo="Contratos ≤ 15 días" valor={`${porVencer.length}`} sub="por renovar" tono={porVencer.length ? 'ambar' : undefined} enlace="/admin/contratos" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Obras */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-acero-500"><HardHat size={16} /> Obras hoy</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {obrasActivas.map((o) => {
                const ts = d.trabajadores.filter((t) => t.obra_id === o.id);
                const pres = ts.filter((t) => ['en_obra', 'refrigerio'].includes(estados.get(t.id)!)).length;
                return (
                  <Tarjeta key={o.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-acero-900">{o.nombre}</p>
                        <p className="truncate text-xs text-acero-500">{o.distrito} · {o.cliente}</p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-acero-50 px-2 py-1 text-xs font-bold tabular text-acero-700">{pres}/{ts.length}</span>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {ts.map((t) => <FilaTrabajador key={t.id} t={t} estado={estados.get(t.id)!} marcas={hoyPorTrab.get(t.id) || []} color={d.emp.get(t.empresa_id)?.color} />)}
                    </ul>
                  </Tarjeta>
                );
              })}
            </div>
          </div>

          <GraficoExtras />

          <Tarjeta className="p-4">
            <h2 className="mb-3 text-sm font-bold text-acero-900">Mapa de hoy</h2>
            <Mapa obras={obrasActivas} puntos={puntos} alto={340} />
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-acero-600">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Última marca dentro de obra</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#D9860B' }} /> Fuera de obra</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-600" /> Alerta</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-acero-600" /> Radio de la obra</span>
            </div>
          </Tarjeta>
        </div>

        {/* Actividad */}
        <Tarjeta className="h-fit p-4 xl:sticky xl:top-20">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-acero-900"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span> Actividad de hoy</h2>
          {actividad.length === 0 && <p className="py-8 text-center text-sm text-acero-400">Aún no hay marcas hoy.</p>}
          <ul className="space-y-1">
            {actividad.map((x) => {
              if (x.k === 'a') {
                const t = d.trab.get(x.a.trabajador_id);
                return (
                  <li key={'a' + x.a.id}>
                    <Link to="/admin/alertas" className="flex gap-3 rounded-xl bg-red-50 p-2.5 ring-1 ring-red-100 hover:bg-red-100/60">
                      <FotoEvidencia ruta={x.a.foto} className="h-11 w-11 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-[13px] font-bold text-red-700"><BellRing size={13} /> {NOMBRE_ALERTA[x.a.tipo]}</p>
                        <p className="truncate text-xs text-red-700/80">{t ? nombreCorto(t) : ''} · {horaLima(x.a.fecha)}</p>
                      </div>
                    </Link>
                  </li>
                );
              }
              const t = d.trab.get(x.m.trabajador_id);
              return (
                <li key={x.m.id} className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-acero-50">
                  {x.m.foto ? <FotoEvidencia ruta={x.m.foto} className="h-11 w-11 shrink-0 rounded-full" /> : t && <Avatar nombres={t.nombres} apellidos={t.apellidos} size={44} color={d.emp.get(t.empresa_id)?.color} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-acero-900">{t ? nombreCorto(t) : '—'}</p>
                    <p className="truncate text-xs text-acero-500">{NOMBRE_MARCA[x.m.tipo]} · {d.obra.get(x.m.obra_id || '')?.nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold tabular text-acero-800">{horaLima(x.m.hora_marca)}</p>
                    {x.m.estado === 'observada' ? <Insignia tono="ambar">Observada</Insignia> : <span className="flex items-center justify-end gap-0.5 text-[11px] text-emerald-600"><ScanFace size={11} /> {pct(x.m.similitud)}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <Link to="/admin/marcaciones" className="mt-3 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-acero-600 hover:bg-acero-50">Ver todas las marcaciones <ChevronRight size={14} /></Link>
        </Tarjeta>
      </div>
    </div>
  );
}

function FilaTrabajador({ t, estado, marcas, color }: { t: Trabajador; estado: Estado; marcas: Marcacion[]; color?: string }) {
  const e = ESTADO[estado];
  const ult = marcas[marcas.length - 1];
  return (
    <li className="flex items-center gap-2.5">
      <Avatar nombres={t.nombres} apellidos={t.apellidos} foto={t.foto_enrolamiento} size={32} color={color} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-acero-800">{nombreCorto(t)}</p>
        <p className="truncate text-[11px] text-acero-500">{t.cargo}</p>
      </div>
      <div className="text-right">
        <Insignia tono={e.tono}>{e.t}</Insignia>
        {ult && <p className="mt-0.5 font-mono text-[11px] tabular text-acero-500">{horaLima(ult.hora_marca)}</p>}
      </div>
    </li>
  );
}

function Kpi({ icono, titulo, valor, sub, tono, enlace }: { icono: React.ReactNode; titulo: string; valor: string; sub: string; tono?: 'rojo' | 'ambar'; enlace?: string }) {
  const cuerpo = (
    <Tarjeta className={`h-full p-4 transition ${enlace ? 'hover:-translate-y-0.5' : ''} ${tono === 'rojo' ? 'ring-red-200' : tono === 'ambar' ? 'ring-ambar-200' : ''}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${tono === 'rojo' ? 'text-red-600' : tono === 'ambar' ? 'text-ambar-700' : 'text-acero-500'}`}>{icono} {titulo}</div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight tabular text-acero-900">{valor}</p>
      <p className="mt-0.5 truncate text-xs text-acero-500">{sub}</p>
    </Tarjeta>
  );
  return enlace ? <Link to={enlace}>{cuerpo}</Link> : cuerpo;
}

function GraficoExtras() {
  const d = useDatos();
  const [hover, setHover] = useState<number | null>(null);
  const fechas: string[] = [];
  for (let i = 20; i >= 0 && fechas.length < 14; i--) {
    const f = sumarDias(d.hoy, -i);
    if (new Date(f + 'T12:00:00Z').getUTCDay() !== 0) fechas.push(f);
  }
  const datos = fechas.slice(-14).map((f) => {
    const ds = d.dias.filter((x) => x.fecha === f);
    return { f, h25: ds.reduce((a, x) => a + x.extra25Min, 0) / 60, h35: ds.reduce((a, x) => a + x.extra35Min, 0) / 60, n: ds.filter((x) => x.extraMin > 0).length };
  });
  const max = Math.max(4, ...datos.map((x) => x.h25 + x.h35));
  const paso = max > 20 ? 10 : max > 8 ? 4 : 2;
  const tope = Math.ceil(max / paso) * paso;
  const W = 720, H = 220, mL = 34, mB = 26, mT = 10;
  const ancho = (W - mL) / datos.length;
  const barra = Math.min(24, ancho * 0.55);
  const y = (h: number) => mT + (H - mT - mB) * (1 - h / tope);
  const total25 = datos.reduce((a, x) => a + x.h25, 0);
  const total35 = datos.reduce((a, x) => a + x.h35, 0);

  return (
    <Tarjeta className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-acero-900">Horas extra por día</h2>
          <p className="text-xs text-acero-500">Últimos 14 días laborables · todas las obras del filtro</p>
        </div>
        <div className="flex gap-4 text-xs text-acero-700">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_25 }} /> Sobretasa 25 % <b className="tabular">{total25.toFixed(1)} h</b></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_35 }} /> Sobretasa 35 % <b className="tabular">{total35.toFixed(1)} h</b></span>
        </div>
      </div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Horas extra por día">
          {Array.from({ length: tope / paso + 1 }).map((_, i) => {
            const v = i * paso;
            return (
              <g key={i}>
                <line x1={mL} x2={W} y1={y(v)} y2={y(v)} stroke="#E6ECF2" strokeWidth={1} />
                <text x={mL - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="#64748B">{v} h</text>
              </g>
            );
          })}
          {datos.map((x, i) => {
            const cx = mL + ancho * i + ancho / 2;
            const y25 = y(x.h25);
            const y35 = y(x.h25 + x.h35);
            const gap = x.h35 > 0 && x.h25 > 0 ? 2 : 0;
            return (
              <g key={x.f} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={mL + ancho * i} y={mT} width={ancho} height={H - mT - mB} fill={hover === i ? '#F1F5F9' : 'transparent'} />
                {x.h25 > 0 && <Columna x={cx - barra / 2} y={y25} w={barra} h={y(0) - y25} color={COLOR_25} redondeada={x.h35 === 0} />}
                {x.h35 > 0 && <Columna x={cx - barra / 2} y={y35} w={barra} h={y25 - y35 - gap} color={COLOR_35} redondeada />}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill={x.f === d.hoy ? '#0F2A44' : '#64748B'} fontWeight={x.f === d.hoy ? 700 : 400}>{nombreDiaCorto(x.f)} {x.f.slice(8)}</text>
              </g>
            );
          })}
        </svg>
        {hover != null && (
          <div className="pointer-events-none absolute top-0 rounded-xl bg-acero-950 px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((mL + ancho * hover + ancho / 2) / W) * 100}%`, transform: 'translateX(-50%)' }}>
            <p className="font-bold">{fechaCorta(datos[hover].f)}</p>
            <p className="tabular">25 %: {datos[hover].h25.toFixed(1)} h · 35 %: {datos[hover].h35.toFixed(1)} h</p>
            <p className="text-white/60">{datos[hover].n} trabajador(es) con extras</p>
          </div>
        )}
      </div>
    </Tarjeta>
  );
}

function Columna({ x, y, w, h, color, redondeada }: { x: number; y: number; w: number; h: number; color: string; redondeada: boolean }) {
  if (h <= 0) return null;
  const r = Math.min(4, h / 2, w / 2);
  if (!redondeada) return <rect x={x} y={y} width={w} height={h} fill={color} />;
  return <path d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`} fill={color} />;
}
