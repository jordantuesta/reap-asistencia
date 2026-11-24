// Soporte para "Instalar app" (PWA) en Android/Chrome y guía para iPhone.
import { useEffect, useState } from 'react';

interface EventoInstalar extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }

let evento: EventoInstalar | null = null;
const oyentes = new Set<() => void>();

export function escucharInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    evento = e as EventoInstalar;
    oyentes.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => { evento = null; oyentes.forEach((f) => f()); });
}

export function esInstalada(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function esIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export function useInstalar() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    oyentes.add(f);
    return () => { oyentes.delete(f); };
  }, []);
  return {
    disponible: !!evento,
    instalada: esInstalada(),
    ios: esIOS(),
    async instalar() {
      if (!evento) return false;
      await evento.prompt();
      const r = await evento.userChoice;
      evento = null;
      return r.outcome === 'accepted';
    },
  };
}
