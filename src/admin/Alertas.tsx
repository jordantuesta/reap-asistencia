import { useState } from 'react';
import { BellRing, Check, Fingerprint, MapPinOff, ScanFace, ShieldCheck, Smartphone, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Alerta, TipoAlerta } from '../lib/types';
import { NOMBRE_ALERTA } from '../lib/types';
import { fechaCorta, fechaLima, hace, horaLima } from '../lib/tiempo';
import { nombreCompleto, pct } from '../lib/util';
import { Boton, FotoEvidencia, Insignia, Tarjeta, Vacio, useAviso } from '../ui/comunes';
import { useDatos } from './datos';
import { Titulo } from './Panel';

const ICONO: Record<TipoAlerta, typeof BellRing> = {
  rostro_no_coincide: ScanFace,
  prueba_vida: Fingerprint,
  fuera_de_obra: MapPinOff,
  dispositivo_distinto: Smartphone,
  contrato_vencido: BellRing,
};

export default function Alertas() {
  const d = useDatos();
  const [filtro, setFiltro] = useState<'nueva' | 'todas'>('nueva');
  const avisar = useAviso();
  const lista = d.alertas
    .filter((a) => filtro === 'todas' || a.estado === 'nueva')
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const suplantaciones = d.alertas.filter((a) => a.tipo === 'rostro_no_coincide').length;

  const resolver = async (a: Alerta, estado: Alerta['estado']) => {
    await api.resolverAlerta(a.id, estado);
    avisar({ tipo: 'exito', titulo: estado === 'revisada' ? 'Alerta marcada como revisada' : 'Alerta descartada' });
    await d.recargar();
  };

  return (
    <div>
      <Titulo
        titulo="Alertas de seguridad"
        sub={<>En los últimos 35 días el sistema bloqueó <b className="text-red-600">{suplantaciones} intento(s) de marcar con otro rostro</b>.</>}
        acciones={
          <div className="flex rounded-xl bg-white p-1 ring-1 ring-acero-200">
            {(['nueva', 'todas'] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filtro === f ? 'bg-acero-800 text-white' : 'text-acero-600'}`}>{f === 'nueva' ? 'Por revisar' : 'Todas'}</button>
            ))}
          </div>
        }
      />
      {lista.length === 0 ? (
        <Tarjeta><Vacio icono={<ShieldCheck />} titulo="Sin alertas pendientes" texto="Todas las marcaciones recientes fueron verificadas correctamente." /></Tarjeta>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lista.map((a) => {
            const t = d.trab.get(a.trabajador_id);
            const I = ICONO[a.tipo];
            const grave = a.tipo === 'rostro_no_coincide' || a.tipo === 'prueba_vida';
            return (
              <Tarjeta key={a.id} className={`p-4 ${a.estado === 'nueva' ? (grave ? 'ring-red-200' : 'ring-ambar-200') : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${grave ? 'bg-red-50 text-red-600' : 'bg-ambar-50 text-ambar-700'}`}><I size={20} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`font-bold ${grave ? 'text-red-700' : 'text-ambar-800'}`}>{NOMBRE_ALERTA[a.tipo]}</p>
                      {a.estado !== 'nueva' && <Insignia>{a.estado}</Insignia>}
                    </div>
                    <p className="text-sm text-acero-700">{t ? nombreCompleto(t) : '—'} · {d.obra.get(a.obra_id || '')?.nombre}</p>
                    <p className="text-xs text-acero-500">{fechaCorta(fechaLima(a.fecha))}, {horaLima(a.fecha)} · {hace(a.fecha)}</p>
                  </div>
                </div>
                {(a.tipo === 'rostro_no_coincide' || a.tipo === 'prueba_vida') && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <FotoEvidencia ruta={t?.foto_enrolamiento ?? null} className="aspect-[4/3]" etiqueta="Rostro registrado" />
                    <FotoEvidencia ruta={a.foto} className="aspect-[4/3] ring-2 ring-red-300" etiqueta="Quien intentó marcar" />
                  </div>
                )}
                <p className="mt-3 text-sm text-acero-700">{a.detalle}</p>
                {a.similitud != null && a.tipo === 'rostro_no_coincide' && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-acero-500"><span>Coincidencia facial</span><span className="font-semibold text-red-600">{pct(a.similitud)} (mínimo {pct(d.s.config.umbral_similitud)})</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-acero-100"><div className="h-full rounded-full bg-red-500" style={{ width: pct(a.similitud) }} /></div>
                  </div>
                )}
                {a.estado === 'nueva' && (
                  <div className="mt-4 flex gap-2">
                    <Boton variante="primario" className="flex-1" onClick={() => resolver(a, 'revisada')}><Check size={16} /> Revisada</Boton>
                    <Boton variante="secundario" onClick={() => resolver(a, 'descartada')}><X size={16} /> Descartar</Boton>
                  </div>
                )}
              </Tarjeta>
            );
          })}
        </div>
      )}
    </div>
  );
}
