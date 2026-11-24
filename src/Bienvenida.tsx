import { Link } from 'react-router-dom';
import { ArrowRight, Fingerprint, LayoutDashboard, MapPin, ScanFace, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from './lib/api';
import { Logo } from './ui/comunes';
import QR, { urlApp } from './ui/QR';

export default function Bienvenida() {
  const enVivo = api.modo === 'supabase';
  return (
    <div className="fondo-marca rieles min-h-full text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <Logo claro />
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${enVivo ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30' : 'bg-white/5 text-white/60 ring-white/15'}`}>
            {enVivo ? '● En vivo' : 'Modo demostración'}
          </span>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.15fr_1fr]">
          <section>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-ambar-500/15 px-3 py-1 text-xs font-semibold text-ambar-300 ring-1 ring-ambar-400/30">
              <ShieldCheck size={14} /> Propuesta para Corporación REAP
            </p>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Cada marca, <span className="text-ambar-400">de la persona correcta</span>, en la obra correcta.
            </h1>
            <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
              Control de asistencia desde el celular con reconocimiento facial, prueba de vida y geolocalización.
              Nadie puede marcar por su compañero.
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { i: ScanFace, t: 'Rostro verificado', d: 'contra su foto de alta' },
                { i: Fingerprint, t: 'Prueba de vida', d: 'una foto no sirve' },
                { i: MapPin, t: 'Geolocalización', d: 'dónde se tomó y se subió' },
              ].map(({ i: I, t, d }) => (
                <div key={t} className="rounded-2xl bg-white/[0.06] p-3.5 ring-1 ring-white/10">
                  <I size={20} className="text-ambar-400" />
                  <p className="mt-2 text-sm font-bold">{t}</p>
                  <p className="text-xs text-white/55">{d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <Link to="/app" className="group flex items-center gap-4 rounded-3xl bg-white p-5 text-acero-900 shadow-2xl transition hover:-translate-y-0.5">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ambar-500 text-acero-950"><Smartphone size={26} /></div>
              <div className="flex-1">
                <p className="text-lg font-extrabold">App del trabajador</p>
                <p className="text-sm text-acero-500">Marcar entrada, refrigerio y salida. Ver horas y firmar contratos.</p>
              </div>
              <ArrowRight className="text-acero-300 transition group-hover:translate-x-1 group-hover:text-acero-700" />
            </Link>
            <Link to="/admin" className="group flex items-center gap-4 rounded-3xl bg-acero-800/80 p-5 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-acero-800">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-white"><LayoutDashboard size={26} /></div>
              <div className="flex-1">
                <p className="text-lg font-extrabold">Panel de administración</p>
                <p className="text-sm text-white/60">Asistencia en vivo, alertas de fraude, horas extra, contratos y reportes.</p>
              </div>
              <ArrowRight className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white" />
            </Link>

            <div className="hidden items-center gap-5 rounded-3xl bg-white/[0.06] p-5 ring-1 ring-white/10 sm:flex">
              <div className="rounded-2xl bg-white p-2"><QR texto={urlApp()} size={124} /></div>
              <div>
                <p className="font-bold">Pruébalo en tu celular</p>
                <p className="mt-1 text-sm text-white/60">Escanea el código con la cámara. Se instala como una app, sin Play Store.</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="text-center text-[11px] text-white/35">
          Demo funcional · Los trabajadores, DNI y obras mostrados son datos de demostración.
        </footer>
      </div>
    </div>
  );
}
