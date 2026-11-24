import type { Adenda, Contrato, Empresa } from '../lib/types';
import { fechaDocumento, horaLima, fechaLima } from '../lib/tiempo';
import { pct, soles } from '../lib/util';
import { FotoEvidencia } from './comunes';
import { ShieldCheck } from 'lucide-react';

interface Props {
  adenda: Adenda;
  contrato: Contrato | null;
  empresa: Empresa;
  trabajador: { nombres: string; apellidos: string; dni: string; cargo: string };
}

/** Modelo referencial de adenda de prórroga. El texto final debe validarlo la asesoría legal de REAP. */
export default function DocumentoAdenda({ adenda, contrato, empresa, trabajador }: Props) {
  const nombre = `${trabajador.nombres} ${trabajador.apellidos}`.toUpperCase();
  return (
    <article className="imprimible mx-auto max-w-2xl bg-white font-serif text-[13.5px] leading-relaxed text-slate-800">
      <header className="border-b-2 border-acero-900 pb-3 text-center font-sans">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-acero-500">{empresa.nombre}{empresa.ruc ? ` · RUC ${empresa.ruc}` : ''}</p>
        <h2 className="mt-1 text-base font-extrabold uppercase text-acero-900">Adenda N.° {adenda.numero} de prórroga<br />al contrato de trabajo sujeto a modalidad</h2>
      </header>
      <p className="mt-4">
        Conste por el presente documento la adenda que celebran, de una parte, <b>{empresa.nombre.toUpperCase()}</b>
        {empresa.ruc ? <>, con RUC N.° {empresa.ruc}</> : null}, a quien en adelante se denominará <b>EL EMPLEADOR</b>; y de la otra parte,
        el Sr(a). <b>{nombre}</b>, identificado(a) con DNI N.° <b>{trabajador.dni}</b>, a quien en adelante se denominará <b>EL TRABAJADOR</b>,
        en los términos y condiciones siguientes:
      </p>
      <p className="mt-3"><b>PRIMERA.—</b> Las partes suscribieron un contrato de trabajo bajo la modalidad de <i>{contrato?.modalidad?.toLowerCase() || 'obra determinada o servicio específico'}</i>
        {contrato ? <> con fecha de inicio {fechaDocumento(contrato.fecha_inicio)}</> : null}, para que EL TRABAJADOR desempeñe el cargo de <b>{trabajador.cargo}</b>,
        con vencimiento el <b>{fechaDocumento(adenda.fecha_fin_anterior)}</b>.</p>
      <p className="mt-3"><b>SEGUNDA.—</b> Por la presente adenda, las partes acuerdan <b>prorrogar</b> el plazo del contrato hasta el <b>{fechaDocumento(adenda.nueva_fecha_fin)}</b>,
        manteniéndose la remuneración mensual{contrato ? <> de <b>{soles(contrato.remuneracion)}</b></> : null} y las demás condiciones pactadas.</p>
      <p className="mt-3"><b>TERCERA.—</b> Las partes declaran que la presente prórroga se suscribe antes del vencimiento del plazo del contrato,
        y que la causa objetiva que dio origen a la contratación subsiste.</p>
      <p className="mt-3"><b>CUARTA.—</b> EL TRABAJADOR suscribe la presente adenda mediante firma electrónica, verificada con reconocimiento
        facial, registro de fecha, hora y geolocalización, quedando constancia digital del acto.</p>

      {adenda.estado === 'firmada' ? (
        <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 font-sans">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-800"><ShieldCheck size={18} /> Firmado electrónicamente por EL TRABAJADOR</p>
          <div className="mt-3 flex gap-4">
            <FotoEvidencia ruta={adenda.firma_foto} className="h-24 w-20 shrink-0" />
            <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">Firmante</dt><dd className="font-semibold">{nombre}</dd>
              <dt className="text-slate-500">Fecha y hora</dt><dd className="font-semibold">{adenda.firmada_at ? `${fechaDocumento(fechaLima(adenda.firmada_at))}, ${horaLima(adenda.firmada_at)}` : '—'}</dd>
              <dt className="text-slate-500">Coincidencia facial</dt><dd className="font-semibold">{pct(adenda.firma_similitud)}</dd>
              <dt className="text-slate-500">Ubicación</dt><dd className="font-semibold">{adenda.firma_lat != null ? `${adenda.firma_lat.toFixed(5)}, ${adenda.firma_lng?.toFixed(5)}` : '—'}</dd>
              <dt className="text-slate-500">Código</dt><dd className="font-mono font-semibold">{adenda.codigo_verificacion || '—'}</dd>
            </dl>
          </div>
        </section>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-8 font-sans text-xs text-slate-500">
          <div className="border-t border-slate-400 pt-1 text-center">EL EMPLEADOR</div>
          <div className="border-t border-slate-400 pt-1 text-center">EL TRABAJADOR<br />(pendiente de firma)</div>
        </div>
      )}
      <p className="mt-5 font-sans text-[10px] text-slate-400">Modelo referencial generado por REAP Asistencia. El texto definitivo debe ser validado por la asesoría legal de la empresa.</p>
    </article>
  );
}
