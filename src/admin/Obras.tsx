import { useState } from 'react';
import { Crosshair, HardHat, Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { Obra } from '../lib/types';
import { obtenerUbicacion } from '../lib/geo';
import { Boton, Campo, claseInput, Insignia, Modal, Tarjeta, useAviso } from '../ui/comunes';
import Mapa from '../ui/Mapa';
import { useDatos } from './datos';
import { Titulo } from './Panel';

export default function Obras() {
  const d = useDatos();
  const [editar, setEditar] = useState<Obra | 'nueva' | null>(null);
  const [resaltar, setResaltar] = useState<string | null>(null);
  return (
    <div>
      <Titulo titulo="Obras" sub="Cada obra tiene un radio (geocerca). La marca registra si se tomó dentro o fuera."
        acciones={<Boton onClick={() => setEditar('nueva')}><Plus size={16} /> Nueva obra</Boton>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Tarjeta className="p-3"><Mapa obras={d.s.obras.filter((o) => o.activa)} alto={560} resaltar={resaltar} /></Tarjeta>
        <div className="space-y-2">
          {d.s.obras.map((o) => {
            const n = d.trabajadores.filter((t) => t.obra_id === o.id).length;
            return (
              <Tarjeta key={o.id} className="flex items-center gap-3 p-3.5" onMouseEnter={() => setResaltar(o.id)} onMouseLeave={() => setResaltar(null)}>
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-acero-50 text-acero-700"><HardHat size={20} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-acero-900">{o.nombre}</p>
                  <p className="truncate text-xs text-acero-500">{o.direccion}, {o.distrito}</p>
                  <div className="mt-1 flex gap-1"><Insignia tono="azul">Radio {o.radio_m} m</Insignia><Insignia>{n} trabajador(es)</Insignia>{!o.activa && <Insignia tono="gris">inactiva</Insignia>}</div>
                </div>
                <button onClick={() => setEditar(o)} className="rounded-lg p-2 text-acero-500 hover:bg-acero-100" title="Editar"><Pencil size={16} /></button>
              </Tarjeta>
            );
          })}
        </div>
      </div>
      {editar && <FormObra o={editar === 'nueva' ? null : editar} onCerrar={() => setEditar(null)} />}
    </div>
  );
}

function FormObra({ o, onCerrar }: { o: Obra | null; onCerrar: () => void }) {
  const d = useDatos();
  const avisar = useAviso();
  const [f, setF] = useState<Obra>(o || {
    id: '', nombre: '', cliente: '', direccion: '', distrito: '', lat: -12.0972, lng: -77.0365, radio_m: d.s.config.radio_defecto_m, activa: true,
  });
  const [ubicando, setUbicando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const aqui = async () => {
    setUbicando(true);
    try { const u = await obtenerUbicacion({ maxEdadMs: 0, timeoutMs: 15000 }); setF((x) => ({ ...x, lat: u.lat, lng: u.lng })); avisar({ tipo: 'info', titulo: `Ubicación tomada (±${u.precision} m)` }); }
    catch (e) { avisar({ tipo: 'error', titulo: 'No se pudo obtener la ubicación', texto: (e as Error).message }); }
    finally { setUbicando(false); }
  };

  const guardar = async () => {
    if (!f.nombre.trim()) return;
    setGuardando(true);
    try { await api.guardarObra({ ...f, demo: o?.demo ?? false }); await d.recargar(); avisar({ tipo: 'exito', titulo: 'Obra guardada' }); onCerrar(); }
    finally { setGuardando(false); }
  };

  return (
    <Modal abierto onCerrar={onCerrar} titulo={o ? 'Editar obra' : 'Nueva obra'} ancho="max-w-3xl"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}>Guardar</Boton></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Campo etiqueta="Nombre de la obra"><input className={claseInput} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej. Edificio Los Pinos" /></Campo>
          <Campo etiqueta="Cliente / constructora"><input className={claseInput} value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></Campo>
          <Campo etiqueta="Dirección"><input className={claseInput} value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} /></Campo>
          <Campo etiqueta="Distrito"><input className={claseInput} value={f.distrito} onChange={(e) => setF({ ...f, distrito: e.target.value })} /></Campo>
          <Campo etiqueta={`Radio permitido: ${f.radio_m} m`} ayuda="Entre 100 y 200 m funciona bien dentro de edificios.">
            <input type="range" min={50} max={500} step={10} value={f.radio_m} onChange={(e) => setF({ ...f, radio_m: Number(e.target.value) })} className="w-full accent-acero-700" />
          </Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} className="accent-acero-700" /> Obra activa</label>
        </div>
        <div>
          <Mapa obras={[f]} alto={330} onClic={(lat, lng) => setF((x) => ({ ...x, lat, lng }))} centro={[f.lat, f.lng]} resaltar={f.id || null} />
          <p className="mt-2 text-xs text-acero-500">Haz clic en el mapa para ubicar la obra, o usa tu ubicación actual estando en el lugar.</p>
          <Boton variante="secundario" className="mt-2 w-full" cargando={ubicando} onClick={aqui}><Crosshair size={16} /> Usar mi ubicación actual</Boton>
          <p className="mt-2 font-mono text-[11px] text-acero-400">{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</p>
        </div>
      </div>
    </Modal>
  );
}
