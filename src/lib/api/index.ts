// Elige el modo de datos:
// - "supabase" (en vivo): si hay VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Celular y laptop comparten datos.
// - "local" (respaldo): todo en este navegador. Se fuerza con ?modo=local en la dirección.

import type { Api } from './tipos';
import { crearApiLocal } from './local';
import { crearApiSupabase } from './supabase';

export type { Api } from './tipos';

function conexionGuardada(): { url: string; clave: string } | null {
  try {
    const raw = localStorage.getItem('reap-supabase');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function modoForzado(): 'local' | 'supabase' | null {
  try {
    const q = new URLSearchParams(location.search).get('modo');
    if (q === 'local' || q === 'supabase') { localStorage.setItem('reap-modo', q); return q; }
    const g = localStorage.getItem('reap-modo');
    return g === 'local' || g === 'supabase' ? g : null;
  } catch { return null; }
}

export function datosSupabase(): { url: string; clave: string } | null {
  const env = import.meta.env;
  if (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) return { url: env.VITE_SUPABASE_URL, clave: env.VITE_SUPABASE_ANON_KEY };
  return conexionGuardada();
}

function crear(): Api {
  const sb = datosSupabase();
  const forzado = modoForzado();
  if (sb && forzado !== 'local') return crearApiSupabase(sb.url, sb.clave);
  return crearApiLocal();
}

export const api: Api = crear();

export function cambiarModo(modo: 'local' | 'supabase') {
  try { localStorage.setItem('reap-modo', modo); } catch { /* */ }
  const u = new URL(location.href);
  u.searchParams.delete('modo');
  location.replace(u.toString());
}

export function guardarConexion(url: string, clave: string) {
  localStorage.setItem('reap-supabase', JSON.stringify({ url: url.trim(), clave: clave.trim() }));
  localStorage.setItem('reap-modo', 'supabase');
  location.reload();
}
