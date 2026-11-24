import { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileSignature, FileText, Loader2, ScanFace } from 'lucide-react';
import { api } from '../lib/api';
import type { Adenda, CapturaFacial, PerfilTrabajador } from '../lib/types';
import { obtenerUbicacion } from '../lib/geo';
import { diasEntre, fechaCorta, fechaLima, fechaNum } from '../lib/tiempo';
import { idDispositivo, soles } from '../lib/util';
import { Boton, Insignia } from '../ui/comunes';
import CamaraFacial from '../ui/CamaraFacial';
import DocumentoAdenda from '../ui/DocumentoAdenda';

export function semaforo(dias: number | null): { tono: 'verde' | 'ambar' | 'rojo' | 'gris'; texto: string; color: string } {
  if (dias == null) return { tono: 'verde', texto: 'Plazo indeterminado', color: '#059669' };
  if (dias < 0) return { tono: 'rojo', texto: `Vencido hace ${-dias} día${dias === -1 ? '' : 's'}`, color: '#DC2626' };
  if (dias <= 7) return { tono: 'rojo', texto: `Vence en ${dias} día${dias === 1 ? '' : 's'}`, color: '#DC2626' };
  if (dias <= 15) return { tono: 'ambar', texto: `Vence en ${dias} días`, color: '#D9860B' };
  if (dias <= 30) return { tono: 'ambar', texto: `Vence en ${dias} días`, color: '#EAB308' };
  return { tono: 'verde', texto: `Vence en ${dias} días`, color: '#059669' };
}

export default function ContratoTab({ perfil, recargar }: { perfil: PerfilTrabajador; recargar: () => Promise<void> | void }) {
  const [abierta, setAbierta] = useState<Adenda | null>(null);
  const [firmando, setFirmando] = useState<'no' | 'camara' | 'enviando' | 'ok'>('no');
  const [error, setError] = useState('');
  const c = perfil.contrato;
  const hoy = fechaLima();
  const dias = c?.fecha_fin ? diasEntre(hoy, c.fecha_fin) : null;
  const s = semaforo(dias);
  const total = c?.fecha_fin ? Math.max(1, diasEntre(c.fecha_inicio, c.fecha_fin)) : 1;
  const avance = c?.fecha_fin ? Math.min(1, Math.max(0, diasEntre(c.fecha_inicio, hoy) / total)) : 1;
  const t = perfil.trabajador;

  const abrir = (a: Adenda) => {
    setAbierta(a); setFirmando('no'); setError('');
    if (!a.vista_at && a.estado === 'enviada') void api.verAdenda(t.id, a.id);
  };

  const alCapturar = async (cap: CapturaFacial) => {
    if (!abierta) return;
    setFirmando('enviando');
    let ubic = null;
    try { ubic = await obtenerUbicacion({ maxEdadMs: 30000, timeoutMs: 8000 }); } catch { /* firma sin ubicación */ }
    try {
      const r = await api.firmarAdenda({ trabajador_id: t.id, adenda_id: abierta.id, captura: cap, ubicacion: ubic, dispositivo_id: idDispositivo() });
      if (r.ok && r.adenda) { setAbierta(r.adenda); setFirmando('ok'); void recargar(); }
      else { setError(r.mensaje); setFirmando('no'); }
    } catch (e) {
      setError('No se pudo firmar: ' + String((e as Error)?.message || e)); setFirmando('no');
    }
  };

  if (abierta) {
    if (firmando === 'camara') {
      return <CamaraFacial titulo={`Firmar adenda N.° ${abierta.numero}`} subtitulo="Firma con tu rostro" diagnostico={perfil.config.mostrar_diagnostico} onListo={alCapturar} onCancelar={() => setFirmando('no')} />;
    }
    return (
      <div className="safe-top min-h-full bg-white pb-40">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-acero-100 bg-white/95 px-3 py-3 backdrop-blur">
          <button onClick={() => setAbierta(null)} className="grid h-9 w-9 place-items-center rounded-xl text-acero-700 active:bg-acero-50" aria-label="Volver"><ArrowLeft /></button>
          <p className="font-bold text-acero-900">Adenda N.° {abierta.numero}</p>
          {abierta.estado === 'firmada' && <Insignia tono="verde" className="ml-auto">Firmada</Insignia>}
        </div>
        <div className="px-5 py-5">
          <DocumentoAdenda adenda={abierta} contrato={c} empresa={perfil.empresa} trabajador={t} />
        </div>
        {abierta.estado === 'enviada' && (
          <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-acero-100 bg-white p-4 shadow-[0_-8px_24px_rgba(15,42,68,0.08)]">
            {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Boton variante="acento" className="h-14 w-full rounded-2xl text-base" cargando={firmando === 'enviando'} onClick={() => setFirmando('camara')}>
              <ScanFace size={20} /> Firmar con mi rostro
            </Boton>
            <p className="mt-2 text-center text-[11px] text-acero-500">Al firmar aceptas la prórroga de tu contrato. Queda registro de fecha, hora, ubicación y foto.</p>
          </div>
        )}
        {firmando === 'ok' && (
          <div className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-emerald-600 p-4 text-white shadow-xl">
            <CheckCircle2 /> <p className="text-sm font-semibold">¡Adenda firmada! RR. HH. ya puede verla en el panel.</p>
          </div>
        )}
        {firmando === 'enviando' && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-acero-950/90 text-white"><Loader2 className="girar" size={36} /><p className="mt-3 font-semibold">Verificando y firmando…</p></div>
        )}
      </div>
    );
  }

  const pendientes = perfil.adendas.filter((a) => a.estado === 'enviada');
  const firmadas = perfil.adendas.filter((a) => a.estado === 'firmada');

  return (
    <div className="safe-top px-4 pb-6 pt-5">
      <h1 className="text-2xl font-extrabold text-acero-900">Mi contrato</h1>
      {c ? (
        <div className="mt-4 overflow-hidden rounded-3xl bg-white ring-1 ring-acero-100">
          <div className="fondo-marca p-5 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{perfil.empresa.nombre}</p>
            <p className="mt-1 text-lg font-extrabold">{c.cargo}</p>
            <p className="text-sm text-white/70">{c.modalidad}</p>
          </div>
          <div className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <Insignia tono={s.tono}>{s.texto}</Insignia>
              <span className="text-sm font-semibold text-acero-700">{soles(c.remuneracion)} / mes</span>
            </div>
            {c.fecha_fin && (
              <>
                <div className="h-2.5 overflow-hidden rounded-full bg-acero-100">
                  <div className="h-full rounded-full" style={{ width: `${avance * 100}%`, background: s.color }} />
                </div>
                <div className="flex justify-between text-xs text-acero-500">
                  <span>Inicio {fechaNum(c.fecha_inicio)}</span>
                  <span>Fin {fechaNum(c.fecha_fin)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm text-acero-500 ring-1 ring-acero-100">No hay contrato registrado.</p>
      )}

      {pendientes.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-acero-500">Por firmar</h2>
          {pendientes.map((a) => (
            <button key={a.id} onClick={() => abrir(a)} className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-ambar-50 p-4 text-left ring-1 ring-ambar-200 active:scale-[0.99]">
              <FileSignature className="shrink-0 text-ambar-600" />
              <div className="flex-1">
                <p className="font-bold text-acero-900">Adenda N.° {a.numero} · Renovación</p>
                <p className="text-xs text-acero-600">Prórroga hasta el {fechaNum(a.nueva_fecha_fin)} · enviada {fechaCorta(fechaLima(a.enviada_at))}</p>
              </div>
              <span className="rounded-lg bg-ambar-500 px-2.5 py-1 text-xs font-bold text-acero-950">Revisar</span>
            </button>
          ))}
        </>
      )}

      {firmadas.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wider text-acero-500">Documentos firmados</h2>
          {firmadas.map((a) => (
            <button key={a.id} onClick={() => abrir(a)} className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-acero-100">
              <FileText className="shrink-0 text-acero-500" />
              <div className="flex-1">
                <p className="font-semibold text-acero-900">Adenda N.° {a.numero}</p>
                <p className="text-xs text-acero-500">Firmada el {a.firmada_at ? fechaNum(fechaLima(a.firmada_at)) : ''}</p>
              </div>
              <Insignia tono="verde">Firmada</Insignia>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
