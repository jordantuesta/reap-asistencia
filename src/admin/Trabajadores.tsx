import { useState } from 'react';
import { KeyRound, Pencil, Plus, RotateCcw, ScanFace, Search, Smartphone, UserPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { Contrato, Trabajador } from '../lib/types';
import { fechaLima, fechaNum, sumarDias } from '../lib/tiempo';
import { nombreCompleto, nombreCorto, soles } from '../lib/util';
import { Avatar, Boton, Campo, claseInput, Insignia, Modal, Tarjeta, useAviso } from '../ui/comunes';
import QR, { urlApp } from '../ui/QR';
import { semaforo } from '../worker/ContratoTab';
import { diasRestantes, useDatos } from './datos';
import { Titulo } from './Panel';

export default function Trabajadores() {
  const d = useDatos();
  const avisar = useAviso();
  const [q, setQ] = useState('');
  const [editar, setEditar] = useState<Trabajador | 'nuevo' | null>(null);
  const [codigo, setCodigo] = useState<{ t: Trabajador; codigo: string } | null>(null);

  const lista = d.trabajadores
    .filter((t) => !q || (nombreCompleto(t) + ' ' + t.dni + ' ' + t.cargo).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(!!a.demo) - Number(!!b.demo) || a.apellidos.localeCompare(b.apellidos));
  const enrolados = d.trabajadores.filter((t) => t.tiene_rostro || t.enrolado_at).length;

  const reiniciar = async (t: Trabajador) => {
    if (!confirm(`¿Reiniciar el rostro de ${nombreCorto(t)}? Deberá registrarlo de nuevo con un código de alta nuevo.`)) return;
    const c = await api.reiniciarRostro(t.id);
    await d.recargar();
    setCodigo({ t, codigo: c });
    avisar({ tipo: 'info', titulo: 'Rostro reiniciado', texto: 'Comparte el nuevo código de alta con el trabajador.' });
  };

  return (
    <div>
      <Titulo titulo="Trabajadores" sub={`${d.trabajadores.length} activos · ${enrolados} con rostro registrado`}
        acciones={<Boton onClick={() => setEditar('nuevo')}><UserPlus size={16} /> Nuevo trabajador</Boton>} />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-acero-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, DNI o cargo" className={claseInput + ' pl-9'} />
      </div>
      <Tarjeta className="overflow-hidden">
        <div className="scroll-fino overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-acero-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-acero-500">
              <tr><th className="px-4 py-3">Trabajador</th><th className="px-3 py-3">DNI</th><th className="px-3 py-3">Empresa</th><th className="px-3 py-3">Obra · pareja</th><th className="px-3 py-3">Rostro</th><th className="px-3 py-3">Contrato</th><th className="px-3 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-acero-100">
              {lista.map((t) => {
                const e = d.emp.get(t.empresa_id);
                const c = d.contrato.get(t.id);
                const sem = semaforo(diasRestantes(c, d.hoy));
                const pareja = t.pareja_id ? d.trab.get(t.pareja_id) : null;
                const conRostro = t.tiene_rostro;
                return (
                  <tr key={t.id} className="hover:bg-acero-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombres={t.nombres} apellidos={t.apellidos} foto={t.foto_enrolamiento} size={36} color={e?.color} />
                        <div><p className="font-semibold text-acero-900">{nombreCompleto(t)}{!t.demo && <Insignia tono="violeta" className="ml-1.5">nuevo</Insignia>}</p><p className="text-xs text-acero-500">{t.cargo}</p></div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs tabular text-acero-700">{t.dni}</td>
                    <td className="px-3 py-2.5"><span className="flex items-center gap-1.5 text-xs text-acero-700"><span className="h-2 w-2 rounded-full" style={{ background: e?.color }} />{e?.nombre_corto}</span></td>
                    <td className="px-3 py-2.5 text-xs text-acero-600"><p className="font-medium text-acero-800">{d.obra.get(t.obra_id || '')?.nombre || '—'}</p>{pareja && <p>con {nombreCorto(pareja)}</p>}</td>
                    <td className="px-3 py-2.5">
                      {conRostro ? <Insignia tono="verde"><ScanFace size={11} /> Registrado</Insignia>
                        : t.enrolado_at ? <Insignia tono="azul"><ScanFace size={11} /> Registrado (demo)</Insignia>
                          : <button onClick={() => setCodigo({ t, codigo: t.codigo_alta })} className="inline-flex items-center gap-1 rounded-full bg-ambar-50 px-2 py-0.5 text-[11px] font-semibold text-ambar-700 ring-1 ring-ambar-200 hover:bg-ambar-100"><KeyRound size={11} /> Pendiente · ver código</button>}
                      {t.dispositivo_id && conRostro && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-acero-400"><Smartphone size={10} /> celular vinculado</p>}
                    </td>
                    <td className="px-3 py-2.5">{c ? <Insignia tono={sem.tono}>{c.fecha_fin ? sem.texto : 'Indeterminado'}</Insignia> : <span className="text-xs text-acero-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditar(t)} className="rounded-lg p-1.5 text-acero-500 hover:bg-acero-100 hover:text-acero-800" title="Editar"><Pencil size={15} /></button>
                        {(conRostro || t.enrolado_at) && <button onClick={() => reiniciar(t)} className="rounded-lg p-1.5 text-acero-500 hover:bg-acero-100 hover:text-acero-800" title="Reiniciar rostro"><RotateCcw size={15} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {editar && <FormTrabajador t={editar === 'nuevo' ? null : editar} onCerrar={() => setEditar(null)} onGuardado={(t, nuevo) => { setEditar(null); if (nuevo) setCodigo({ t, codigo: t.codigo_alta }); }} />}

      <Modal abierto={!!codigo} onCerrar={() => setCodigo(null)} titulo="Código de alta" ancho="max-w-md">
        {codigo && (
          <div className="text-center">
            <p className="text-sm text-acero-600">Entrega este código a <b>{nombreCompleto(codigo.t)}</b> para que registre su rostro en la app. Sin este código nadie puede registrar un rostro con su DNI.</p>
            <p className="my-5 font-mono text-5xl font-bold tracking-[0.25em] text-acero-900">{codigo.codigo}</p>
            <div className="mx-auto flex w-fit items-center gap-4 rounded-2xl bg-acero-50 p-3 text-left">
              <QR texto={urlApp()} size={96} />
              <div className="text-xs text-acero-600">
                <p className="font-semibold text-acero-800">1. Abrir la app</p><p>Escanear este QR</p>
                <p className="mt-1 font-semibold text-acero-800">2. Elegir empresa y DNI</p><p>{d.emp.get(codigo.t.empresa_id)?.nombre_corto} · {codigo.t.dni}</p>
                <p className="mt-1 font-semibold text-acero-800">3. Ingresar el código</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const MODALIDADES = ['Obra determinada o servicio específico', 'Inicio o incremento de actividad', 'Necesidades del mercado', 'Plazo indeterminado'];

function FormTrabajador({ t, onCerrar, onGuardado }: { t: Trabajador | null; onCerrar: () => void; onGuardado: (t: Trabajador, nuevo: boolean) => void }) {
  const d = useDatos();
  const avisar = useAviso();
  const c0 = t ? d.contrato.get(t.id) : undefined;
  const [f, setF] = useState({
    nombres: t?.nombres || '', apellidos: t?.apellidos || '', dni: t?.dni || '', cargo: t?.cargo || 'Técnico instalador',
    telefono: t?.telefono || '', empresa_id: t?.empresa_id || (d.empresa !== 'todas' ? d.empresa : d.s.empresas[0]?.id || ''),
    obra_id: t?.obra_id || '', pareja_id: t?.pareja_id || '', remuneracion: String(t?.remuneracion || 2500),
    modalidad: c0?.modalidad || MODALIDADES[0], inicio: c0?.fecha_inicio || fechaLima(), fin: c0?.fecha_fin ?? sumarDias(fechaLima(), 90),
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const guardar = async () => {
    if (!f.nombres.trim() || !f.apellidos.trim() || !/^\d{8}$/.test(f.dni)) { setError('Completa nombres, apellidos y un DNI de 8 dígitos.'); return; }
    if (d.s.trabajadores.some((x) => x.dni === f.dni && x.empresa_id === f.empresa_id && x.id !== t?.id)) { setError('Ya existe un trabajador con ese DNI en esta empresa.'); return; }
    setGuardando(true);
    try {
      const base: Trabajador = t ? { ...t } : {
        id: '', codigo_alta: '', enrolado_at: null, tiene_rostro: false, foto_enrolamiento: null, dispositivo_id: null,
        consentimiento_at: null, activo: true, demo: false,
      } as unknown as Trabajador;
      const datos: Trabajador = {
        ...base, nombres: f.nombres.trim(), apellidos: f.apellidos.trim(), dni: f.dni, cargo: f.cargo.trim(), telefono: f.telefono,
        empresa_id: f.empresa_id, obra_id: f.obra_id || null, pareja_id: f.pareja_id || null, remuneracion: Number(f.remuneracion) || 0,
      };
      const indet = f.modalidad === 'Plazo indeterminado';
      const contrato: Contrato = {
        id: c0?.id || '', trabajador_id: t?.id || '', empresa_id: f.empresa_id, modalidad: f.modalidad, cargo: datos.cargo,
        fecha_inicio: f.inicio, fecha_fin: indet ? null : f.fin || null, remuneracion: datos.remuneracion, demo: false,
      };
      const r = await api.guardarTrabajador(datos, contrato);
      await d.recargar();
      avisar({ tipo: 'exito', titulo: t ? 'Trabajador actualizado' : 'Trabajador creado' });
      onGuardado(r, !t);
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally { setGuardando(false); }
  };

  const companeros = d.s.trabajadores.filter((x) => x.id !== t?.id && x.activo && (!f.obra_id || x.obra_id === f.obra_id));

  return (
    <Modal abierto onCerrar={onCerrar} titulo={t ? `Editar · ${nombreCorto(t)}` : 'Nuevo trabajador'} ancho="max-w-2xl"
      pie={<><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton cargando={guardando} onClick={guardar}><Plus size={16} /> {t ? 'Guardar cambios' : 'Crear y generar código'}</Boton></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Razón social">
          <select className={claseInput} value={f.empresa_id} onChange={set('empresa_id')}>{d.s.empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
        </Campo>
        <Campo etiqueta="DNI"><input className={claseInput} inputMode="numeric" maxLength={8} value={f.dni} onChange={(e) => setF({ ...f, dni: e.target.value.replace(/\D/g, '') })} /></Campo>
        <Campo etiqueta="Nombres"><input className={claseInput} value={f.nombres} onChange={set('nombres')} /></Campo>
        <Campo etiqueta="Apellidos"><input className={claseInput} value={f.apellidos} onChange={set('apellidos')} /></Campo>
        <Campo etiqueta="Cargo"><input className={claseInput} value={f.cargo} onChange={set('cargo')} list="cargos" /></Campo>
        <datalist id="cargos">{['Técnico instalador', 'Ayudante de instalación', 'Técnico de ajuste', 'Técnico electromecánico', 'Técnico de mantenimiento', 'Supervisor de obra'].map((c) => <option key={c} value={c} />)}</datalist>
        <Campo etiqueta="Celular"><input className={claseInput} inputMode="tel" value={f.telefono} onChange={set('telefono')} /></Campo>
        <Campo etiqueta="Obra asignada">
          <select className={claseInput} value={f.obra_id} onChange={set('obra_id')}><option value="">Sin obra</option>{d.s.obras.filter((o) => o.activa).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>
        </Campo>
        <Campo etiqueta="Pareja de trabajo" ayuda="Con quién va a la obra">
          <select className={claseInput} value={f.pareja_id} onChange={set('pareja_id')}><option value="">Ninguna</option>{companeros.map((x) => <option key={x.id} value={x.id}>{nombreCompleto(x)}</option>)}</select>
        </Campo>
      </div>
      <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-acero-500">Contrato</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Modalidad"><select className={claseInput} value={f.modalidad} onChange={set('modalidad')}>{MODALIDADES.map((m) => <option key={m}>{m}</option>)}</select></Campo>
        <Campo etiqueta="Remuneración mensual (S/)" ayuda={`Valor hora: ${soles((Number(f.remuneracion) || 0) / 240)}`}><input className={claseInput} inputMode="decimal" value={f.remuneracion} onChange={set('remuneracion')} /></Campo>
        <Campo etiqueta="Inicio"><input type="date" className={claseInput} value={f.inicio} onChange={set('inicio')} /></Campo>
        {f.modalidad !== 'Plazo indeterminado' && <Campo etiqueta="Fin" ayuda={f.fin ? `Vence el ${fechaNum(f.fin)}` : undefined}><input type="date" className={claseInput} value={f.fin || ''} onChange={set('fin')} /></Campo>}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}
