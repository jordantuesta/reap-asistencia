import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Coffee, FileSignature, HardHat, Loader2, LogIn, LogOut, MapPin, Navigation, ShieldAlert, Users, UtensilsCrossed, XCircle } from 'lucide-react';
import type { Pestana } from './AppTrabajador';
import { api } from '../lib/api';
import type { CapturaFacial, PerfilTrabajador, ResultadoMarca, TipoMarca, Ubicacion } from '../lib/types';
import { NOMBRE_MARCA, SECUENCIA } from '../lib/types';
import { distanciaM, ErrorUbicacion, obtenerUbicacion, seguirUbicacion, textoDistancia } from '../lib/geo';
import { resumirDia, siguienteMarca } from '../lib/horas';
import { duracion, fechaLarga, fechaLima, horaLima, horaSegLima, saludo } from '../lib/tiempo';
import { idDispositivo, nombreCorto, pct } from '../lib/util';
import { Boton, FotoEvidencia } from '../ui/comunes';
import CamaraFacial from '../ui/CamaraFacial';

export const ESTILO_MARCA: Record<TipoMarca, { color: string; suave: string; icono: typeof LogIn; verbo: string }> = {
  entrada: { color: '#059669', suave: '#ECFDF5', icono: LogIn, verbo: 'Marcar ENTRADA' },
  salida_refrigerio: { color: '#D9860B', suave: '#FFF8EB', icono: UtensilsCrossed, verbo: 'Salir a REFRIGERIO' },
  regreso_refrigerio: { color: '#2A5580', suave: '#EEF4FA', icono: Coffee, verbo: 'REGRESO de refrigerio' },
  salida: { color: '#0F2A44', suave: '#EEF4FA', icono: LogOut, verbo: 'Marcar SALIDA' },
};

type Flujo =
  | { paso: 'nada' }
  | { paso: 'ubicando' }
  | { paso: 'error_ubicacion'; mensaje: string }
  | { paso: 'camara'; ubic: Ubicacion }
  | { paso: 'enviando' }
  | { paso: 'resultado'; r: ResultadoMarca; foto: string };

export default function Inicio({ perfil, recargar, irA }: { perfil: PerfilTrabajador; recargar: () => Promise<void> | void; irA: (p: Pestana) => void }) {
  const t = perfil.trabajador;
  const obra = perfil.obra;
  const [ahora, setAhora] = useState(() => new Date());
  const [ubic, setUbic] = useState<Ubicacion | null>(null);
  const [errUbic, setErrUbic] = useState<string | null>(null);
  const [flujo, setFlujo] = useState<Flujo>({ paso: 'nada' });
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => { const id = setInterval(() => setAhora(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => seguirUbicacion((u) => { setUbic(u); setErrUbic(null); }, (e) => setErrUbic(e.message)), []);
  useEffect(() => { api.pendientesSinConexion().then(setPendientes).catch(() => {}); }, [flujo.paso]);

  const marcasHoy = perfil.marcas_hoy;
  const siguiente = siguienteMarca(marcasHoy);
  const dist = ubic && obra ? distanciaM(ubic.lat, ubic.lng, obra.lat, obra.lng) : null;
  const dentro = dist != null && obra ? dist <= obra.radio_m : null;
  const resumen = useMemo(() => resumirDia(t.id, fechaLima(), marcasHoy, perfil.config, true), [marcasHoy, perfil.config, t.id]);
  const adendaPendiente = perfil.adendas.find((a) => a.estado === 'enviada');

  // Horas trabajadas en curso (si aún no marca salida)
  let enCurso = resumen.trabajadoMin;
  if (resumen.marcas.entrada && !resumen.marcas.salida) {
    const e = new Date(resumen.marcas.entrada.hora_marca).getTime();
    let ref = 0;
    if (resumen.marcas.salida_refrigerio) {
      const s = new Date(resumen.marcas.salida_refrigerio.hora_marca).getTime();
      const r = resumen.marcas.regreso_refrigerio ? new Date(resumen.marcas.regreso_refrigerio.hora_marca).getTime() : ahora.getTime();
      ref = r - s;
    }
    enCurso = Math.max(0, (ahora.getTime() - e - ref) / 60000);
  }

  const iniciarMarca = async () => {
    setFlujo({ paso: 'ubicando' });
    try {
      const fresca = ubic && Date.now() - Date.parse(ubic.hora) < 45000 ? ubic : await obtenerUbicacion({ maxEdadMs: 20000, timeoutMs: 15000 });
      setFlujo({ paso: 'camara', ubic: fresca });
    } catch (e) {
      setFlujo({ paso: 'error_ubicacion', mensaje: e instanceof ErrorUbicacion ? e.message : 'No se pudo obtener tu ubicación.' });
    }
  };

  const alCapturar = async (c: CapturaFacial, ubicCaptura: Ubicacion) => {
    const horaDispositivo = new Date().toISOString();
    setFlujo({ paso: 'enviando' });
    let ubicSubida: Ubicacion | null = null;
    try { ubicSubida = await obtenerUbicacion({ maxEdadMs: 3000, timeoutMs: 6000 }); } catch { ubicSubida = null; }
    try {
      const r = await api.marcar({
        trabajador_id: t.id, captura: c, dispositivo_id: idDispositivo(), hora_dispositivo: horaDispositivo,
        ubic_captura: ubicCaptura, ubic_subida: ubicSubida, sin_conexion: false,
      });
      setFlujo({ paso: 'resultado', r, foto: c.foto });
      if (r.ok) void recargar();
    } catch (e) {
      setFlujo({ paso: 'resultado', r: { ok: false, mensaje: 'Error al registrar: ' + String((e as Error)?.message || e) }, foto: c.foto });
    }
  };

  const est = siguiente ? ESTILO_MARCA[siguiente] : null;
  const IconoBoton = est?.icono || CheckCircle2;

  return (
    <div>
      {/* Encabezado */}
      <header className="fondo-marca safe-top rounded-b-[28px] px-5 pb-16 pt-5 text-white">
        <div className="flex items-center justify-between">
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: perfil.empresa.color + '33', color: '#fff', boxShadow: `inset 0 0 0 1px ${perfil.empresa.color}88` }}>
            {perfil.empresa.nombre_corto}
          </span>
          {pendientes > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-ambar-500/20 px-2.5 py-1 text-[11px] font-semibold text-ambar-300"><CloudOff size={13} /> {pendientes} por enviar</span>
          )}
        </div>
        <p className="mt-5 text-sm text-white/60">{saludo(ahora)},</p>
        <h1 className="text-2xl font-extrabold">{nombreCorto(t)}</h1>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-sm capitalize text-white/60">{fechaLarga(fechaLima(ahora))}</p>
          <p className="font-mono text-3xl font-semibold tabular text-white">{horaSegLima(ahora)}</p>
        </div>
      </header>

      <div className="-mt-12 space-y-3 px-4">
        {/* Obra y ubicación */}
        <div className="rounded-2xl bg-white p-4 shadow-lg ring-1 ring-acero-100">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-acero-50 text-acero-700"><HardHat size={22} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-acero-400">Obra asignada</p>
              <p className="truncate font-bold text-acero-900">{obra?.nombre || 'Sin obra asignada'}</p>
              {obra && <p className="truncate text-xs text-acero-500">{obra.direccion}, {obra.distrito}</p>}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold"
            style={{ background: errUbic ? '#FEF2F2' : dentro == null ? '#F1F5F9' : dentro ? '#ECFDF5' : '#FFF8EB', color: errUbic ? '#B91C1C' : dentro == null ? '#475569' : dentro ? '#047857' : '#B4670A' }}>
            {errUbic ? <AlertTriangle size={16} /> : ubic ? <MapPin size={16} /> : <Loader2 size={16} className="girar" />}
            <span className="flex-1">
              {errUbic ? errUbic : !ubic ? 'Obteniendo tu ubicación…' : !obra ? `Ubicación lista (±${ubic.precision} m)` : dentro ? `Estás en la obra · a ${textoDistancia(dist)}` : `Estás fuera de la obra · a ${textoDistancia(dist)}`}
            </span>
            {ubic && <span className="text-[11px] font-medium opacity-70">±{ubic.precision} m</span>}
          </div>
          {perfil.pareja && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-acero-500"><Users size={14} /> Tu pareja de trabajo: <b className="text-acero-700">{nombreCorto(perfil.pareja)}</b></p>
          )}
        </div>

        {/* Botón principal */}
        <div className="rounded-3xl bg-white p-5 text-center shadow-lg ring-1 ring-acero-100">
          {siguiente && est ? (
            <>
              <button onClick={iniciarMarca} className="pulso mx-auto grid h-44 w-44 place-items-center rounded-full text-white shadow-2xl transition active:scale-95" style={{ background: `radial-gradient(circle at 35% 30%, ${est.color}dd, ${est.color})` }}>
                <div className="flex flex-col items-center gap-2">
                  <IconoBoton size={40} strokeWidth={2.2} />
                  <span className="px-4 text-[15px] font-extrabold leading-tight">{est.verbo}</span>
                </div>
              </button>
              <p className="mt-4 text-xs text-acero-500">Se validará tu rostro y tu ubicación</p>
            </>
          ) : (
            <div className="py-6">
              <CheckCircle2 size={56} className="mx-auto text-emerald-500" />
              <p className="mt-3 text-lg font-extrabold text-acero-900">Jornada completa</p>
              <p className="text-sm text-acero-500">Registraste tus 4 marcas de hoy. ¡Buen trabajo!</p>
            </div>
          )}
        </div>

        {adendaPendiente && (
          <button onClick={() => irA('contrato')} className="flex w-full items-center gap-3 rounded-2xl bg-ambar-50 p-4 text-left ring-1 ring-ambar-200">
            <FileSignature className="shrink-0 text-ambar-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-ambar-700">Tienes una adenda de renovación por firmar</p>
              <p className="text-xs text-ambar-700/80">Tu contrato se renueva. Revísala y fírmala con tu rostro.</p>
            </div>
          </button>
        )}

        {/* Línea de tiempo del día */}
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-acero-100">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-acero-900">Hoy</p>
            <p className="text-xs text-acero-500">Trabajado: <b className="text-acero-800 tabular">{duracion(enCurso)}</b></p>
          </div>
          <ol className="space-y-0">
            {SECUENCIA.map((tipo, i) => {
              const m = resumen.marcas[tipo];
              const E = ESTILO_MARCA[tipo];
              const I = E.icono;
              const esSiguiente = tipo === siguiente;
              return (
                <li key={tipo} className="relative flex items-center gap-3 py-2">
                  {i < 3 && <span className="absolute left-[17px] top-[38px] h-[calc(100%-22px)] w-0.5" style={{ background: m ? E.color + '55' : '#E2E8F0' }} />}
                  <div className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: m ? E.color : esSiguiente ? E.suave : '#F1F5F9', color: m ? '#fff' : esSiguiente ? E.color : '#94A3B8' }}>
                    <I size={17} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${m ? 'text-acero-900' : 'text-acero-400'}`}>{NOMBRE_MARCA[tipo]}</p>
                    {m?.estado === 'observada' && <p className="text-[11px] font-medium text-ambar-600">{m.observaciones[0]}</p>}
                  </div>
                  <p className={`font-mono text-sm font-semibold tabular ${m ? 'text-acero-900' : 'text-acero-300'}`}>{m ? horaLima(m.hora_marca) : esSiguiente ? 'pendiente' : '--:--'}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ---------- Flujo de marcación */}
      {flujo.paso === 'ubicando' && (
        <Capa><Loader2 size={40} className="girar text-ambar-400" /><p className="mt-4 text-lg font-bold">Obteniendo tu ubicación…</p><p className="mt-1 text-sm text-white/60">Activa el GPS si te lo pide.</p></Capa>
      )}
      {flujo.paso === 'error_ubicacion' && (
        <Capa>
          <Navigation size={44} className="text-ambar-400" />
          <p className="mt-4 text-lg font-bold">Necesitamos tu ubicación</p>
          <p className="mt-2 max-w-xs text-sm text-white/70">{flujo.mensaje}</p>
          <p className="mt-2 max-w-xs text-xs text-white/50">La ubicación es obligatoria para saber dónde se tomó la foto.</p>
          <div className="mt-6 flex gap-2">
            <Boton variante="secundario" onClick={() => setFlujo({ paso: 'nada' })}>Cancelar</Boton>
            <Boton variante="acento" onClick={iniciarMarca}>Reintentar</Boton>
          </div>
        </Capa>
      )}
      {flujo.paso === 'camara' && siguiente && (
        <CamaraFacial
          titulo={NOMBRE_MARCA[siguiente]}
          subtitulo={obra?.nombre || 'Marcación'}
          diagnostico={perfil.config.mostrar_diagnostico}
          onListo={(c) => alCapturar(c, flujo.ubic)}
          onCancelar={() => setFlujo({ paso: 'nada' })}
        />
      )}
      {flujo.paso === 'enviando' && (
        <Capa><Loader2 size={40} className="girar text-ambar-400" /><p className="mt-4 text-lg font-bold">Verificando identidad…</p><p className="mt-1 text-sm text-white/60">Comparando con tu rostro registrado</p></Capa>
      )}
      {flujo.paso === 'resultado' && <Resultado r={flujo.r} foto={flujo.foto} obraNombre={obra?.nombre} onCerrar={() => setFlujo({ paso: 'nada' })} />}
    </div>
  );
}

function Capa({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-acero-950/95 p-6 text-center text-white">{children}</div>;
}

function Resultado({ r, foto, obraNombre, onCerrar }: { r: ResultadoMarca; foto: string; obraNombre?: string; onCerrar: () => void }) {
  const enCola = r.motivo === 'en_cola';
  const color = r.ok ? '#059669' : enCola ? '#D9860B' : '#DC2626';
  const titulo = r.ok ? '¡Marca registrada!' : enCola ? 'Guardada sin conexión' : r.motivo === 'rostro_no_coincide' ? 'Identidad no verificada' : r.motivo === 'prueba_vida' ? 'Prueba de vida no superada' : r.motivo === 'jornada_completa' ? 'Jornada completa' : 'No se pudo marcar';
  const m = r.marcacion;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="safe-top flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="relative">
          <img src={foto} alt="" className="h-36 w-36 rounded-full object-cover ring-[6px]" style={{ ['--tw-ring-color' as string]: color + '40' }} />
          <div className="absolute -bottom-2 -right-2 grid h-12 w-12 place-items-center rounded-full text-white ring-4 ring-white" style={{ background: color }}>
            {r.ok ? <CheckCircle2 size={26} /> : enCola ? <CloudOff size={24} /> : r.motivo === 'rostro_no_coincide' ? <ShieldAlert size={24} /> : <XCircle size={26} />}
          </div>
        </div>
        <h2 className="mt-7 text-2xl font-extrabold" style={{ color }}>{titulo}</h2>
        <p className="mt-2 max-w-xs text-sm text-acero-600">{r.mensaje}</p>
        {m && (
          <div className="mt-6 w-full max-w-xs space-y-2 rounded-2xl bg-acero-50 p-4 text-left text-sm">
            <Fila k="Tipo" v={NOMBRE_MARCA[m.tipo]} />
            <Fila k="Hora oficial" v={horaLima(m.hora_marca)} />
            {obraNombre && <Fila k="Obra" v={obraNombre} />}
            <Fila k="Ubicación" v={m.dentro_obra == null ? '—' : m.dentro_obra ? `Dentro (${textoDistancia(m.distancia_m)})` : `Fuera (${textoDistancia(m.distancia_m)})`} alerta={m.dentro_obra === false} />
            <Fila k="Coincidencia facial" v={pct(m.similitud)} />
          </div>
        )}
        {r.motivo === 'rostro_no_coincide' && (
          <p className="mt-5 max-w-xs rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700">Se envió una alerta a RR. HH. con la foto, la hora y la ubicación de este intento.</p>
        )}
      </div>
      <div className="safe-bottom p-5">
        <Boton className="h-14 w-full rounded-2xl text-base" variante={r.ok ? 'exito' : 'primario'} onClick={onCerrar}>Listo</Boton>
      </div>
    </div>
  );
}

function Fila({ k, v, alerta }: { k: string; v: string; alerta?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-acero-500">{k}</span>
      <span className={`text-right font-semibold ${alerta ? 'text-ambar-600' : 'text-acero-900'}`}>{v}</span>
    </div>
  );
}

export { FotoEvidencia };
