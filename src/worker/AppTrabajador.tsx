import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, ChevronRight, Clock3, Delete, FileSignature, Home, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import type { CapturaFacial, Empresa, PerfilTrabajador } from '../lib/types';
import { precargarMotor } from '../lib/facial';
import { idDispositivo } from '../lib/util';
import { Boton, Cargando, Isotipo, Logo, useAviso } from '../ui/comunes';
import CamaraFacial from '../ui/CamaraFacial';
import Inicio from './Inicio';
import Horas from './Horas';
import ContratoTab from './ContratoTab';
import Perfil from './Perfil';

interface Sesion { empresaId: string; dni: string; }
const CLAVE = 'reap-sesion-trabajador';

function leerSesion(): Sesion | null {
  try { const s = localStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; } catch { return null; }
}

export type Pestana = 'inicio' | 'horas' | 'contrato' | 'perfil';

export default function AppTrabajador() {
  const [sesion, setSesion] = useState<Sesion | null>(leerSesion);
  const [perfil, setPerfil] = useState<PerfilTrabajador | null>(null);
  const [cargando, setCargando] = useState(!!sesion);
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const avisar = useAviso();

  useEffect(() => { precargarMotor(); }, []);

  const recargar = useCallback(async () => {
    if (!sesion) return;
    try {
      const p = await api.perfil(sesion.empresaId, sesion.dni);
      if (!p) { localStorage.removeItem(CLAVE); setSesion(null); setPerfil(null); }
      else setPerfil(p);
    } catch {
      // sin conexión: se mantiene el último perfil
    } finally {
      setCargando(false);
    }
  }, [sesion]);

  useEffect(() => { void recargar(); }, [recargar]);

  // Refresca al volver a la app y envía marcas guardadas sin conexión
  useEffect(() => {
    const enviar = async () => {
      const n = await api.enviarPendientes().catch(() => 0);
      if (n > 0) { avisar({ tipo: 'exito', titulo: `Se enviaron ${n} marca(s) guardadas sin conexión` }); void recargar(); }
    };
    const vis = () => { if (document.visibilityState === 'visible') { void recargar(); void enviar(); } };
    window.addEventListener('online', enviar);
    document.addEventListener('visibilitychange', vis);
    void enviar();
    const id = setInterval(() => void recargar(), 45000);
    return () => { window.removeEventListener('online', enviar); document.removeEventListener('visibilitychange', vis); clearInterval(id); };
  }, [recargar, avisar]);

  const salir = () => { localStorage.removeItem(CLAVE); setSesion(null); setPerfil(null); setPestana('inicio'); };

  if (!sesion) {
    return <Ingreso onIngresar={(s, p) => { localStorage.setItem(CLAVE, JSON.stringify(s)); setSesion(s); setPerfil(p); }} />;
  }
  if (cargando || !perfil) return <div className="fondo-marca min-h-full"><Cargando texto="Cargando tu información…" className="min-h-screen text-white/70" /></div>;
  if (!perfil.trabajador.tiene_rostro) return <Enrolamiento perfil={perfil} onListo={recargar} onSalir={salir} />;

  const pendientes = perfil.adendas.filter((a) => a.estado === 'enviada').length;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-papel">
      <div className="flex-1 pb-24">
        {pestana === 'inicio' && <Inicio perfil={perfil} recargar={recargar} irA={setPestana} />}
        {pestana === 'horas' && <Horas perfil={perfil} />}
        {pestana === 'contrato' && <ContratoTab perfil={perfil} recargar={recargar} />}
        {pestana === 'perfil' && <Perfil perfil={perfil} onSalir={salir} />}
      </div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-acero-100 bg-white/95 backdrop-blur">
        <div className="grid grid-cols-4">
          {([
            ['inicio', 'Marcar', Home],
            ['horas', 'Mis horas', Clock3],
            ['contrato', 'Contrato', FileSignature],
            ['perfil', 'Perfil', UserRound],
          ] as const).map(([k, t, I]) => (
            <button key={k} onClick={() => setPestana(k)} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${pestana === k ? 'text-acero-800' : 'text-acero-400'}`}>
              {pestana === k && <span className="absolute top-0 h-0.5 w-10 rounded-full bg-ambar-500" />}
              <I size={21} strokeWidth={pestana === k ? 2.4 : 1.8} />
              {t}
              {k === 'contrato' && pendientes > 0 && <span className="absolute right-[calc(50%-20px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] text-white">{pendientes}</span>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ======================================================================= Ingreso
function Ingreso({ onIngresar }: { onIngresar: (s: Sesion, p: PerfilTrabajador) => void }) {
  const [empresas, setEmpresas] = useState<Empresa[] | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    api.empresas().then(setEmpresas).catch(() => setError('No hay conexión. Revisa tus datos móviles.'));
  }, []);

  const continuar = async () => {
    if (!empresa || dni.length !== 8) return;
    setBuscando(true); setError('');
    try {
      const p = await api.perfil(empresa.id, dni);
      if (!p) setError(`No encontramos el DNI ${dni} en ${empresa.nombre_corto}. Verifica la empresa o consulta con RR. HH.`);
      else onIngresar({ empresaId: empresa.id, dni }, p);
    } catch {
      setError('No hay conexión. Intenta nuevamente.');
    } finally { setBuscando(false); }
  };

  const tecla = (k: string) => {
    setError('');
    if (k === 'borrar') setDni((d) => d.slice(0, -1));
    else setDni((d) => (d.length < 8 ? d + k : d));
  };

  return (
    <div className="fondo-marca rieles flex min-h-full flex-col text-white">
      <div className="safe-top mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-6">
        {!empresa ? (
          <>
            <Logo claro />
            <div className="mt-10">
              <h1 className="text-3xl font-extrabold leading-tight">Hola 👋<br />¿En qué empresa trabajas?</h1>
              <p className="mt-2 text-sm text-white/60">Elige tu razón social. Solo lo harás una vez en este celular.</p>
            </div>
            <div className="mt-8 grid gap-3">
              {!empresas && !error && <Cargando texto="Cargando empresas…" className="text-white/60" />}
              {empresas?.map((e) => (
                <button key={e.id} onClick={() => setEmpresa(e)} className="entrar flex items-center gap-4 rounded-2xl bg-white p-4 text-left text-acero-900 shadow-xl active:scale-[0.99]">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white" style={{ background: e.color }}><Building2 size={22} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{e.nombre_corto}</p>
                    <p className="truncate text-xs text-acero-500">{e.nombre}{e.ruc ? ` · RUC ${e.ruc}` : ''}</p>
                  </div>
                  <ChevronRight className="text-acero-300" />
                </button>
              ))}
              {error && <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}
            </div>
            <p className="mt-auto pt-8 text-center text-[11px] text-white/35">Si eres administrador, ingresa desde el panel web.</p>
          </>
        ) : (
          <>
            <button onClick={() => { setEmpresa(null); setDni(''); setError(''); }} className="-ml-2 flex items-center gap-1 self-start rounded-lg px-2 py-1 text-sm text-white/70">
              <ArrowLeft size={18} /> {empresa.nombre_corto}
            </button>
            <h1 className="mt-6 text-3xl font-extrabold">Ingresa tu DNI</h1>
            <p className="mt-1 text-sm text-white/60">8 dígitos</p>
            <div className="mt-6 flex justify-center gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`grid h-12 w-9 place-items-center rounded-xl text-2xl font-bold tabular ${i < dni.length ? 'bg-white text-acero-900' : 'bg-white/10'} ${i === dni.length ? 'ring-2 ring-ambar-400' : ''}`}>
                  {dni[i] || ''}
                </div>
              ))}
            </div>
            {error && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-center text-sm text-red-200">{error}</p>}
            <div className="mt-auto grid grid-cols-3 gap-2.5 pt-6">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar'].map((k) =>
                k === '' ? <div key="v" /> : (
                  <button key={k} onClick={() => tecla(k)} className="grid h-14 place-items-center rounded-2xl bg-white/10 text-2xl font-bold active:bg-white/25">
                    {k === 'borrar' ? <Delete size={22} /> : k}
                  </button>
                ),
              )}
            </div>
            <Boton variante="acento" className="mt-4 h-14 w-full rounded-2xl text-base" disabled={dni.length !== 8} cargando={buscando} onClick={continuar}>
              Continuar
            </Boton>
          </>
        )}
      </div>
    </div>
  );
}

// ======================================================================= Enrolamiento
function Enrolamiento({ perfil, onListo, onSalir }: { perfil: PerfilTrabajador; onListo: () => void; onSalir: () => void }) {
  const [paso, setPaso] = useState<'consentimiento' | 'codigo' | 'camara' | 'guardando' | 'listo'>('consentimiento');
  const [acepto, setAcepto] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const t = perfil.trabajador;

  const alCapturar = async (c: CapturaFacial) => {
    if (!c.reto_superado) { setPaso('codigo'); setError('No se completó la prueba de vida. Inténtalo de nuevo frente a la cámara, con buena luz.'); return; }
    setPaso('guardando');
    try {
      const r = await api.enrolar(t.id, codigo, c, idDispositivo());
      if (r.ok) setPaso('listo');
      else { setError(r.mensaje); setPaso('codigo'); }
    } catch (e) {
      setError('No se pudo guardar. ' + String((e as Error)?.message || ''));
      setPaso('codigo');
    }
  };

  if (paso === 'camara') {
    return <CamaraFacial titulo="Registro de tu rostro" subtitulo="Alta del trabajador" muestras={5} diagnostico={perfil.config.mostrar_diagnostico} onListo={alCapturar} onCancelar={() => setPaso('codigo')} />;
  }

  return (
    <div className="fondo-marca flex min-h-full flex-col text-white">
      <div className="safe-top mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <Isotipo size={34} />
          <button onClick={onSalir} className="text-xs text-white/50 underline">No soy {t.nombres.split(' ')[0]}</button>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-ambar-400">Primera vez · {perfil.empresa.nombre_corto}</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">Hola, {t.nombres.split(' ')[0]}.<br />Registremos tu rostro.</h1>

        {paso === 'consentimiento' && (
          <div className="entrar mt-6 flex flex-1 flex-col">
            <div className="rounded-2xl bg-white p-4 text-sm text-acero-800">
              <p className="flex items-center gap-2 font-bold text-acero-900"><ShieldCheck size={18} className="text-emerald-600" /> Consentimiento para datos biométricos</p>
              <p className="mt-2 text-[13px] leading-relaxed text-acero-600">
                Autorizo a <b>{perfil.empresa.nombre}</b> a registrar y tratar mi imagen facial, mi ubicación y la hora de mis marcaciones
                con la única finalidad de controlar mi asistencia y firmar documentos laborales, conforme a la Ley N.° 29733 de
                Protección de Datos Personales. Mis datos no se comparten con terceros y puedo solicitar su acceso, rectificación
                o cancelación a RR. HH.
              </p>
            </div>
            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white/10 p-4 text-sm">
              <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-0.5 h-5 w-5 accent-ambar-500" />
              <span>He leído y <b>acepto</b> el tratamiento de mis datos biométricos.</span>
            </label>
            <Boton variante="acento" className="mt-auto h-14 w-full rounded-2xl text-base" disabled={!acepto} onClick={() => setPaso('codigo')}>Continuar</Boton>
          </div>
        )}

        {paso === 'codigo' && (
          <div className="entrar mt-6 flex flex-1 flex-col">
            <p className="text-sm text-white/70">Ingresa el <b className="text-white">código de alta</b> que te dio RR. HH. o tu supervisor. Así nadie puede registrar su rostro con tu DNI.</p>
            <input
              inputMode="numeric" autoFocus maxLength={6} value={codigo}
              onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="000000"
              className="mt-5 w-full rounded-2xl bg-white px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.4em] text-acero-900 outline-none ring-ambar-400 focus:ring-4"
            />
            {error && <p className="mt-3 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">{error}</p>}
            <div className="mt-6 rounded-2xl bg-white/[0.07] p-4 text-sm text-white/75">
              <p className="font-semibold text-white">Para un buen registro:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
                <li>Busca buena luz, sin contraluz.</li>
                <li>Sin casco, lentes oscuros ni mascarilla.</li>
                <li>Solo tú frente a la cámara.</li>
              </ul>
            </div>
            <Boton variante="acento" className="mt-auto h-14 w-full rounded-2xl text-base" disabled={codigo.length !== 6} onClick={() => setPaso('camara')}>Abrir cámara</Boton>
          </div>
        )}

        {paso === 'guardando' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/80"><Loader2 className="girar" size={36} /> Guardando tu registro…</div>
        )}

        {paso === 'listo' && (
          <div className="entrar flex flex-1 flex-col items-center justify-center text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-emerald-500 text-5xl shadow-[0_0_0_12px_rgba(16,185,129,0.15)]">✓</div>
            <h2 className="mt-6 text-2xl font-extrabold">¡Rostro registrado!</h2>
            <p className="mt-2 max-w-xs text-sm text-white/65">Desde ahora solo tú puedes marcar tu asistencia. Este celular quedó vinculado a tu cuenta.</p>
            <Boton variante="acento" className="mt-8 h-14 w-full rounded-2xl text-base" onClick={onListo}>Ir a marcar</Boton>
          </div>
        )}
      </div>
    </div>
  );
}
