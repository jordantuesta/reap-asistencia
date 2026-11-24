import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { AprobacionHE, Marcacion, PerfilTrabajador } from '../lib/types';
import { estadoHE, pagoExtra, resumenes } from '../lib/horas';
import { duracion, fechaCorta, fechaLima, horaLima, lunesDe, nombreDiaCorto, sumarDias } from '../lib/tiempo';
import { soles } from '../lib/util';
import { Cargando, Insignia } from '../ui/comunes';

export default function Horas({ perfil }: { perfil: PerfilTrabajador }) {
  const hoy = fechaLima();
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [datos, setDatos] = useState<{ marcas: Marcacion[]; aprobaciones: AprobacionHE[] } | null>(null);

  useEffect(() => {
    api.historial(perfil.trabajador.id, sumarDias(lunesDe(hoy), -28)).then(setDatos).catch(() => setDatos({ marcas: [], aprobaciones: [] }));
  }, [perfil.trabajador.id, hoy, perfil.marcas_hoy.length]);

  const dias = useMemo(() => (datos ? resumenes(datos.marcas, perfil.config, hoy) : []), [datos, perfil.config, hoy]);
  const semana = Array.from({ length: 6 }, (_, i) => sumarDias(lunes, i));
  const delaSemana = dias.filter((d) => d.fecha >= lunes && d.fecha <= sumarDias(lunes, 6));
  const tot = delaSemana.reduce((a, d) => ({ trab: a.trab + d.trabajadoMin, e25: a.e25 + d.extra25Min, e35: a.e35 + d.extra35Min, tard: a.tard + d.tardanzaMin }), { trab: 0, e25: 0, e35: 0, tard: 0 });
  const puedeAvanzar = lunes < lunesDe(hoy);

  return (
    <div className="px-4 pb-6 pt-5 safe-top">
      <h1 className="text-2xl font-extrabold text-acero-900">Mis horas</h1>
      <div className="mt-4 flex items-center justify-between rounded-2xl bg-white p-2 ring-1 ring-acero-100">
        <button onClick={() => setLunes(sumarDias(lunes, -7))} className="grid h-9 w-9 place-items-center rounded-xl text-acero-600 active:bg-acero-50" aria-label="Semana anterior"><ChevronLeft /></button>
        <p className="text-sm font-bold text-acero-800">{lunes === lunesDe(hoy) ? 'Esta semana' : `Semana del ${fechaCorta(lunes)}`}</p>
        <button onClick={() => puedeAvanzar && setLunes(sumarDias(lunes, 7))} disabled={!puedeAvanzar} className="grid h-9 w-9 place-items-center rounded-xl text-acero-600 disabled:opacity-30 active:bg-acero-50" aria-label="Semana siguiente"><ChevronRight /></button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Kpi t="Trabajadas" v={duracion(tot.trab)} />
        <Kpi t="Horas extra" v={duracion(tot.e25 + tot.e35)} acento />
        <Kpi t="Tardanzas" v={tot.tard ? `${tot.tard} min` : '0'} />
      </div>
      {tot.e25 + tot.e35 > 0 && (
        <p className="mt-2 rounded-xl bg-ambar-50 px-3 py-2 text-xs text-ambar-700">
          Extras: {duracion(tot.e25)} al 25 % y {duracion(tot.e35)} al 35 % · estimado {soles(pagoExtra(perfil.trabajador.remuneracion, tot.e25, tot.e35))} (sujeto a aprobación)
        </p>
      )}

      {!datos ? <Cargando /> : (
        <div className="mt-4 space-y-2">
          {semana.filter((f) => f <= hoy).reverse().map((f) => {
            const d = delaSemana.find((x) => x.fecha === f);
            const he = d && d.extraMin > 0 ? estadoHE(datos.aprobaciones, perfil.trabajador.id, f) : null;
            return (
              <div key={f} className="rounded-2xl bg-white p-3.5 ring-1 ring-acero-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 text-center">
                    <p className="text-[11px] font-semibold uppercase text-acero-400">{nombreDiaCorto(f)}</p>
                    <p className="text-lg font-extrabold text-acero-900">{f.slice(8)}</p>
                  </div>
                  {d?.marcas.entrada ? (
                    <div className="flex-1">
                      <p className="font-mono text-sm font-semibold tabular text-acero-800">
                        {horaLima(d.marcas.entrada.hora_marca)} → {d.marcas.salida ? horaLima(d.marcas.salida.hora_marca) : f === hoy ? 'en curso' : '¿?'}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.completa && <Insignia tono="azul">{duracion(d.trabajadoMin)}</Insignia>}
                        {d.tardanzaMin > 0 && <Insignia tono="rojo">Tarde {d.tardanzaMin} min</Insignia>}
                        {he && <Insignia tono={he === 'aprobada' ? 'verde' : he === 'rechazada' ? 'gris' : 'ambar'}>+{duracion(d.extraMin)} extra · {he}</Insignia>}
                        {d.observaciones.slice(0, 1).map((o) => <Insignia key={o} tono="ambar">{o}</Insignia>)}
                      </div>
                    </div>
                  ) : (
                    <p className="flex-1 text-sm text-acero-400">{f === hoy ? 'Aún sin marcas' : 'Sin asistencia'}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ t, v, acento }: { t: string; v: string; acento?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${acento ? 'bg-acero-900 text-white' : 'bg-white ring-1 ring-acero-100'}`}>
      <p className={`text-[11px] font-semibold ${acento ? 'text-ambar-300' : 'text-acero-500'}`}>{t}</p>
      <p className="mt-0.5 text-base font-extrabold tabular">{v}</p>
    </div>
  );
}
