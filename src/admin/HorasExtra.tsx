import { useMemo, useState } from 'react';
import { Check, Clock4, X } from 'lucide-react';
import { api } from '../lib/api';
import { estadoHE, pagoExtra, valorHora } from '../lib/horas';
import { duracion, fechaCorta, horaLima, lunesDe, nombreDiaCorto, sumarDias } from '../lib/tiempo';
import { nombreCompleto, soles } from '../lib/util';
import { Avatar, Boton, Insignia, Tarjeta, Vacio, useAviso } from '../ui/comunes';
import { COLOR_25, COLOR_35, useDatos } from './datos';
import { Titulo } from './Panel';

type Periodo = 'semana' | 'anterior' | 'mes';

export default function HorasExtra() {
  const d = useDatos();
  const avisar = useAviso();
  const [periodo, setPeriodo] = useState<Periodo>('semana');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const lunes = lunesDe(d.hoy);
  const [desde, hasta] = periodo === 'semana' ? [lunes, d.hoy] : periodo === 'anterior' ? [sumarDias(lunes, -7), sumarDias(lunes, -1)] : [sumarDias(d.hoy, -30), d.hoy];

  const filas = useMemo(() => d.dias
    .filter((x) => x.extraMin > 0 && x.fecha >= desde && x.fecha <= hasta && d.trab.has(x.trabajador_id))
    .filter((x) => d.trabajadores.some((t) => t.id === x.trabajador_id))
    .map((x) => {
      const t = d.trab.get(x.trabajador_id)!;
      return { x, t, estado: estadoHE(d.s.aprobaciones, t.id, x.fecha), pago: pagoExtra(t.remuneracion, x.extra25Min, x.extra35Min), clave: t.id + '|' + x.fecha };
    })
    .sort((a, b) => (a.estado === 'pendiente' ? 0 : 1) - (b.estado === 'pendiente' ? 0 : 1) || b.x.fecha.localeCompare(a.x.fecha)), [d, desde, hasta]);

  const tot = (f: typeof filas) => f.reduce((a, r) => ({ min: a.min + r.x.extraMin, pago: a.pago + r.pago, e25: a.e25 + r.x.extra25Min, e35: a.e35 + r.x.extra35Min }), { min: 0, pago: 0, e25: 0, e35: 0 });
  const pend = tot(filas.filter((r) => r.estado === 'pendiente'));
  const apr = tot(filas.filter((r) => r.estado === 'aprobada'));
  const pendientes = filas.filter((r) => r.estado === 'pendiente');

  const resolver = async (estado: 'aprobada' | 'rechazada') => {
    const items = filas.filter((r) => sel.has(r.clave)).map((r) => ({ trabajador_id: r.t.id, fecha: r.x.fecha }));
    if (!items.length) return;
    setOcupado(true);
    try {
      await api.resolverHorasExtra(items, estado);
      avisar({ tipo: 'exito', titulo: `${items.length} registro(s) ${estado === 'aprobada' ? 'aprobados' : 'rechazados'}` });
      setSel(new Set());
      await d.recargar();
    } finally { setOcupado(false); }
  };

  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div>
      <Titulo titulo="Horas extra" sub="Calculadas automáticamente desde las marcas. Sobretasa: 25 % las 2 primeras horas y 35 % desde la tercera (D.S. 007-2002-TR)."
        acciones={
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-acero-200">
            {([['semana', 'Esta semana'], ['anterior', 'Semana anterior'], ['mes', 'Últimos 30 días']] as const).map(([k, t]) => (
              <button key={k} onClick={() => { setPeriodo(k); setSel(new Set()); }} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${periodo === k ? 'bg-acero-800 text-white' : 'text-acero-600'}`}>{t}</button>
            ))}
          </div>
        } />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-ambar-700">Pendientes de aprobación</p>
          <p className="mt-1 text-2xl font-extrabold tabular text-acero-900">{duracion(pend.min)}</p>
          <p className="text-xs text-acero-500">{pendientes.length} registros · ≈ {soles(pend.pago)}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-emerald-700">Aprobadas (van a planilla)</p>
          <p className="mt-1 text-2xl font-extrabold tabular text-acero-900">{duracion(apr.min)}</p>
          <p className="text-xs text-acero-500">{soles(apr.pago)}</p>
        </Tarjeta>
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-acero-500">Distribución del período</p>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-acero-100">
            <div style={{ width: `${(100 * (pend.e25 + apr.e25)) / Math.max(1, pend.min + apr.min)}%`, background: COLOR_25 }} />
            <div className="border-l-2 border-white" style={{ width: `${(100 * (pend.e35 + apr.e35)) / Math.max(1, pend.min + apr.min)}%`, background: COLOR_35 }} />
          </div>
          <div className="mt-2 flex gap-3 text-xs text-acero-600">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: COLOR_25 }} /> 25 %: {duracion(pend.e25 + apr.e25)}</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: COLOR_35 }} /> 35 %: {duracion(pend.e35 + apr.e35)}</span>
          </div>
        </Tarjeta>
      </div>

      {sel.size > 0 && (
        <div className="sticky top-20 z-20 mb-3 flex items-center gap-3 rounded-2xl bg-acero-900 px-4 py-3 text-white shadow-xl">
          <p className="flex-1 text-sm font-semibold">{sel.size} seleccionado(s)</p>
          <Boton variante="exito" cargando={ocupado} onClick={() => resolver('aprobada')}><Check size={16} /> Aprobar</Boton>
          <Boton variante="secundario" disabled={ocupado} onClick={() => resolver('rechazada')}><X size={16} /> Rechazar</Boton>
        </div>
      )}

      <Tarjeta className="overflow-hidden">
        {filas.length === 0 ? <Vacio icono={<Clock4 />} titulo="Sin horas extra en este período" /> : (
          <div className="scroll-fino overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-acero-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-acero-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="accent-acero-700" checked={pendientes.length > 0 && pendientes.every((r) => sel.has(r.clave))}
                      onChange={(e) => setSel(e.target.checked ? new Set(pendientes.map((r) => r.clave)) : new Set())} aria-label="Seleccionar pendientes" />
                  </th>
                  <th className="px-3 py-3">Trabajador</th><th className="px-3 py-3">Día</th><th className="px-3 py-3">Jornada</th>
                  <th className="px-3 py-3 text-right">Extra</th><th className="px-3 py-3 text-right">25 %</th><th className="px-3 py-3 text-right">35 %</th>
                  <th className="px-3 py-3 text-right">Valorizado</th><th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-acero-100">
                {filas.map(({ x, t, estado, pago, clave }) => (
                  <tr key={clave} className={sel.has(clave) ? 'bg-ambar-50/50' : 'hover:bg-acero-50/50'}>
                    <td className="px-4 py-2.5">{estado === 'pendiente' && <input type="checkbox" className="accent-acero-700" checked={sel.has(clave)} onChange={() => toggle(clave)} aria-label="Seleccionar" />}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombres={t.nombres} apellidos={t.apellidos} size={32} color={d.emp.get(t.empresa_id)?.color} foto={t.foto_enrolamiento} />
                        <div><p className="font-semibold text-acero-900">{nombreCompleto(t)}</p><p className="text-xs text-acero-500">Valor hora {soles(valorHora(t.remuneracion))}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-acero-700">{nombreDiaCorto(x.fecha)} {fechaCorta(x.fecha)}{!x.laborable && <Insignia tono="violeta" className="ml-1">no laborable</Insignia>}</td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular text-acero-600">{x.marcas.entrada ? horaLima(x.marcas.entrada.hora_marca) : '--'} – {x.marcas.salida ? horaLima(x.marcas.salida.hora_marca) : '--'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular text-acero-900">{duracion(x.extraMin)}</td>
                    <td className="px-3 py-2.5 text-right tabular text-acero-600">{duracion(x.extra25Min)}</td>
                    <td className="px-3 py-2.5 text-right tabular text-acero-600">{x.extra35Min ? duracion(x.extra35Min) : '—'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular text-acero-900">{soles(pago)}</td>
                    <td className="px-3 py-2.5"><Insignia tono={estado === 'aprobada' ? 'verde' : estado === 'rechazada' ? 'gris' : 'ambar'}>{estado}</Insignia></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
