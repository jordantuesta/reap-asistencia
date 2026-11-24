import type {
  Adenda, AprobacionHE, Alerta, CapturaFacial, Config, Empresa, EventoTiempoReal, Marcacion, Obra,
  PerfilTrabajador, ResultadoMarca, Snapshot, SolicitudMarca, Trabajador, Contrato, Ubicacion,
} from '../types';

export interface ResultadoSimple { ok: boolean; mensaje: string; }

export interface SolicitudFirma {
  trabajador_id: string;
  adenda_id: string;
  captura: CapturaFacial;
  ubicacion: Ubicacion | null;
  dispositivo_id: string;
}

/** Contrato común para el modo local (demo sin internet) y el modo Supabase (en vivo). */
export interface Api {
  modo: 'local' | 'supabase';

  // ---------- App del trabajador
  empresas(): Promise<Empresa[]>;
  perfil(empresaId: string, dni: string): Promise<PerfilTrabajador | null>;
  enrolar(trabajadorId: string, codigo: string, captura: CapturaFacial, dispositivoId: string): Promise<ResultadoSimple>;
  marcar(req: SolicitudMarca): Promise<ResultadoMarca>;
  historial(trabajadorId: string, desde: string): Promise<{ marcas: Marcacion[]; aprobaciones: AprobacionHE[] }>;
  verAdenda(trabajadorId: string, adendaId: string): Promise<void>;
  firmarAdenda(req: SolicitudFirma): Promise<ResultadoSimple & { adenda?: Adenda }>;
  pendientesSinConexion(): Promise<number>;
  enviarPendientes(): Promise<number>;

  // ---------- Panel administrativo
  sesionAdmin(): Promise<{ email: string } | null>;
  ingresarAdmin(email: string, clave: string): Promise<ResultadoSimple>;
  salirAdmin(): Promise<void>;
  snapshot(desde: string): Promise<Snapshot>;
  guardarEmpresa(e: Empresa): Promise<void>;
  guardarObra(o: Obra): Promise<Obra>;
  guardarTrabajador(t: Trabajador, contrato?: Contrato): Promise<Trabajador>;
  reiniciarRostro(trabajadorId: string): Promise<string>;
  guardarConfig(c: Config): Promise<void>;
  enviarAdenda(contratoId: string, nuevaFechaFin: string): Promise<Adenda>;
  resolverAlerta(id: string, estado: Alerta['estado']): Promise<void>;
  resolverHorasExtra(items: { trabajador_id: string; fecha: string }[], estado: AprobacionHE['estado']): Promise<void>;
  cargarDemo(): Promise<void>;
  urlFoto(ruta: string | null): Promise<string | null>;

  // ---------- Tiempo real
  suscribir(cb: (e: EventoTiempoReal) => void): () => void;
}

export type { Trabajador };
