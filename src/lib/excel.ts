// Exportación a Excel: registro de control de asistencia (formato para inspección) y horas extra para planilla.
import type { AprobacionHE, Empresa, Obra, Trabajador } from './types';
import { estadoHE, pagoExtra, valorHora, type DiaResumen } from './horas';
import { fechaLima, fechaNum, horaLima, nombreDiaCorto } from './tiempo';

interface Opciones {
  empresas: Empresa[];          // una o varias razones sociales (una hoja por empresa)
  desde: string;
  hasta: string;
  trabajadores: Trabajador[];
  dias: DiaResumen[];
  obras: Map<string, Obra>;
  aprobaciones: AprobacionHE[];
}

const AZUL = 'FF0F2A44';
const AMBAR = 'FFF5A524';

function descargar(buffer: ArrayBuffer, nombre: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function nombreArchivo(tipo: string, empresas: Empresa[], desde: string, hasta: string) {
  const e = empresas.length === 1 ? empresas[0].nombre_corto.replace(/\s+/g, '_') : 'Todas';
  return `REAP_${tipo}_${e}_${desde}_al_${hasta}.xlsx`;
}

export async function exportarAsistencia(o: Opciones) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'REAP Asistencia';
  wb.created = new Date();

  for (const emp of o.empresas) {
    const trab = o.trabajadores.filter((t) => t.empresa_id === emp.id);
    const ids = new Set(trab.map((t) => t.id));
    const byId = new Map(trab.map((t) => [t.id, t]));
    const dias = o.dias.filter((d) => ids.has(d.trabajador_id) && d.fecha >= o.desde && d.fecha <= o.hasta)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (byId.get(a.trabajador_id)!.apellidos).localeCompare(byId.get(b.trabajador_id)!.apellidos));

    // ---------------- Hoja 1: registro
    const ws = wb.addWorksheet(('Asistencia ' + emp.nombre_corto).slice(0, 31), { views: [{ state: 'frozen', ySplit: 7 }] });
    ws.mergeCells('A1:Q1');
    ws.getCell('A1').value = 'REGISTRO DE CONTROL DE ASISTENCIA';
    ws.getCell('A1').font = { bold: true, size: 14, color: { argb: AZUL } };
    ws.getCell('A2').value = `Razón social: ${emp.nombre}`;
    ws.getCell('A3').value = `RUC: ${emp.ruc || 'por definir'}`;
    ws.getCell('A4').value = `Período: ${fechaNum(o.desde)} al ${fechaNum(o.hasta)}`;
    ws.getCell('A5').value = `Generado el ${fechaNum(fechaLima())} a las ${horaLima(new Date())} · Marcas verificadas con reconocimiento facial y geolocalización (hora oficial del servidor).`;
    ws.getCell('A5').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    const cab = ['N.°', 'Fecha', 'Día', 'DNI', 'Apellidos y nombres', 'Cargo', 'Obra', 'Ingreso', 'Salida refrigerio', 'Retorno refrigerio', 'Salida', 'Horas trabajadas', 'Tardanza (min)', 'HE 25 % (h)', 'HE 35 % (h)', 'Estado HE', 'Observaciones'];
    const fila = ws.getRow(7);
    fila.values = cab;
    fila.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    fila.height = 30;
    const h = (m?: { hora_marca: string }) => (m ? horaLima(m.hora_marca) : '');
    dias.forEach((d, i) => {
      const t = byId.get(d.trabajador_id)!;
      const obraId = d.marcas.entrada?.obra_id || t.obra_id || '';
      const r = ws.addRow([
        i + 1, fechaNum(d.fecha), nombreDiaCorto(d.fecha), t.dni, `${t.apellidos}, ${t.nombres}`, t.cargo, o.obras.get(obraId)?.nombre || '',
        h(d.marcas.entrada), h(d.marcas.salida_refrigerio), h(d.marcas.regreso_refrigerio), h(d.marcas.salida),
        d.completa ? Math.round((d.trabajadoMin / 60) * 100) / 100 : '', d.tardanzaMin || '',
        d.extra25Min ? Math.round((d.extra25Min / 60) * 100) / 100 : '', d.extra35Min ? Math.round((d.extra35Min / 60) * 100) / 100 : '',
        d.extraMin ? estadoHE(o.aprobaciones, t.id, d.fecha) : '', d.observaciones.join('; '),
      ]);
      if (i % 2) r.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F6F9' } }; });
      if (d.tardanzaMin) r.getCell(13).font = { color: { argb: 'FFB91C1C' }, bold: true };
    });
    [5, 11, 6, 10, 30, 24, 28, 9, 10, 10, 9, 11, 10, 10, 10, 11, 40].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + dias.length, column: cab.length } };

    // ---------------- Hoja 2: horas extra para planilla (solo aprobadas)
    const he = wb.addWorksheet(('HE planilla ' + emp.nombre_corto).slice(0, 31));
    he.mergeCells('A1:J1');
    he.getCell('A1').value = `HORAS EXTRA APROBADAS · ${emp.nombre} · ${fechaNum(o.desde)} al ${fechaNum(o.hasta)}`;
    he.getCell('A1').font = { bold: true, size: 13, color: { argb: AZUL } };
    he.getCell('A2').value = 'Sobretasa: 25 % las dos primeras horas y 35 % a partir de la tercera (D.S. 007-2002-TR). Valor hora = remuneración / 30 / 8.';
    he.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    const c2 = he.getRow(4);
    c2.values = ['DNI', 'Apellidos y nombres', 'Cargo', 'Remuneración (S/)', 'Valor hora (S/)', 'HE 25 % (h)', 'HE 35 % (h)', 'Monto 25 % (S/)', 'Monto 35 % (S/)', 'Total (S/)'];
    c2.eachCell((c) => { c.font = { bold: true, color: { argb: 'FF0B1A2B' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBAR } }; c.alignment = { horizontal: 'center', wrapText: true }; });
    c2.height = 30;
    let total = 0;
    for (const t of [...trab].sort((a, b) => a.apellidos.localeCompare(b.apellidos))) {
      let m25 = 0, m35 = 0;
      for (const d of dias) {
        if (d.trabajador_id !== t.id || !d.extraMin) continue;
        if (estadoHE(o.aprobaciones, t.id, d.fecha) !== 'aprobada') continue;
        m25 += d.extra25Min; m35 += d.extra35Min;
      }
      if (!m25 && !m35) continue;
      const vh = valorHora(t.remuneracion);
      const p25 = vh * 1.25 * (m25 / 60);
      const p35 = vh * 1.35 * (m35 / 60);
      total += p25 + p35;
      he.addRow([t.dni, `${t.apellidos}, ${t.nombres}`, t.cargo, t.remuneracion, round2(vh), round2(m25 / 60), round2(m35 / 60), round2(p25), round2(p35), round2(pagoExtra(t.remuneracion, m25, m35))]);
    }
    const tr = he.addRow(['', 'TOTAL', '', '', '', '', '', '', '', round2(total)]);
    tr.font = { bold: true };
    [12, 32, 24, 14, 12, 11, 11, 14, 14, 13].forEach((w, i) => { he.getColumn(i + 1).width = w; });
    for (const col of [4, 5, 8, 9, 10]) he.getColumn(col).numFmt = '#,##0.00';
  }

  const buf = await wb.xlsx.writeBuffer();
  descargar(buf as ArrayBuffer, nombreArchivo('Registro_Asistencia', o.empresas, o.desde, o.hasta));
}

function round2(n: number) { return Math.round(n * 100) / 100; }
