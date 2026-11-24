import { useState } from 'react';
import { Building2, Clock, Database, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { api, cambiarModo, datosSupabase, guardarConexion } from '../lib/api';
import type { Config, Empresa } from '../lib/types';
import { Boton, Campo, claseInput, Insignia, Tarjeta, useAviso } from '../ui/comunes';
import { useDatos } from './datos';
import { Titulo } from './Panel';

const DIAS = [['1', 'Lun'], ['2', 'Mar'], ['3', 'Mié'], ['4', 'Jue'], ['5', 'Vie'], ['6', 'Sáb'], ['0', 'Dom']];

export default function Configuracion() {
  const d = useDatos();
  const avisar = useAviso();
  const [c, setC] = useState<Config>(d.s.config);
  const [empresas, setEmpresas] = useState<Empresa[]>(d.s.empresas);
  const [guardando, setGuardando] = useState(false);
  const [cargandoDemo, setCargandoDemo] = useState(false);
  const [sb, setSb] = useState({ url: '', clave: '' });
  const conexion = datosSupabase();

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.guardarConfig(c);
      for (const e of empresas) await api.guardarEmpresa(e);
      await d.recargar();
      avisar({ tipo: 'exito', titulo: 'Configuración guardada' });
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'No se pudo guardar', texto: String((e as Error)?.message || e) });
    } finally { setGuardando(false); }
  };

  const demo = async () => {
    if (!confirm('Se regenerarán los datos de demostración (marcas, alertas y contratos ficticios con fecha de hoy). Lo que hayas creado tú se conserva. ¿Continuar?')) return;
    setCargandoDemo(true);
    try { await api.cargarDemo(); await d.recargar(); avisar({ tipo: 'exito', titulo: 'Datos de demostración actualizados' }); }
    catch (e) { avisar({ tipo: 'error', titulo: 'Error', texto: String((e as Error)?.message || e) }); }
    finally { setCargandoDemo(false); }
  };

  const num = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) });

  return (
    <div>
      <Titulo titulo="Configuración" acciones={<Boton cargando={guardando} onClick={guardar}><Save size={16} /> Guardar cambios</Boton>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Tarjeta className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-acero-900"><Building2 size={18} /> Razones sociales</h2>
          <p className="mt-1 text-xs text-acero-500">El trabajador elige su empresa al ingresar. Reportes y contratos salen con estos datos.</p>
          <div className="mt-4 space-y-4">
            {empresas.map((e, i) => (
              <div key={e.id} className="grid gap-2 rounded-xl bg-acero-50/60 p-3 sm:grid-cols-[1fr_1fr_130px_56px]">
                <Campo etiqueta="Razón social"><input className={claseInput} value={e.nombre} onChange={(x) => setEmpresas(empresas.map((y, j) => (j === i ? { ...y, nombre: x.target.value } : y)))} /></Campo>
                <Campo etiqueta="Nombre corto"><input className={claseInput} value={e.nombre_corto} onChange={(x) => setEmpresas(empresas.map((y, j) => (j === i ? { ...y, nombre_corto: x.target.value } : y)))} /></Campo>
                <Campo etiqueta="RUC"><input className={claseInput} inputMode="numeric" maxLength={11} value={e.ruc} onChange={(x) => setEmpresas(empresas.map((y, j) => (j === i ? { ...y, ruc: x.target.value.replace(/\D/g, '') } : y)))} /></Campo>
                <Campo etiqueta="Color"><input type="color" className="h-[42px] w-full cursor-pointer rounded-xl ring-1 ring-acero-200" value={e.color} onChange={(x) => setEmpresas(empresas.map((y, j) => (j === i ? { ...y, color: x.target.value } : y)))} /></Campo>
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-acero-900"><Clock size={18} /> Horario y horas extra</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Hora de entrada"><input type="time" className={claseInput} value={c.hora_entrada} onChange={(e) => setC({ ...c, hora_entrada: e.target.value })} /></Campo>
            <Campo etiqueta="Hora de salida"><input type="time" className={claseInput} value={c.hora_salida} onChange={(e) => setC({ ...c, hora_salida: e.target.value })} /></Campo>
            <Campo etiqueta="Refrigerio (min)"><input type="number" className={claseInput} value={c.refrigerio_min} onChange={num('refrigerio_min')} /></Campo>
            <Campo etiqueta="Jornada diaria (min)" ayuda="480 = 8 horas"><input type="number" className={claseInput} value={c.jornada_min} onChange={num('jornada_min')} /></Campo>
            <Campo etiqueta="Tolerancia (min)"><input type="number" className={claseInput} value={c.tolerancia_min} onChange={num('tolerancia_min')} /></Campo>
            <Campo etiqueta="Extra mínima (min)" ayuda="Menos de esto no cuenta"><input type="number" className={claseInput} value={c.extra_minimo_min} onChange={num('extra_minimo_min')} /></Campo>
          </div>
          <p className="mb-1.5 mt-4 text-xs font-semibold text-acero-700">Días laborables</p>
          <div className="flex flex-wrap gap-1.5">
            {DIAS.map(([n, t]) => {
              const on = c.dias_laborables.includes(Number(n));
              return <button key={n} onClick={() => setC({ ...c, dias_laborables: on ? c.dias_laborables.filter((x) => x !== Number(n)) : [...c.dias_laborables, Number(n)] })} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${on ? 'bg-acero-800 text-white ring-acero-800' : 'bg-white text-acero-500 ring-acero-200'}`}>{t}</button>;
            })}
          </div>
          <p className="mt-3 text-xs text-acero-500">Sobretasas aplicadas: 25 % (2 primeras horas) y 35 % (desde la tercera). Lo trabajado en días no laborables se registra como extra para revisión.</p>
        </Tarjeta>

        <Tarjeta className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-acero-900"><ShieldCheck size={18} /> Seguridad de la marcación</h2>
          <div className="mt-4 space-y-4">
            <Campo etiqueta={`Coincidencia facial mínima: ${Math.round(c.umbral_similitud * 100)} %`} ayuda="Más alto = más estricto. Recomendado 50–60 %.">
              <input type="range" min={0.4} max={0.8} step={0.01} value={c.umbral_similitud} onChange={(e) => setC({ ...c, umbral_similitud: Number(e.target.value) })} className="w-full accent-acero-700" />
            </Campo>
            <Campo etiqueta={`Prueba de vida mínima: ${Math.round(c.umbral_vida * 100)} %`} ayuda="Detecta fotos o pantallas frente a la cámara. 0 % = solo exige el giro de cabeza.">
              <input type="range" min={0} max={0.8} step={0.05} value={c.umbral_vida} onChange={(e) => setC({ ...c, umbral_vida: Number(e.target.value) })} className="w-full accent-acero-700" />
            </Campo>
            <Campo etiqueta={`Radio por defecto de nuevas obras: ${c.radio_defecto_m} m`}>
              <input type="range" min={50} max={500} step={10} value={c.radio_defecto_m} onChange={num('radio_defecto_m')} className="w-full accent-acero-700" />
            </Campo>
            <label className="flex items-start gap-3 rounded-xl bg-acero-50/60 p-3 text-sm">
              <input type="checkbox" className="mt-0.5 accent-acero-700" checked={c.bloquear_fuera_obra} onChange={(e) => setC({ ...c, bloquear_fuera_obra: e.target.checked })} />
              <span><b>Bloquear marcas fuera de la obra.</b><br /><span className="text-xs text-acero-500">Si está apagado, la marca se acepta como "observada" y se genera una alerta (útil si visitan varias obras).</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-xl bg-acero-50/60 p-3 text-sm">
              <input type="checkbox" className="mt-0.5 accent-acero-700" checked={c.mostrar_diagnostico} onChange={(e) => setC({ ...c, mostrar_diagnostico: e.target.checked })} />
              <span><b>Mostrar valores técnicos en la cámara.</b><br /><span className="text-xs text-acero-500">Para calibrar en pruebas. Apagar en producción.</span></span>
            </label>
          </div>
        </Tarjeta>

        <Tarjeta className="p-5">
          <h2 className="flex items-center gap-2 font-bold text-acero-900"><Database size={18} /> Datos y conexión</h2>
          <div className="mt-3 flex items-center gap-2 text-sm">
            Modo actual: {api.modo === 'supabase' ? <Insignia tono="verde">En vivo (Supabase)</Insignia> : <Insignia>Demostración local</Insignia>}
          </div>
          <p className="mt-2 text-xs text-acero-500">
            {api.modo === 'supabase'
              ? 'Celulares y panel comparten la misma base de datos en la nube, en tiempo real.'
              : 'Los datos viven solo en este navegador. Útil para presentar sin internet.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Boton variante="secundario" cargando={cargandoDemo} onClick={demo}><RefreshCw size={16} /> Regenerar datos de demostración</Boton>
            {conexion && api.modo === 'supabase' && <Boton variante="fantasma" onClick={() => cambiarModo('local')}>Usar modo local</Boton>}
            {conexion && api.modo === 'local' && <Boton variante="fantasma" onClick={() => cambiarModo('supabase')}>Volver a modo en vivo</Boton>}
          </div>
          {!conexion && (
            <div className="mt-5 space-y-2 rounded-xl bg-acero-50/60 p-3">
              <p className="text-xs font-semibold text-acero-700">Conectar Supabase en este navegador (opcional)</p>
              <input className={claseInput} placeholder="URL del proyecto (https://xxxx.supabase.co)" value={sb.url} onChange={(e) => setSb({ ...sb, url: e.target.value })} />
              <input className={claseInput} placeholder="Clave pública (anon key)" value={sb.clave} onChange={(e) => setSb({ ...sb, clave: e.target.value })} />
              <Boton disabled={!sb.url || !sb.clave} onClick={() => guardarConexion(sb.url, sb.clave)}>Conectar</Boton>
              <p className="text-[11px] text-acero-500">Lo recomendado es configurarlo al publicar (archivo .env), así celular y laptop quedan conectados solos.</p>
            </div>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
