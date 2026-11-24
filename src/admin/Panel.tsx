import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BellRing, Building, Clock4, FileSignature, FileSpreadsheet, HardHat, ListChecks, LogOut, QrCode, Settings, Smartphone, Users,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Alerta, EventoTiempoReal, Marcacion, Snapshot } from '../lib/types';
import { NOMBRE_ALERTA, NOMBRE_MARCA } from '../lib/types';
import { fechaLima, horaLima, sumarDias } from '../lib/tiempo';
import { nombreCorto, pct } from '../lib/util';
import { Boton, Cargando, Campo, claseInput, Logo, Modal, useAviso } from '../ui/comunes';
import QR, { urlApp } from '../ui/QR';
import { CtxDatos, type Datos } from './datos';
import EnVivo from './EnVivo';
import Marcaciones from './Marcaciones';
import Alertas from './Alertas';
import HorasExtra from './HorasExtra';
import Trabajadores from './Trabajadores';
import Obras from './Obras';
import Contratos from './Contratos';
import Reportes from './Reportes';
import Configuracion from './Configuracion';

const MENU = [
  { a: '', t: 'En vivo', i: Activity },
  { a: 'alertas', t: 'Alertas', i: BellRing },
  { a: 'marcaciones', t: 'Marcaciones', i: ListChecks },
  { a: 'horas-extra', t: 'Horas extra', i: Clock4 },
  { a: 'contratos', t: 'Contratos', i: FileSignature },
  { a: 'trabajadores', t: 'Trabajadores', i: Users },
  { a: 'obras', t: 'Obras', i: HardHat },
  { a: 'reportes', t: 'Reportes', i: FileSpreadsheet },
  { a: 'configuracion', t: 'Configuración', i: Settings },
];

export default function Panel() {
  const [sesion, setSesion] = useState<{ email: string } | null | undefined>(undefined);
  useEffect(() => { api.sesionAdmin().then(setSesion).catch(() => setSesion(null)); }, []);
  if (sesion === undefined) return <Cargando className="min-h-screen" />;
  if (!sesion) return <Ingreso onListo={() => api.sesionAdmin().then(setSesion)} />;
  return <PanelInterno email={sesion.email} onSalir={async () => { await api.salirAdmin(); setSesion(null); }} />;
}

function Ingreso({ onListo }: { onListo: () => void }) {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const local = api.modo === 'local';
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true); setError('');
    const r = await api.ingresarAdmin(email, clave);
    setCargando(false);
    if (r.ok) onListo(); else setError(r.mensaje);
  };
  return (
    <div className="fondo-marca rieles grid min-h-full place-items-center p-4">
      <form onSubmit={enviar} className="entrar w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <Logo />
        <h1 className="mt-6 text-xl font-extrabold text-acero-900">Panel de administración</h1>
        <p className="mt-1 text-sm text-acero-500">RR. HH., supervisores y gerencia.</p>
        {local ? (
          <>
            <p className="mt-5 rounded-xl bg-acero-50 p-3 text-xs text-acero-600">Modo demostración: los datos viven en este navegador. No se necesita contraseña.</p>
            <Boton type="submit" className="mt-5 w-full" cargando={cargando}>Entrar al panel</Boton>
          </>
        ) : (
          <div className="mt-5 space-y-3">
            <Campo etiqueta="Correo"><input className={claseInput} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Campo>
            <Campo etiqueta="Contraseña"><input className={claseInput} type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required /></Campo>
            {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <Boton type="submit" className="w-full" cargando={cargando}>Ingresar</Boton>
          </div>
        )}
      </form>
    </div>
  );
}

function PanelInterno({ email, onSalir }: { email: string; onSalir: () => void }) {
  const [s, setS] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [empresa, setEmpresa] = useState<string>(() => { try { return localStorage.getItem('reap-filtro-empresa') || 'todas'; } catch { return 'todas'; } });
  const [actualizado, setActualizado] = useState(Date.now());
  const [qr, setQr] = useState(false);
  const avisar = useAviso();
  const sRef = useRef<Snapshot | null>(null);
  sRef.current = s;
  const navegar = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  const recargar = useCallback(async () => {
    try {
      const x = await api.snapshot(sumarDias(fechaLima(), -35));
      setS(x); setActualizado(Date.now()); setError('');
    } catch (e) {
      setError(String((e as Error)?.message || e));
    }
  }, []);

  useEffect(() => { void recargar(); }, [recargar]);
  useEffect(() => { try { localStorage.setItem('reap-filtro-empresa', empresa); } catch { /* */ } }, [empresa]);

  // Tiempo real: avisos y recarga
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const programar = () => { if (t) clearTimeout(t); t = setTimeout(() => void recargar(), 500); };
    const off = api.suscribir((e: EventoTiempoReal) => {
      const snap = sRef.current;
      const nombre = (id: string) => { const w = snap?.trabajadores.find((x) => x.id === id); return w ? nombreCorto(w) : 'Trabajador nuevo'; };
      if (e.tipo === 'alerta' && e.dato) {
        const a = e.dato as Alerta;
        avisar({ tipo: 'alerta', titulo: `🚨 ${NOMBRE_ALERTA[a.tipo]} · ${nombre(a.trabajador_id)}`, texto: a.detalle, foto: a.foto });
      } else if (e.tipo === 'marcacion' && e.dato) {
        const m = e.dato as Marcacion;
        const obra = snap?.obras.find((o) => o.id === m.obra_id)?.nombre;
        avisar({ tipo: m.estado === 'observada' ? 'info' : 'exito', titulo: `${nombre(m.trabajador_id)} · ${NOMBRE_MARCA[m.tipo]} ${horaLima(m.hora_marca)}`, texto: `${obra || ''} · rostro ${pct(m.similitud)}${m.dentro_obra === false ? ' · FUERA DE OBRA' : ''}`, foto: m.foto });
      } else if (e.tipo === 'adenda' && e.dato && (e.dato as { estado?: string }).estado === 'firmada') {
        avisar({ tipo: 'exito', titulo: 'Adenda firmada', texto: nombre((e.dato as { trabajador_id: string }).trabajador_id) + ' firmó su renovación con reconocimiento facial.' });
      }
      programar();
    });
    const id = setInterval(() => void recargar(), 60000);
    return () => { off(); clearInterval(id); if (t) clearTimeout(t); };
  }, [recargar, avisar]);

  if (!s) {
    return (
      <div className="grid min-h-full place-items-center p-6 text-center">
        {error ? (
          <div className="max-w-md">
            <p className="font-bold text-red-700">No se pudieron cargar los datos</p>
            <p className="mt-2 text-sm text-acero-600">{error}</p>
            <p className="mt-2 text-xs text-acero-500">Si es la primera vez, revisa que el script de Supabase se haya ejecutado (docs/PUBLICAR.md).</p>
            <div className="mt-4 flex justify-center gap-2"><Boton onClick={() => void recargar()}>Reintentar</Boton><Boton variante="secundario" onClick={onSalir}>Salir</Boton></div>
          </div>
        ) : <Cargando texto="Cargando panel…" />}
      </div>
    );
  }

  const nuevas = s.alertas.filter((a) => a.estado === 'nueva' && (empresa === 'todas' || a.empresa_id === empresa)).length;
  const valor: Datos = { s, recargar, empresa, setEmpresa, actualizado };

  return (
    <CtxDatos.Provider value={valor}>
      <div className="flex min-h-full bg-papel">
        {/* Barra lateral */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-acero-950 px-3 py-5 text-white lg:flex">
          <div className="px-2"><Logo claro compacto /></div>
          <nav className="mt-7 flex-1 space-y-0.5">
            {MENU.map(({ a, t, i: I }) => (
              <NavLink key={a} to={a ? '/admin/' + a : '/admin'} end={a === ''} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}>
                <I size={18} /> <span className="flex-1">{t}</span>
                {a === 'alertas' && nuevas > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold">{nuevas}</span>}
              </NavLink>
            ))}
          </nav>
          <button onClick={() => setQr(true)} className="mb-3 flex items-center gap-3 rounded-xl bg-ambar-500/15 px-3 py-2.5 text-sm font-semibold text-ambar-300 hover:bg-ambar-500/25">
            <QrCode size={18} /> App en el celular
          </button>
          <div className="border-t border-white/10 px-2 pt-3 text-xs text-white/50">
            <p className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${api.modo === 'supabase' ? 'bg-emerald-400' : 'bg-white/40'}`} />
              {api.modo === 'supabase' ? 'En vivo · Supabase' : 'Modo demostración'}
            </p>
            <p className="mt-1 truncate">{email}</p>
            <button onClick={onSalir} className="mt-2 flex items-center gap-1.5 text-white/60 hover:text-white"><LogOut size={14} /> Cerrar sesión</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Barra superior */}
          <header className="sticky top-0 z-30 border-b border-acero-100 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
              <div className="lg:hidden"><Logo compacto /></div>
              <div className="ml-auto flex items-center gap-1 rounded-xl bg-acero-50 p-1 ring-1 ring-acero-100">
                <BotonFiltro activo={empresa === 'todas'} onClick={() => setEmpresa('todas')}><Building size={14} /> Todas</BotonFiltro>
                {s.empresas.map((e) => (
                  <BotonFiltro key={e.id} activo={empresa === e.id} onClick={() => setEmpresa(e.id)}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: e.color }} /> <span className="hidden sm:inline">{e.nombre_corto}</span><span className="sm:hidden">{e.nombre_corto.split(' ').pop()}</span>
                  </BotonFiltro>
                ))}
              </div>
              <button onClick={() => setQr(true)} className="grid h-9 w-9 place-items-center rounded-xl text-acero-600 ring-1 ring-acero-200 lg:hidden" aria-label="App en el celular"><Smartphone size={18} /></button>
            </div>
            <nav className="scroll-fino flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
              {MENU.map(({ a, t }) => (
                <NavLink key={a} to={a ? '/admin/' + a : '/admin'} end={a === ''} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${isActive ? 'bg-acero-800 text-white' : 'text-acero-600'}`}>
                  {t}{a === 'alertas' && nuevas > 0 ? ` (${nuevas})` : ''}
                </NavLink>
              ))}
            </nav>
          </header>

          <main className="px-4 py-6 lg:px-8">
            <Routes>
              <Route index element={<EnVivo />} />
              <Route path="alertas" element={<Alertas />} />
              <Route path="marcaciones" element={<Marcaciones />} />
              <Route path="horas-extra" element={<HorasExtra />} />
              <Route path="contratos" element={<Contratos />} />
              <Route path="trabajadores" element={<Trabajadores />} />
              <Route path="obras" element={<Obras />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="configuracion" element={<Configuracion />} />
              <Route path="*" element={<EnVivo />} />
            </Routes>
          </main>
        </div>
      </div>

      <Modal abierto={qr} onCerrar={() => setQr(false)} titulo="Instalar la app en el celular" ancho="max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl p-3 ring-1 ring-acero-100"><QR texto={urlApp()} size={220} /></div>
          <p className="mt-4 text-sm text-acero-700">Escanea con la cámara del celular. Se abre la app del trabajador; luego toca <b>"Instalar"</b> o <b>"Agregar a inicio"</b>.</p>
          <p className="mt-2 break-all font-mono text-[11px] text-acero-400">{urlApp()}</p>
          <Boton variante="secundario" className="mt-4" onClick={() => { setQr(false); navegar('/admin/trabajadores'); }}>Ver códigos de alta</Boton>
        </div>
      </Modal>
    </CtxDatos.Provider>
  );
}

function BotonFiltro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${activo ? 'bg-white text-acero-900 shadow-sm ring-1 ring-acero-100' : 'text-acero-500 hover:text-acero-800'}`}>
      {children}
    </button>
  );
}

export function Titulo({ titulo, sub, acciones }: { titulo: string; sub?: React.ReactNode; acciones?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-acero-900">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-acero-500">{sub}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}
