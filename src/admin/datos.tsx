import { createContext, useContext, useMemo } from 'react';
import type { Contrato, Empresa, Obra, Snapshot, Trabajador } from '../lib/types';
import { resumenes, type DiaResumen } from '../lib/horas';
import { diasEntre, fechaLima } from '../lib/tiempo';

export interface Datos {
  s: Snapshot;
  recargar: () => Promise<void>;
  empresa: string; // 'todas' o id
  setEmpresa: (id: string) => void;
  actualizado: number;
}

export const CtxDatos = createContext<Datos | null>(null);

export function useDatos() {
  const d = useContext(CtxDatos)!;
  const hoy = fechaLima();
  return useMemo(() => {
    const { s, empresa } = d;
    const enEmpresa = <T extends { empresa_id: string }>(xs: T[]) => (empresa === 'todas' ? xs : xs.filter((x) => x.empresa_id === empresa));
    const trab = new Map<string, Trabajador>(s.trabajadores.map((t) => [t.id, t]));
    const obra = new Map<string, Obra>(s.obras.map((o) => [o.id, o]));
    const emp = new Map<string, Empresa>(s.empresas.map((e) => [e.id, e]));
    const contrato = new Map<string, Contrato>(s.contratos.map((c) => [c.trabajador_id, c]));
    const trabajadores = enEmpresa(s.trabajadores).filter((t) => t.activo);
    const marcaciones = enEmpresa(s.marcaciones);
    const alertas = enEmpresa(s.alertas);
    const contratos = enEmpresa(s.contratos);
    const dias: DiaResumen[] = resumenes(marcaciones, s.config, hoy);
    return { ...d, hoy, trab, obra, emp, contrato, trabajadores, marcaciones, alertas, contratos, dias };
  }, [d, hoy]);
}

export function diasRestantes(c: Contrato | undefined | null, hoy = fechaLima()): number | null {
  if (!c?.fecha_fin) return null;
  return diasEntre(hoy, c.fecha_fin);
}

export const COLOR_25 = '#2E6BC4';
export const COLOR_35 = '#CF7F0A';
