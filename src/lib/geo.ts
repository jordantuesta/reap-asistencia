import type { Ubicacion } from './types';

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
export function distanciaM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function textoDistancia(m: number | null | undefined): string {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export class ErrorUbicacion extends Error {
  constructor(public codigo: 'denegado' | 'no_disponible' | 'tiempo' | 'no_soportado', mensaje: string) {
    super(mensaje);
  }
}

/** Pide la ubicación al celular. */
export function obtenerUbicacion(opts: { maxEdadMs?: number; timeoutMs?: number } = {}): Promise<Ubicacion> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new ErrorUbicacion('no_soportado', 'Este celular no permite obtener la ubicación.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        precision: Math.round(p.coords.accuracy),
        hora: new Date(p.timestamp).toISOString(),
      }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) reject(new ErrorUbicacion('denegado', 'Debes permitir el acceso a tu ubicación para marcar.'));
        else if (e.code === e.TIMEOUT) reject(new ErrorUbicacion('tiempo', 'El GPS tardó demasiado. Intenta en un lugar más abierto.'));
        else reject(new ErrorUbicacion('no_disponible', 'No se pudo obtener tu ubicación. Revisa que el GPS esté activo.'));
      },
      { enableHighAccuracy: true, timeout: opts.timeoutMs ?? 12000, maximumAge: opts.maxEdadMs ?? 30000 },
    );
  });
}

/** Sigue la ubicación mientras la pantalla esté abierta. Devuelve la función para detener. */
export function seguirUbicacion(cb: (u: Ubicacion) => void, err?: (e: ErrorUbicacion) => void): () => void {
  if (!('geolocation' in navigator)) {
    err?.(new ErrorUbicacion('no_soportado', 'Este celular no permite obtener la ubicación.'));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => cb({ lat: p.coords.latitude, lng: p.coords.longitude, precision: Math.round(p.coords.accuracy), hora: new Date(p.timestamp).toISOString() }),
    (e) => err?.(new ErrorUbicacion(e.code === e.PERMISSION_DENIED ? 'denegado' : 'no_disponible', e.code === e.PERMISSION_DENIED ? 'Permiso de ubicación denegado.' : 'Ubicación no disponible.')),
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
