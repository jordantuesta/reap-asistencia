import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, UserRound, X } from 'lucide-react';
import { api } from '../lib/api';
import { clsx, iniciales } from '../lib/util';

// ---------------------------------------------------------------- Marca
export function Isotipo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id="iso-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1E4A75" />
          <stop offset="1" stopColor="#0B1A2B" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#iso-g)" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="14" />
      <path d="M256 128 L340 236 H172 Z" fill="#F5A524" />
      <path d="M256 384 L172 276 H340 Z" fill="#fff" />
    </svg>
  );
}

export function Logo({ claro = false, compacto = false }: { claro?: boolean; compacto?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Isotipo size={compacto ? 30 : 38} />
      <div className="leading-none">
        <div className={clsx('font-extrabold tracking-tight', compacto ? 'text-base' : 'text-lg', claro ? 'text-white' : 'text-acero-900')}>
          REAP <span className="text-ambar-500">Asistencia</span>
        </div>
        {!compacto && <div className={clsx('mt-1 text-[10px] font-semibold uppercase tracking-[0.2em]', claro ? 'text-white/50' : 'text-acero-500/70')}>Control en obra</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Básicos
type Variante = 'primario' | 'acento' | 'secundario' | 'fantasma' | 'peligro' | 'exito';
export function Boton({ variante = 'primario', className, cargando, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  const estilos: Record<Variante, string> = {
    primario: 'bg-acero-800 text-white hover:bg-acero-700 active:bg-acero-900',
    acento: 'bg-ambar-500 text-acero-950 hover:bg-ambar-400 active:bg-ambar-600',
    secundario: 'bg-white text-acero-800 ring-1 ring-acero-200 hover:bg-acero-50',
    fantasma: 'text-acero-700 hover:bg-acero-100',
    peligro: 'bg-red-600 text-white hover:bg-red-500',
    exito: 'bg-emerald-600 text-white hover:bg-emerald-500',
  };
  return (
    <button
      {...p}
      disabled={p.disabled || cargando}
      className={clsx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50', estilos[variante], className)}
    >
      {cargando && <Loader2 size={16} className="girar" />}
      {children}
    </button>
  );
}

export function Tarjeta({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={clsx('rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,42,68,0.06),0_8px_24px_-12px_rgba(15,42,68,0.15)] ring-1 ring-acero-100', className)}>{children}</div>;
}

type Tono = 'gris' | 'verde' | 'rojo' | 'ambar' | 'azul' | 'violeta';
export function Insignia({ tono = 'gris', children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  const t: Record<Tono, string> = {
    gris: 'bg-slate-100 text-slate-600',
    verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rojo: 'bg-red-50 text-red-700 ring-red-200',
    ambar: 'bg-ambar-50 text-ambar-700 ring-ambar-200',
    azul: 'bg-acero-50 text-acero-700 ring-acero-200',
    violeta: 'bg-violet-50 text-violet-700 ring-violet-200',
  };
  return <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-transparent', t[tono], className)}>{children}</span>;
}

export function Avatar({ nombres, apellidos, foto, size = 40, color }: { nombres: string; apellidos: string; foto?: string | null; size?: number; color?: string }) {
  const url = useFoto(foto);
  if (url) return <img src={url} alt="" className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />;
  return (
    <div className="grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white" style={{ width: size, height: size, fontSize: size * 0.36, background: color || '#2A5580' }}>
      {iniciales(nombres, apellidos)}
    </div>
  );
}

/** Resuelve una foto guardada (dataURL local o ruta privada de Supabase). */
export function useFoto(ruta: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(ruta?.startsWith('data:') ? ruta : null);
  useEffect(() => {
    let vivo = true;
    if (!ruta) { setUrl(null); return; }
    if (ruta.startsWith('data:')) { setUrl(ruta); return; }
    api.urlFoto(ruta).then((u) => { if (vivo) setUrl(u); }).catch(() => {});
    return () => { vivo = false; };
  }, [ruta]);
  return url;
}

export function FotoEvidencia({ ruta, className, etiqueta }: { ruta: string | null | undefined; className?: string; etiqueta?: string }) {
  const url = useFoto(ruta);
  return (
    <div className={clsx('relative overflow-hidden rounded-xl bg-acero-100', className)}>
      {url ? (
        <img src={url} alt="Foto de evidencia" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-acero-400">
          <UserRound size={30} />
          <span className="px-2 text-center text-[10px] font-medium">{ruta === undefined ? '' : 'Foto de demostración'}</span>
        </div>
      )}
      {etiqueta && <span className="absolute left-2 top-2 rounded-md bg-acero-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{etiqueta}</span>}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…', className }: { texto?: string; className?: string }) {
  return (
    <div className={clsx('flex items-center justify-center gap-2 py-10 text-sm text-acero-500', className)}>
      <Loader2 size={18} className="girar" /> {texto}
    </div>
  );
}

export function Vacio({ icono, titulo, texto }: { icono?: ReactNode; titulo: string; texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      {icono && <div className="grid h-12 w-12 place-items-center rounded-full bg-acero-50 text-acero-400">{icono}</div>}
      <p className="font-semibold text-acero-800">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-acero-500">{texto}</p>}
    </div>
  );
}

export function Modal({ abierto, onCerrar, titulo, children, ancho = 'max-w-lg', pie }: { abierto: boolean; onCerrar: () => void; titulo: ReactNode; children: ReactNode; ancho?: string; pie?: ReactNode }) {
  useEffect(() => {
    if (!abierto) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [abierto, onCerrar]);
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-acero-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onCerrar}>
      <div className={clsx('entrar flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl', ancho)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-acero-100 px-5 py-4">
          <div className="text-base font-bold text-acero-900">{titulo}</div>
          <button onClick={onCerrar} className="-mr-1 rounded-lg p-1 text-acero-400 hover:bg-acero-50 hover:text-acero-700" aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="scroll-fino overflow-y-auto px-5 py-4">{children}</div>
        {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-acero-100 px-5 py-3">{pie}</div>}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-acero-700">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px] text-acero-500">{ayuda}</span>}
    </label>
  );
}

export const claseInput = 'w-full rounded-xl border-0 bg-acero-50/70 px-3 py-2.5 text-sm text-acero-900 ring-1 ring-acero-200 placeholder:text-acero-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-acero-500';

// ---------------------------------------------------------------- Avisos (toasts)
interface Aviso { id: number; tipo: 'exito' | 'error' | 'info' | 'alerta'; titulo: string; texto?: string; foto?: string | null }
const CtxAvisos = createContext<(a: Omit<Aviso, 'id'>) => void>(() => {});
export const useAviso = () => useContext(CtxAvisos);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const avisar = useCallback((a: Omit<Aviso, 'id'>) => {
    const id = Date.now() + Math.random();
    setAvisos((xs) => [...xs.slice(-3), { ...a, id }]);
    setTimeout(() => setAvisos((xs) => xs.filter((x) => x.id !== id)), a.tipo === 'alerta' ? 9000 : 4500);
  }, []);
  return (
    <CtxAvisos.Provider value={avisar}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-[80] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2">
        {avisos.map((a) => <TarjetaAviso key={a.id} a={a} onCerrar={() => setAvisos((xs) => xs.filter((x) => x.id !== a.id))} />)}
      </div>
    </CtxAvisos.Provider>
  );
}

function TarjetaAviso({ a, onCerrar }: { a: Aviso; onCerrar: () => void }) {
  const foto = useFoto(a.foto);
  const ic = a.tipo === 'exito' ? <CheckCircle2 className="text-emerald-500" size={20} /> : a.tipo === 'info' ? <Info className="text-acero-500" size={20} /> : <AlertTriangle className={a.tipo === 'alerta' ? 'text-red-500' : 'text-red-500'} size={20} />;
  return (
    <div className={clsx('entrar pointer-events-auto flex gap-3 rounded-2xl bg-white p-3 shadow-xl ring-1', a.tipo === 'alerta' ? 'ring-red-200' : 'ring-acero-100')}>
      {foto ? <img src={foto} className="h-12 w-12 shrink-0 rounded-xl object-cover" alt="" /> : <div className="pt-0.5">{ic}</div>}
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm font-bold', a.tipo === 'alerta' ? 'text-red-700' : 'text-acero-900')}>{a.titulo}</p>
        {a.texto && <p className="mt-0.5 text-xs text-acero-600">{a.texto}</p>}
      </div>
      <button onClick={onCerrar} className="self-start text-acero-300 hover:text-acero-600"><X size={16} /></button>
    </div>
  );
}
