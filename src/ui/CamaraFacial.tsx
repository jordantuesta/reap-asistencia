import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Loader2, ScanFace, ShieldCheck, Users, X } from 'lucide-react';
import type { CapturaFacial } from '../lib/types';
import { cargarMotor, capturarFoto, promediar } from '../lib/facial';

type Fase = 'iniciando' | 'encuadre' | 'reto' | 'centro' | 'listo' | 'error';

interface Props {
  titulo: string;
  subtitulo?: string;
  muestras?: number;          // embeddings a promediar (enrolamiento usa más)
  diagnostico?: boolean;
  onListo: (c: CapturaFacial) => void;
  onCancelar: () => void;
}

const TIEMPO_MAX_MS = 30000;

export default function CamaraFacial({ titulo, subtitulo, muestras = 3, diagnostico = false, onListo, onCancelar }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fase, setFase] = useState<Fase>('iniciando');
  const [pista, setPista] = useState('Preparando la cámara…');
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        setFase('iniciando');
        setPista('Activando la cámara…');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        const v = videoRef.current!;
        v.srcObject = stream;
        await new Promise<void>((r) => { if (v.readyState >= 2) r(); else v.onloadeddata = () => r(); });
        await v.play().catch(() => {});
        setPista('Cargando reconocimiento facial…');
        const human = await cargarMotor();
        if (!vivo) return;

        // ---------- bucle de detección
        let fase: Fase = 'encuadre';
        setFase('encuadre');
        const inicio = performance.now();
        let estables = 0;
        let yawBase = 0;
        let maxGiro = 0;
        const embs: number[][] = [];
        const reales: number[] = [];
        const vidas: number[] = [];
        let ultimoEmb: number[] | null = null;
        let frames = 0;
        let t0 = performance.now();
        let fps = 0;

        while (vivo) {
          const r = await human.detect(v);
          if (!vivo) break;
          frames++;
          if (performance.now() - t0 > 1000) { fps = frames; frames = 0; t0 = performance.now(); }
          const caras = r.face || [];
          const vw = v.videoWidth || 640;
          const vh = v.videoHeight || 480;
          const f = caras[0];
          const yaw = f?.rotation?.angle?.yaw ?? 0;
          const tam = f ? Math.min(f.box[2], f.box[3]) / Math.min(vw, vh) : 0;
          const cx = f ? (f.box[0] + f.box[2] / 2) / vw : 0.5;
          const cy = f ? (f.box[1] + f.box[3] / 2) / vh : 0.5;
          const centrado = Math.abs(cx - 0.5) < 0.2 && Math.abs(cy - 0.5) < 0.22;
          const puntaje = f ? (f.faceScore || f.boxScore || 0) : 0;
          if (f?.embedding?.length) ultimoEmb = f.embedding as number[];

          if (diagnostico) {
            setDiag(`rostros ${caras.length} · tamaño ${(tam * 100).toFixed(0)}% · giro ${(yaw * 57.3).toFixed(0)}° · real ${(f?.real ?? 0).toFixed(2)} · vida ${(f?.live ?? 0).toFixed(2)} · conf ${puntaje.toFixed(2)} · ${fps} fps`);
          }

          const transcurrido = performance.now() - inicio;
          if (transcurrido > TIEMPO_MAX_MS) {
            // Encuadró bien pero no completó el giro: se reporta como intento sin prueba de vida.
            if (ultimoEmb && fase === 'reto') {
              onListo({ embedding: ultimoEmb, foto: capturarFoto(v), real: 0, vida: 0, reto_superado: false });
            } else {
              setFase('error');
              setError('No se detectó un rostro. Busca un lugar con más luz e inténtalo de nuevo.');
            }
            break;
          }

          if (caras.length === 0) {
            estables = 0;
            setPista('Ubica tu rostro dentro del óvalo');
          } else if (caras.length > 1) {
            estables = 0;
            setPista('Solo debe aparecer UNA persona frente a la cámara');
          } else if (tam < 0.26) {
            estables = 0;
            setPista('Acerca un poco más el celular');
          } else if (tam > 0.9) {
            estables = 0;
            setPista('Aleja un poco el celular');
          } else if (fase === 'encuadre') {
            if (!centrado) { estables = 0; setPista('Centra tu rostro en el óvalo'); }
            else if (Math.abs(yaw) > 0.22) { estables = 0; setPista('Mira de frente a la cámara'); }
            else {
              estables++;
              setPista('¡Muy bien! No te muevas…');
              setProgreso(Math.min(1, estables / 6) * 0.33);
              if (estables >= 6) { fase = 'reto'; setFase('reto'); yawBase = yaw; maxGiro = 0; estables = 0; }
            }
          } else if (fase === 'reto') {
            setPista('Gira lentamente la cabeza hacia un lado');
            maxGiro = Math.max(maxGiro, Math.abs(yaw - yawBase));
            setProgreso(0.33 + Math.min(1, maxGiro / 0.32) * 0.34);
            if (maxGiro >= 0.32) { fase = 'centro'; setFase('centro'); estables = 0; }
          } else if (fase === 'centro') {
            if (Math.abs(yaw) > 0.18 || !centrado) { setPista('Ahora vuelve a mirar de frente'); }
            else {
              setPista('Verificando…');
              if (f.embedding?.length && puntaje >= 0.5) {
                embs.push(f.embedding as number[]);
                reales.push(f.real ?? 0);
                vidas.push(f.live ?? 0);
              }
              setProgreso(0.67 + Math.min(1, embs.length / muestras) * 0.33);
              if (embs.length >= muestras) {
                const foto = capturarFoto(v);
                const prom = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
                setFase('listo');
                setPista('Listo');
                onListo({ embedding: promediar(embs), foto, real: prom(reales), vida: prom(vidas), reto_superado: true });
                break;
              }
            }
          }
          await new Promise((r) => setTimeout(r, 40));
        }
      } catch (e) {
        if (!vivo) return;
        const nombre = (e as { name?: string })?.name;
        setFase('error');
        if (nombre === 'NotAllowedError') setError('Debes permitir el acceso a la cámara para marcar. Revisa los permisos del navegador.');
        else if (nombre === 'NotFoundError') setError('No se encontró una cámara en este dispositivo.');
        else setError('No se pudo iniciar el reconocimiento facial. ' + String((e as Error)?.message || e));
      }
    })();

    return () => {
      vivo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intento]);

  const colorAro = fase === 'listo' ? '#22c55e' : fase === 'reto' || fase === 'centro' ? '#F5A524' : '#ffffff';
  const R = 46;
  const C = 2 * Math.PI * R;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-acero-950 text-white">
      <div className="safe-top flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ambar-400">{subtitulo || 'Verificación facial'}</p>
          <h2 className="text-lg font-bold leading-tight">{titulo}</h2>
        </div>
        <button onClick={onCancelar} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 active:bg-white/20" aria-label="Cancelar">
          <X size={20} />
        </button>
      </div>

      {/* Pasos */}
      <div className="flex gap-1.5 px-4 pb-3">
        {[
          { k: 'encuadre', t: 'Encuadre', i: ScanFace },
          { k: 'reto', t: 'Prueba de vida', i: ArrowLeftRight },
          { k: 'centro', t: 'Verificación', i: ShieldCheck },
        ].map((p, idx) => {
          const orden = ['iniciando', 'encuadre', 'reto', 'centro', 'listo'];
          const actual = orden.indexOf(fase);
          const mio = orden.indexOf(p.k);
          const hecho = actual > mio;
          const activo = actual === mio;
          const I = p.i;
          return (
            <div key={p.k} className={`flex flex-1 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${hecho ? 'bg-emerald-500/20 text-emerald-300' : activo ? 'bg-ambar-500/20 text-ambar-300' : 'bg-white/5 text-white/40'}`}>
              {hecho ? <Check size={13} /> : <I size={13} />}
              <span className="truncate">{idx + 1}. {p.t}</span>
            </div>
          );
        })}
      </div>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-3xl bg-black">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        {/* Máscara con óvalo */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <mask id="ovalo">
              <rect width="100" height="100" fill="white" />
              <ellipse cx="50" cy="47" rx="31" ry="30" fill="black" />
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(11,26,43,0.62)" mask="url(#ovalo)" />
        </svg>
        <svg className="pointer-events-none absolute inset-0 m-auto h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <ellipse cx="50" cy="47" rx="31" ry="30" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Aro de progreso */}
        <div className="pointer-events-none absolute left-1/2 top-[47%] -translate-x-1/2 -translate-y-1/2" style={{ width: '70%', aspectRatio: '1 / 1.05' }}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke={colorAro} strokeWidth="2.2" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progreso)} style={{ transition: 'stroke-dashoffset .25s, stroke .3s' }} />
          </svg>
        </div>

        {fase === 'reto' && (
          <div className="pointer-events-none absolute inset-x-0 top-[47%] flex -translate-y-1/2 justify-between px-3">
            <span className="animate-pulse text-4xl text-ambar-400">‹</span>
            <span className="animate-pulse text-4xl text-ambar-400">›</span>
          </div>
        )}

        {fase === 'iniciando' && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-white/80">
              <Loader2 className="girar" size={34} />
              <p className="text-sm">{pista}</p>
              <p className="max-w-[16rem] text-center text-xs text-white/50">La primera vez descarga el reconocimiento facial (~13 MB). Luego queda guardado en el celular.</p>
            </div>
          </div>
        )}

        {fase === 'error' && (
          <div className="absolute inset-0 grid place-items-center bg-acero-950/90 p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-red-500/20 text-red-300"><X /></div>
              <p className="text-sm text-white/85">{error}</p>
              <button onClick={() => { setError(null); setProgreso(0); setIntento((n) => n + 1); }} className="rounded-xl bg-ambar-500 px-5 py-2.5 text-sm font-bold text-acero-950">
                Reintentar
              </button>
            </div>
          </div>
        )}

        {diagnostico && diag && (
          <div className="absolute inset-x-2 top-2 rounded-lg bg-black/60 px-2 py-1 font-mono text-[10px] text-lime-300">{diag}</div>
        )}
      </div>

      <div className="safe-bottom px-6 pb-6 pt-4 text-center">
        <p className="min-h-[3.5rem] text-xl font-bold leading-snug">
          {pista === 'Solo debe aparecer UNA persona frente a la cámara' ? (
            <span className="inline-flex items-center gap-2 text-ambar-300"><Users size={22} /> {pista}</span>
          ) : pista}
        </p>
        <p className="mt-1 text-xs text-white/50">Tu foto y ubicación quedan como evidencia de esta marcación.</p>
      </div>
    </div>
  );
}
