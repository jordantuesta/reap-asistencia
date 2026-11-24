// Motor de reconocimiento facial (librería Human, corre 100 % en el celular).
// Modelos usados (carpeta public/models, ~13 MB, quedan guardados tras la primera carga):
//  - blazeface: detección de rostros   - facemesh + iris: puntos del rostro y giro de cabeza
//  - faceres: huella facial (1024 valores) - antispoof + liveness: detectan fotos/pantallas

import type { Human } from '@vladmandic/human';

let motor: Promise<Human> | null = null;
let estado: 'sin_cargar' | 'cargando' | 'listo' | 'error' = 'sin_cargar';

export function estadoMotor() { return estado; }

export function cargarMotor(): Promise<Human> {
  if (motor) return motor;
  estado = 'cargando';
  motor = (async () => {
    const H = await import('@vladmandic/human');
    const config = {
      modelBasePath: new URL('models/', document.baseURI).href,
      debug: false,
      cacheSensitivity: 0.01,
      warmup: 'face',
      filter: { enabled: true, equalization: true },
      face: {
        enabled: true,
        detector: { rotation: true, return: false, maxDetected: 2, minConfidence: 0.45 },
        mesh: { enabled: true },
        iris: { enabled: true },
        description: { enabled: true },
        emotion: { enabled: false },
        antispoof: { enabled: true },
        liveness: { enabled: true },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      segmentation: { enabled: false },
      gesture: { enabled: true },
    };
    const human = new H.Human(config as never);
    await human.load();
    await human.warmup();
    estado = 'listo';
    return human;
  })().catch((e) => {
    motor = null;
    estado = 'error';
    throw e;
  });
  return motor;
}

/** Descarga los modelos en segundo plano (para que la cámara abra rápido después). */
export function precargarMotor() {
  if (estado === 'sin_cargar') cargarMotor().catch(() => {});
}

export function promediar(embs: number[][]): number[] {
  const n = embs.length;
  const out = new Array(embs[0].length).fill(0);
  for (const e of embs) for (let i = 0; i < e.length; i++) out[i] += e[i] / n;
  return out;
}

export function capturarFoto(video: HTMLVideoElement, ancho = 480): string {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = Math.round((h / w) * ancho);
  const ctx = c.getContext('2d')!;
  // Se guarda como espejo (igual a lo que el trabajador ve en pantalla)
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}
