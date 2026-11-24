// Modelo de datos de REAP Asistencia.
// Los nombres de campos coinciden con las columnas de Supabase (supabase/schema.sql).

export type TipoMarca = 'entrada' | 'salida_refrigerio' | 'regreso_refrigerio' | 'salida';

export const SECUENCIA: TipoMarca[] = ['entrada', 'salida_refrigerio', 'regreso_refrigerio', 'salida'];

export const NOMBRE_MARCA: Record<TipoMarca, string> = {
  entrada: 'Entrada',
  salida_refrigerio: 'Salida a refrigerio',
  regreso_refrigerio: 'Regreso de refrigerio',
  salida: 'Salida',
};

/** "la ENTRADA", "el REGRESO DE REFRIGERIO"… (para mensajes de alertas) */
export function marcaConArticulo(t: TipoMarca): string {
  return (t === 'regreso_refrigerio' ? 'el ' : 'la ') + NOMBRE_MARCA[t].toUpperCase();
}

export const NOMBRE_CORTO_MARCA: Record<TipoMarca, string> = {
  entrada: 'Entrada',
  salida_refrigerio: 'Sale a almorzar',
  regreso_refrigerio: 'Vuelve del almuerzo',
  salida: 'Salida',
};

export interface Empresa {
  id: string;
  nombre: string;        // razón social
  nombre_corto: string;  // cómo se muestra en la app
  ruc: string;
  color: string;         // color de acento para distinguirla
}

export interface Obra {
  id: string;
  nombre: string;
  cliente: string;
  direccion: string;
  distrito: string;
  lat: number;
  lng: number;
  radio_m: number;
  activa: boolean;
  demo?: boolean;
}

export interface Trabajador {
  id: string;
  empresa_id: string;
  dni: string;
  nombres: string;
  apellidos: string;
  cargo: string;
  telefono: string;
  obra_id: string | null;
  pareja_id: string | null;
  remuneracion: number;
  codigo_alta: string;           // código que entrega RR. HH. para registrar el rostro
  enrolado_at: string | null;
  tiene_rostro: boolean;
  foto_enrolamiento: string | null;
  dispositivo_id: string | null;
  consentimiento_at: string | null;
  activo: boolean;
  demo?: boolean;
  // Solo en modo local (en Supabase la plantilla biométrica nunca sale del servidor)
  embedding?: number[] | null;
}

export type EstadoMarca = 'valida' | 'observada';

export interface Marcacion {
  id: string;
  trabajador_id: string;
  empresa_id: string;
  obra_id: string | null;
  tipo: TipoMarca;
  hora_marca: string;        // hora que cuenta para el cálculo (servidor; o del celular si fue sin conexión)
  hora_servidor: string;     // cuándo llegó al servidor
  hora_dispositivo: string;  // reloj del celular al tomar la foto
  lat_captura: number | null;
  lng_captura: number | null;
  prec_captura: number | null;
  lat_subida: number | null;
  lng_subida: number | null;
  prec_subida: number | null;
  distancia_m: number | null;
  dentro_obra: boolean | null;
  similitud: number | null;
  vida: number | null;
  foto: string | null;
  dispositivo_id: string | null;
  dispositivo_distinto: boolean;
  sin_conexion: boolean;
  estado: EstadoMarca;
  observaciones: string[];
  demo?: boolean;
}

export type TipoAlerta =
  | 'rostro_no_coincide'
  | 'prueba_vida'
  | 'fuera_de_obra'
  | 'dispositivo_distinto'
  | 'contrato_vencido';

export const NOMBRE_ALERTA: Record<TipoAlerta, string> = {
  rostro_no_coincide: 'Rostro no coincide',
  prueba_vida: 'Falló la prueba de vida',
  fuera_de_obra: 'Marcó fuera de la obra',
  dispositivo_distinto: 'Celular distinto al registrado',
  contrato_vencido: 'Contrato vencido',
};

export interface Alerta {
  id: string;
  trabajador_id: string;
  empresa_id: string;
  obra_id: string | null;
  tipo: TipoAlerta;
  fecha: string;
  foto: string | null;
  lat: number | null;
  lng: number | null;
  similitud: number | null;
  detalle: string;
  estado: 'nueva' | 'revisada' | 'descartada';
  demo?: boolean;
}

export interface Contrato {
  id: string;
  trabajador_id: string;
  empresa_id: string;
  modalidad: string;
  cargo: string;
  fecha_inicio: string;       // YYYY-MM-DD
  fecha_fin: string | null;   // null = plazo indeterminado
  remuneracion: number;
  demo?: boolean;
}

export interface Adenda {
  id: string;
  contrato_id: string;
  trabajador_id: string;
  empresa_id: string;
  numero: number;
  fecha_fin_anterior: string;
  nueva_fecha_fin: string;
  enviada_at: string;
  vista_at: string | null;
  estado: 'enviada' | 'firmada' | 'rechazada';
  firmada_at: string | null;
  firma_foto: string | null;
  firma_similitud: number | null;
  firma_lat: number | null;
  firma_lng: number | null;
  firma_dispositivo: string | null;
  codigo_verificacion: string | null;
  demo?: boolean;
}

export interface AprobacionHE {
  id: string;
  trabajador_id: string;
  fecha: string; // YYYY-MM-DD
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  resuelto_at: string | null;
  demo?: boolean;
}

export interface Config {
  hora_entrada: string;        // "08:00"
  hora_salida: string;         // "17:00"
  refrigerio_min: number;      // 60
  jornada_min: number;         // 480
  tolerancia_min: number;      // 10
  extra_minimo_min: number;    // 15
  dias_laborables: number[];   // 1=lunes ... 6=sábado, 0=domingo
  umbral_similitud: number;    // 0..1
  umbral_vida: number;         // 0..1
  bloquear_fuera_obra: boolean;
  radio_defecto_m: number;
  mostrar_diagnostico: boolean;
  onedrive_carpeta: string;
}

export const CONFIG_INICIAL: Config = {
  hora_entrada: '08:00',
  hora_salida: '17:00',
  refrigerio_min: 60,
  jornada_min: 480,
  tolerancia_min: 10,
  extra_minimo_min: 15,
  dias_laborables: [1, 2, 3, 4, 5],
  umbral_similitud: 0.55,
  umbral_vida: 0.35,
  bloquear_fuera_obra: false,
  radio_defecto_m: 150,
  mostrar_diagnostico: false,
  onedrive_carpeta: '/REAP Asistencia/{empresa}/{año}/{mes}',
};

/** Todo lo que el panel administrativo necesita en memoria. */
export interface Snapshot {
  empresas: Empresa[];
  obras: Obra[];
  trabajadores: Trabajador[];
  contratos: Contrato[];
  adendas: Adenda[];
  marcaciones: Marcacion[];
  alertas: Alerta[];
  aprobaciones: AprobacionHE[];
  config: Config;
}

/** Lo que ve el trabajador en su celular (sin datos biométricos). */
export interface PerfilTrabajador {
  trabajador: Omit<Trabajador, 'embedding' | 'codigo_alta'>;
  empresa: Empresa;
  obra: Obra | null;
  pareja: { nombres: string; apellidos: string } | null;
  contrato: Contrato | null;
  adendas: Adenda[];
  marcas_hoy: Marcacion[];
  config: Config;
}

export interface CapturaFacial {
  embedding: number[];
  foto: string;          // dataURL JPEG
  real: number;          // anti-suplantación (0..1)
  vida: number;          // prueba de vida (0..1)
  reto_superado: boolean;
}

export interface Ubicacion {
  lat: number;
  lng: number;
  precision: number;
  hora: string;
}

export interface SolicitudMarca {
  trabajador_id: string;
  captura: CapturaFacial;
  dispositivo_id: string;
  hora_dispositivo: string;
  ubic_captura: Ubicacion | null;
  ubic_subida: Ubicacion | null;
  sin_conexion: boolean;
}

export interface ResultadoMarca {
  ok: boolean;
  motivo?: TipoAlerta | 'jornada_completa' | 'sin_rostro' | 'en_cola';
  mensaje: string;
  marcacion?: Marcacion;
  similitud?: number;
  distancia_m?: number | null;
  dentro_obra?: boolean | null;
}

export interface EventoTiempoReal {
  tipo: 'marcacion' | 'alerta' | 'adenda' | 'trabajador' | 'recarga';
  dato?: unknown;
}
