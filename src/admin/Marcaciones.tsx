import { useMemo, useState } from 'react';
import { CloudOff, MapPin, ScanFace, Search, Smartphone } from 'lucide-react';
import type { Marcacion } from '../lib/types';
import { NOMBRE_MARCA } from '../lib/types';
import { distanciaM, textoDistancia } from '../lib/geo';
import { fechaCorta, fechaLima, horaLima, horaSegLima, sumarDias } from '../lib/tiempo';
import { nombreCompleto, pct } from '../lib/util';
import { Avatar, claseInput, FotoEvidencia, Insignia, Modal, Tarjeta, Vacio } from '../ui/comunes';
import Mapa from '../ui/Mapa';
import { useDatos } from './datos';
import { Titulo } from './Panel';

export default function Marcaciones() {
  const d = useDatos();
  const [fecha, setFecha] = useState(d.hoy);
  const [obra, setObra] = useState('todas');
  const [soloObs, setSoloObs] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Marcacion | null>(null);

  const filas = useMemo(() => d.marcaciones
    .filter((m) => fechaLima(m.hora_marca) === fecha)
    .filter((m) => obra === 'todas' || m.obra_id === obra)
    .filter((m) => !soloObs || m.estado === 'observada')
    .filter((m) => { if (!q) return true; const t = d.trab.get(m.trabajador_id); return t ? (nombreCompleto(t) + ' ' + t.dni).toLowerCase().includes(q.toLowerCase()) : false; })
    .sort((a, b) => b.hora_marca.localeCompare(a.hora_marca)), [d.marcaciones, d.trab, fecha, obra, soloObs, q]);

  return (
    <div>
      <Titulo titulo="Marcaciones" sub="Cada marca guarda foto, coincidencia facial, ubicación de captura y de envío, y hora oficial del servidor." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" value={fecha} max={d.hoy} min={sumarDias(d.hoy, -35)} onChange={(e) => setFecha(e.target.value)} className={claseInput + ' w-auto'} />
        <select value={obra} onChange={(e) => setObra(e.target.value)} className={claseInput + ' w-auto'}>
          <option value="todas">Todas las obras</option>
          {d.s.obras.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-acero-200">
          <input type="checkbox" checked={soloObs} onChange={(e) => setSoloObs(e.target.checked)} className="accent-ambar-500" /> Solo observadas
        </label>
        <div className="relative ml-auto">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-acero-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o DNI" className={claseInput + ' w-64 pl-9'} />
        </div>
      </div>

      <Tarjeta className="overflow-hidden">
        {filas.length === 0 ? <Vacio icono={<ScanFace />} titulo="Sin marcaciones" texto="No hay marcas con estos filtros." /> : (
          <div className="scroll-fino overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-acero-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-acero-500">
                <tr>
                  <th className="px-4 py-3">Trabajador</th><th className="px-3 py-3">Marca</th><th className="px-3 py-3">Hora</th>
                  <th className="px-3 py-3">Obra</th><th className="px-3 py-3">Ubicación</th><th className="px-3 py-3">Rostro</th><th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-acero-100">
                {filas.map((m) => {
                  const t = d.trab.get(m.trabajador_id);
                  return (
                    <tr key={m.id} onClick={() => setSel(m)} className="cursor-pointer hover:bg-acero-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {m.foto ? <FotoEvidencia ruta={m.foto} className="h-9 w-9 rounded-full" /> : t && <Avatar nombres={t.nombres} apellidos={t.apellidos} size={36} color={d.emp.get(t.empresa_id)?.color} />}
                          <div><p className="font-semibold text-acero-900">{t ? nombreCompleto(t) : '—'}</p><p className="text-xs text-acero-500">{t?.cargo}</p></div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-acero-700">{NOMBRE_MARCA[m.tipo]}</td>
                      <td className="px-3 py-2.5 font-mono font-semibold tabular text-acero-900">{horaLima(m.hora_marca)}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-acero-600">{d.obra.get(m.obra_id || '')?.nombre || '—'}</td>
                      <td className="px-3 py-2.5">
                        {m.dentro_obra == null ? <span className="text-acero-400">—</span> : m.dentro_obra
                          ? <span className="flex items-center gap-1 text-emerald-700"><MapPin size={13} /> Dentro · {textoDistancia(m.distancia_m)}</span>
                          : <span className="flex items-center gap-1 font-semibold text-ambar-700"><MapPin size={13} /> Fuera · {textoDistancia(m.distancia_m)}</span>}
                      </td>
                      <td className="px-3 py-2.5 tabular text-acero-700">{pct(m.similitud)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {m.estado === 'valida' ? <Insignia tono="verde">Válida</Insignia> : <Insignia tono="ambar">Observada</Insignia>}
                          {m.sin_conexion && <Insignia tono="violeta"><CloudOff size={11} /> Sin señal</Insignia>}
                          {m.dispositivo_distinto && <Insignia tono="rojo"><Smartphone size={11} /> Otro celular</Insignia>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>
      <p className="mt-2 text-xs text-acero-400">{filas.length} marcaciones · {fechaCorta(fecha)}</p>

      <ModalEvidencia m={sel} onCerrar={() => setSel(null)} />
    </div>
  );
}

export function ModalEvidencia({ m, onCerrar }: { m: Marcacion | null; onCerrar: () => void }) {
  const d = useDatos();
  if (!m) return null;
  const t = d.trab.get(m.trabajador_id);
  const o = d.obra.get(m.obra_id || '');
  const puntos = [];
  if (m.lat_captura != null) puntos.push({ lat: m.lat_captura, lng: m.lng_captura!, color: '#2E6BC4', etiqueta: 'Donde se tomó la foto' });
  if (m.lat_subida != null) puntos.push({ lat: m.lat_subida, lng: m.lng_subida!, color: '#CF7F0A', etiqueta: 'Donde se envió', radio: 5 });
  const sepSubida = m.lat_captura != null && m.lat_subida != null ? distanciaM(m.lat_captura, m.lng_captura!, m.lat_subida, m.lng_subida!) : null;
  const difMin = (Date.parse(m.hora_servidor) - Date.parse(m.hora_dispositivo)) / 60000;
  return (
    <Modal abierto onCerrar={onCerrar} ancho="max-w-3xl" titulo={<>Evidencia · {NOMBRE_MARCA[m.tipo]} de {t ? nombreCompleto(t) : ''}</>}>
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-3">
          <FotoEvidencia ruta={m.foto} className="aspect-[3/4] w-full" etiqueta="Foto de la marca" />
          {t?.foto_enrolamiento && <FotoEvidencia ruta={t.foto_enrolamiento} className="aspect-square w-24" etiqueta="Alta" />}
        </div>
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Dato k="Hora oficial (servidor)" v={`${fechaCorta(fechaLima(m.hora_marca))}, ${horaSegLima(m.hora_marca)}`} />
            <Dato k="Hora del celular" v={horaSegLima(m.hora_dispositivo)} nota={Math.abs(difMin) > 2 ? `llegó ${Math.round(difMin)} min después` : undefined} />
            <Dato k="Coincidencia facial" v={pct(m.similitud)} />
            <Dato k="Prueba de vida" v={pct(m.vida)} />
            <Dato k="Obra" v={o?.nombre || '—'} />
            <Dato k="Distancia a la obra" v={m.distancia_m == null ? '—' : `${textoDistancia(m.distancia_m)} (radio ${o?.radio_m} m)`} nota={m.dentro_obra === false ? 'fuera de obra' : undefined} />
            <Dato k="Precisión GPS" v={m.prec_captura != null ? `±${m.prec_captura} m` : '—'} />
            <Dato k="Captura → envío" v={sepSubida == null ? '—' : textoDistancia(sepSubida)} nota={sepSubida != null && sepSubida > 300 ? 'se envió desde otro lugar' : undefined} />
            <Dato k="Celular" v={m.dispositivo_distinto ? 'Distinto al registrado' : 'El registrado'} nota={m.dispositivo_distinto ? 'revisar' : undefined} />
            <Dato k="Conexión" v={m.sin_conexion ? 'Sin señal (enviada después)' : 'En línea'} />
          </dl>
          {m.observaciones.length > 0 && (
            <div className="rounded-xl bg-ambar-50 p-3 text-sm text-ambar-800 ring-1 ring-ambar-200">
              {m.observaciones.map((x) => <p key={x}>• {x}</p>)}
            </div>
          )}
          <Mapa obras={o ? [o] : []} puntos={puntos} linea={puntos.length === 2 ? [[puntos[0].lat, puntos[0].lng], [puntos[1].lat, puntos[1].lng]] : undefined} alto={240} resaltar={o?.id} />
          <div className="flex gap-4 text-xs text-acero-600">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#2E6BC4' }} /> Donde se tomó la foto</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: '#CF7F0A' }} /> Donde se envió</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Dato({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-acero-400">{k}</dt>
      <dd className="font-semibold text-acero-900">{v}{nota && <span className="ml-1.5 text-xs font-semibold text-ambar-700">({nota})</span>}</dd>
    </div>
  );
}
