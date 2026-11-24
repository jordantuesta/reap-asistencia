export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Identificador estable de este celular/navegador. */
export function idDispositivo(): string {
  const k = 'reap-dispositivo';
  try {
    let v = localStorage.getItem(k);
    if (!v) { v = uuid(); localStorage.setItem(k, v); }
    return v;
  } catch {
    return 'sin-almacenamiento';
  }
}

export function descripcionDispositivo(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  const m = ua.match(/Android [\d.]+; ([^;)]+)/);
  if (m) return m[1].replace(/Build.*/, '').trim();
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Mac OS X/.test(ua)) return 'Mac';
  return 'Navegador';
}

export function soles(n: number): string {
  return 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return Math.round(n * 100) + '%';
}

export function iniciales(nombres: string, apellidos: string): string {
  return ((nombres[0] || '') + (apellidos[0] || '')).toUpperCase();
}

export function nombreCompleto(t: { nombres: string; apellidos: string }): string {
  return `${t.nombres} ${t.apellidos}`;
}

/** "Carlos Huamán" (primer nombre + primer apellido) */
export function nombreCorto(t: { nombres: string; apellidos: string }): string {
  return `${t.nombres.split(' ')[0]} ${t.apellidos.split(' ')[0]}`;
}

export function codigoAlta(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clsx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(' ');
}

/** Similitud facial: misma fórmula que la librería Human (faceres) y que la función SQL similitud_facial. */
export function similitudFacial(a: number[] | null | undefined, b: number[] | null | undefined): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; sum += d * d; }
  const dist = Math.round(100 * 25 * sum) / 100;
  if (dist === 0) return 1;
  const norm = (1 - Math.sqrt(dist) / 100 - 0.2) / (0.8 - 0.2);
  return Math.round(100 * Math.max(Math.min(norm, 1), 0)) / 100;
}
