import { useMemo, useState } from 'react';
import { Cloud, FileSpreadsheet, FolderOpen, Download } from 'lucide-react';
import { exportarAsistencia, nombreArchivo } from '../lib/excel';
import { totalesPorTrabajador } from '../lib/horas';
import { duracion, fechaLima, lunesDe, sumarDias } from '../lib/tiempo';
import { nombreCompleto, soles } from '../lib/util';
import { Boton, Campo, claseInput, Insignia, Tarjeta, useAviso } from '../ui/comunes';
import { useDatos } from './datos';
import { Titulo } from './Panel';

export default function Reportes() {
  const d = useDatos();
  const avisar = useAviso();
  const [desde, setDesde] = useState(sumarDias(lunesDe(d.hoy), -7));
  const [hasta, setHasta] = useState(d.hoy);
  const [generando, setGenerando] = useState(false);
  const empresas = d.empresa === 'todas' ? d.s.empresas : d.s.empresas.filter((e) => e.id === d.empresa);
  const dias = useMemo(() => d.dias.filter((x) => x.fecha >= desde && x.fecha <= hasta), [d.dias, desde, hasta]);
  const totales = useMemo(() => totalesPorTrabajador(d.trabajadores, dias, d.s.aprobaciones).filter((x) => x.dias > 0).sort((a, b) => b.extra25Min + b.extra35Min - (a.extra25Min + a.extra35Min)), [d.trabajadores, dias, d.s.aprobaciones]);
  const carpeta = (e: string) => d.s.config.onedrive_carpeta.replace('{empresa}', e).replace('{año}', hasta.slice(0, 4)).replace('{mes}', hasta.slice(5, 7));

  const generar = async () => {
    setGenerando(true);
    try {
      await exportarAsistencia({ empresas, desde, hasta, trabajadores: d.trabajadores, dias, obras: d.obra, aprobaciones: d.s.aprobaciones });
      avisar({ tipo: 'exito', titulo: 'Excel generado', texto: nombreArchivo('Registro_Asistencia', empresas, desde, hasta) });
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'No se pudo generar el Excel', texto: String((e as Error)?.message || e) });
    } finally { setGenerando(false); }
  };

  return (
    <div>
      <Titulo titulo="Reportes" sub="Registro de control de asistencia listo para una inspección de SUNAFIL y horas extra para planilla." />
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Tarjeta className="p-5">
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Desde"><input type="date" className={claseInput} value={desde} max={hasta} min={sumarDias(d.hoy, -35)} onChange={(e) => setDesde(e.target.value)} /></Campo>
            <Campo etiqueta="Hasta"><input type="date" className={claseInput} value={hasta} min={desde} max={d.hoy} onChange={(e) => setHasta(e.target.value)} /></Campo>
            <div className="flex gap-1.5 pb-1">
              <button onClick={() => { setDesde(lunesDe(d.hoy)); setHasta(d.hoy); }} className="rounded-lg bg-acero-50 px-2.5 py-1.5 text-xs font-semibold text-acero-700 ring-1 ring-acero-200">Esta semana</button>
              <button onClick={() => { setDesde(sumarDias(d.hoy, -14)); setHasta(d.hoy); }} className="rounded-lg bg-acero-50 px-2.5 py-1.5 text-xs font-semibold text-acero-700 ring-1 ring-acero-200">Quincena</button>
            </div>
            <Boton className="ml-auto" cargando={generando} onClick={generar}><Download size={16} /> Descargar Excel</Boton>
          </div>
          <p className="mt-3 text-xs text-acero-500">
            Incluye {empresas.map((e) => e.nombre_corto).join(' y ')} · una hoja de asistencia y una de horas extra aprobadas por cada razón social.
          </p>

          <div className="scroll-fino mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-acero-500">
                <tr className="border-b border-acero-100"><th className="py-2">Trabajador</th><th className="py-2 text-right">Días</th><th className="py-2 text-right">Trabajadas</th><th className="py-2 text-right">Tardanzas</th><th className="py-2 text-right">HE total</th><th className="py-2 text-right">HE pendiente</th><th className="py-2 text-right">A pagar (aprobado)</th></tr>
              </thead>
              <tbody className="divide-y divide-acero-50">
                {totales.map((x) => (
                  <tr key={x.trabajador.id}>
                    <td className="py-2 font-medium text-acero-800">{nombreCompleto(x.trabajador)}</td>
                    <td className="py-2 text-right tabular">{x.dias}</td>
                    <td className="py-2 text-right tabular">{duracion(x.trabajadoMin)}</td>
                    <td className="py-2 text-right tabular">{x.tardanzas ? <span className="text-red-600">{x.tardanzas} ({x.tardanzaMin} min)</span> : '—'}</td>
                    <td className="py-2 text-right tabular">{duracion(x.extra25Min + x.extra35Min)}</td>
                    <td className="py-2 text-right tabular">{x.extraPendienteMin ? <Insignia tono="ambar">{duracion(x.extraPendienteMin)}</Insignia> : '—'}</td>
                    <td className="py-2 text-right font-semibold tabular">{soles(x.pagoAprobado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <div className="space-y-4">
          <Tarjeta className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#0364B8] text-white"><Cloud size={22} /></div>
              <div><p className="font-bold text-acero-900">Envío a OneDrive</p><p className="text-xs text-acero-500">Microsoft 365 de REAP</p></div>
              <Insignia tono="ambar" className="ml-auto">En implementación</Insignia>
            </div>
            <p className="mt-3 text-sm text-acero-600">Los reportes se guardarán solos cada semana y al cierre de mes en estas carpetas:</p>
            <ul className="mt-3 space-y-2">
              {empresas.map((e) => (
                <li key={e.id} className="flex items-center gap-2 rounded-xl bg-acero-50 px-3 py-2 font-mono text-[11px] text-acero-700"><FolderOpen size={14} className="shrink-0 text-ambar-600" /> {carpeta(e.nombre_corto)}</li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-acero-500">Se conecta con la cuenta Microsoft 365 de la empresa (permiso de solo escritura en esa carpeta). En este demo el Excel se descarga directamente.</p>
          </Tarjeta>
          <Tarjeta className="p-5">
            <p className="flex items-center gap-2 font-bold text-acero-900"><FileSpreadsheet size={18} className="text-emerald-600" /> ¿Qué incluye el Excel?</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-acero-600">
              <li>Ingreso, salida y retorno de refrigerio, y salida de cada día.</li>
              <li>Horas trabajadas, tardanzas y horas extra al 25 % y 35 %.</li>
              <li>Obra y observaciones (fuera de obra, sin señal, otro celular).</li>
              <li>Hoja de horas extra aprobadas con montos para planilla.</li>
            </ul>
            <p className="mt-3 text-xs text-acero-400">Generado el {fechaLima()}</p>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
