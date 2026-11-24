import { Download, LogOut, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import { api } from '../lib/api';
import type { PerfilTrabajador } from '../lib/types';
import { fechaNum, fechaLima } from '../lib/tiempo';
import { descripcionDispositivo, idDispositivo, nombreCompleto } from '../lib/util';
import { Avatar, Boton, Insignia } from '../ui/comunes';
import { useInstalar } from '../ui/instalar';

export default function Perfil({ perfil, onSalir }: { perfil: PerfilTrabajador; onSalir: () => void }) {
  const t = perfil.trabajador;
  const inst = useInstalar();
  const esteCelular = t.dispositivo_id === idDispositivo();
  return (
    <div className="safe-top px-4 pb-6 pt-5">
      <h1 className="text-2xl font-extrabold text-acero-900">Mi perfil</h1>
      <div className="mt-4 flex items-center gap-4 rounded-3xl bg-white p-5 ring-1 ring-acero-100">
        <Avatar nombres={t.nombres} apellidos={t.apellidos} foto={t.foto_enrolamiento} size={64} color={perfil.empresa.color} />
        <div className="min-w-0">
          <p className="text-lg font-extrabold leading-tight text-acero-900">{nombreCompleto(t)}</p>
          <p className="text-sm text-acero-500">{t.cargo}</p>
          <p className="mt-1 text-xs text-acero-400">DNI {t.dni}</p>
        </div>
      </div>

      <div className="mt-3 divide-y divide-acero-100 rounded-3xl bg-white ring-1 ring-acero-100">
        <Item k="Empresa" v={perfil.empresa.nombre} />
        <Item k="Obra" v={perfil.obra?.nombre || '—'} />
        <Item k="Rostro registrado" v={t.enrolado_at ? fechaNum(fechaLima(t.enrolado_at)) : '—'} extra={<Insignia tono="verde"><ShieldCheck size={12} /> Activo</Insignia>} />
        <Item k="Celular vinculado" v={esteCelular ? `Este celular (${descripcionDispositivo()})` : 'Otro celular'} extra={esteCelular ? <Smartphone size={16} className="text-emerald-600" /> : <Insignia tono="ambar">Distinto</Insignia>} />
        <Item k="Conexión" v={api.modo === 'supabase' ? 'En línea con la central' : 'Modo demostración (local)'} extra={<Wifi size={16} className={api.modo === 'supabase' ? 'text-emerald-600' : 'text-acero-400'} />} />
      </div>

      {!inst.instalada && (
        <div className="mt-3 rounded-3xl bg-acero-900 p-5 text-white">
          <p className="flex items-center gap-2 font-bold"><Download size={18} className="text-ambar-400" /> Instala la app</p>
          {inst.disponible ? (
            <>
              <p className="mt-1 text-sm text-white/70">Ábrela como cualquier app, desde tu pantalla de inicio.</p>
              <Boton variante="acento" className="mt-3 w-full" onClick={() => inst.instalar()}>Instalar REAP Asistencia</Boton>
            </>
          ) : inst.ios ? (
            <p className="mt-1 text-sm text-white/70">En Safari toca <b>Compartir</b> y luego <b>"Agregar a inicio"</b>.</p>
          ) : (
            <p className="mt-1 text-sm text-white/70">En el menú del navegador (⋮) elige <b>"Instalar app"</b> o <b>"Agregar a pantalla de inicio"</b>.</p>
          )}
        </div>
      )}

      <Boton variante="secundario" className="mt-4 w-full" onClick={onSalir}><LogOut size={16} /> Cambiar de usuario</Boton>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-acero-400">
        Tus datos biométricos se usan solo para tu asistencia (Ley 29733).<br />REAP Asistencia · versión demo 1.0
      </p>
    </div>
  );
}

function Item({ k, v, extra }: { k: string; v: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-acero-400">{k}</p>
        <p className="truncate text-sm font-semibold text-acero-800">{v}</p>
      </div>
      {extra}
    </div>
  );
}
