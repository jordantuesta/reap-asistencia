import { useState } from 'react';
import { Eye, EyeOff, FileCheck2, Printer, Send } from 'lucide-react';
import { api } from '../lib/api';
import type { Adenda, Contrato } from '../lib/types';
import { fechaCorta, fechaLima, fechaNum, hace, sumarDias } from '../lib/tiempo';
import { nombreCompleto } from '../lib/util';
import { Avatar, Boton, Campo, claseInput, Insignia, Modal, Tarjeta, useAviso } from '../ui/comunes';
import DocumentoAdenda from '../ui/DocumentoAdenda';
import { semaforo } from '../worker/ContratoTab';
import { diasRestantes, useDatos } from './datos';
import { Titulo } from './Panel';

export default function Contratos() {
  const d = useDatos();
  const [enviar, setEnviar] = useState<Contrato | null>(null);
  const [ver, setVer] = useState<Adenda | null>(null);
  const filas = d.contratos
    .filter((c) => d.trab.get(c.trabajador_id)?.activo)
    .map((c) => ({ c, t: d.trab.get(c.trabajador_id)!, dias: diasRestantes(c, d.hoy), adenda: [...d.s.adendas].filter((a) => a.contrato_id === c.id).sort((a, b) => b.enviada_at.localeCompare(a.enviada_at))[0] }))
    .sort((a, b) => (a.dias ?? 99999) - (b.dias ?? 99999));
  const cuenta = (f: (x: number | null) => boolean) => filas.filter((x) => f(x.dias)).length;

  return (
    <div>
      <Titulo titulo="Contratos y renovaciones" sub="Alertas de vencimiento y envío de adendas al celular del trabajador para firma con reconocimiento facial." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Resumen color="#DC2626" t="Vencidos" n={cuenta((x) => x != null && x < 0)} />
        <Resumen color="#DC2626" t="Vencen en ≤ 7 días" n={cuenta((x) => x != null && x >= 0 && x <= 7)} />
        <Resumen color="#D9860B" t="Vencen en 8–30 días" n={cuenta((x) => x != null && x > 7 && x <= 30)} />
        <Resumen color="#059669" t="Vigentes > 30 días" n={cuenta((x) => x == null || x > 30)} />
      </div>
      <Tarjeta className="overflow-hidden">
        <div className="scroll-fino overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-acero-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-acero-500">
              <tr><th className="px-4 py-3">Trabajador</th><th className="px-3 py-3">Modalidad</th><th className="px-3 py-3">Inicio</th><th className="px-3 py-3">Fin</th><th className="px-3 py-3">Estado</th><th className="px-3 py-3">Renovación</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-acero-100">
              {filas.map(({ c, t, dias, adenda }) => {
                const s = semaforo(dias);
                const pendiente = adenda?.estado === 'enviada';
                return (
                  <tr key={c.id} className="hover:bg-acero-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombres={t.nombres} apellidos={t.apellidos} size={34} color={d.emp.get(t.empresa_id)?.color} foto={t.foto_enrolamiento} />
                        <div><p className="font-semibold text-acero-900">{nombreCompleto(t)}</p><p className="text-xs text-acero-500">{c.cargo} · {d.emp.get(c.empresa_id)?.nombre_corto}</p></div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-3 py-2.5 text-xs text-acero-600">{c.modalidad}</td>
                    <td className="px-3 py-2.5 tabular text-acero-600">{fechaNum(c.fecha_inicio)}</td>
                    <td className="px-3 py-2.5 tabular font-semibold text-acero-800">{c.fecha_fin ? fechaNum(c.fecha_fin) : '—'}</td>
                    <td className="px-3 py-2.5"><Insignia tono={s.tono}>{s.texto}</Insignia></td>
                    <td className="px-3 py-2.5 text-xs">
                      {!adenda ? <span className="text-acero-400">—</span> : adenda.estado === 'firmada' ? (
                        <button onClick={() => setVer(adenda)} className="flex items-center gap-1 font-semibold text-emerald-700 hover:underline"><FileCheck2 size={14} /> Adenda {adenda.numero} firmada {adenda.firmada_at ? fechaCorta(fechaLima(adenda.firmada_at)) : ''}</button>
                      ) : (
                        <button onClick={() => setVer(adenda)} className="text-left hover:underline">
                          <span className="flex items-center gap-1 font-semibold text-ambar-700"><Send size={13} /> Enviada {hace(adenda.enviada_at)}</span>
                          <span className="flex items-center gap-1 text-acero-500">{adenda.vista_at ? <><Eye size={12} /> Vista por el trabajador</> : <><EyeOff size={12} /> Aún no la abre</>}</span>
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {c.fecha_fin && !pendiente && dias != null && dias <= 45 && (
                        <Boton variante={dias <= 7 ? 'acento' : 'secundario'} className="whitespace-nowrap px-3 py-1.5 text-xs" onClick={() => setEnviar(c)}><Send size={14} /> Enviar adenda</Boton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {enviar && <ModalEnviar c={enviar} onCerrar={() => setEnviar(null)} />}
      {ver && (() => {
        const c = d.s.contratos.find((x) => x.id === ver.contrato_id) || null;
        const t = d.trab.get(ver.trabajador_id)!;
        return (
          <Modal abierto onCerrar={() => setVer(null)} titulo={`Adenda N.° ${ver.numero} · ${nombreCompleto(t)}`} ancho="max-w-3xl"
            pie={<Boton variante="secundario" onClick={() => window.print()}><Printer size={16} /> Imprimir / PDF</Boton>}>
            <DocumentoAdenda adenda={ver} contrato={c} empresa={d.emp.get(ver.empresa_id)!} trabajador={t} />
          </Modal>
        );
      })()}
    </div>
  );
}

function Resumen({ color, t, n }: { color: string; t: string; n: number }) {
  return (
    <Tarjeta className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-acero-500"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {t}</div>
      <p className="mt-1 text-3xl font-extrabold tabular text-acero-900">{n}</p>
    </Tarjeta>
  );
}

function ModalEnviar({ c, onCerrar }: { c: Contrato; onCerrar: () => void }) {
  const d = useDatos();
  const avisar = useAviso();
  const t = d.trab.get(c.trabajador_id)!;
  const base = c.fecha_fin && c.fecha_fin > d.hoy ? c.fecha_fin : d.hoy;
  const [fin, setFin] = useState(sumarDias(base, 90));
  const [enviando, setEnviando] = useState(false);
  const previa: Adenda = {
    id: 'previa', contrato_id: c.id, trabajador_id: t.id, empresa_id: c.empresa_id, numero: d.s.adendas.filter((a) => a.contrato_id === c.id).length + 1,
    fecha_fin_anterior: c.fecha_fin || d.hoy, nueva_fecha_fin: fin, enviada_at: new Date().toISOString(), vista_at: null, estado: 'enviada',
    firmada_at: null, firma_foto: null, firma_similitud: null, firma_lat: null, firma_lng: null, firma_dispositivo: null, codigo_verificacion: null,
  };
  const mandar = async () => {
    setEnviando(true);
    try {
      await api.enviarAdenda(c.id, fin);
      await d.recargar();
      avisar({ tipo: 'exito', titulo: 'Adenda enviada', texto: `${nombreCompleto(t)} la verá en su app para firmarla con su rostro.` });
      onCerrar();
    } finally { setEnviando(false); }
  };
  return (
    <Modal abierto onCerrar={onCerrar} titulo={`Renovar contrato · ${nombreCompleto(t)}`} ancho="max-w-3xl"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton variante="acento" cargando={enviando} onClick={mandar}><Send size={16} /> Enviar al celular del trabajador</Boton></>}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Nueva fecha de fin"><input type="date" className={claseInput} value={fin} min={sumarDias(base, 1)} onChange={(e) => setFin(e.target.value)} /></Campo>
        <div className="flex gap-1.5 pb-1">
          {[30, 60, 90, 180].map((n) => <button key={n} onClick={() => setFin(sumarDias(base, n))} className="rounded-lg bg-acero-50 px-2.5 py-1.5 text-xs font-semibold text-acero-700 ring-1 ring-acero-200 hover:bg-acero-100">+{n} días</button>)}
        </div>
      </div>
      <div className="rounded-2xl bg-acero-50/50 p-5 ring-1 ring-acero-100">
        <DocumentoAdenda adenda={previa} contrato={c} empresa={d.emp.get(c.empresa_id)!} trabajador={t} />
      </div>
    </Modal>
  );
}
