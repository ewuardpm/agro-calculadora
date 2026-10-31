import { jsPDF } from 'jspdf';

// ================= Almacenamiento =================
// Pedidos guardados en localStorage (no se guardan imágenes: solo los datos y el N° de orden)
const KEY = 'agro_pedidos';

export const leerPedidos = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};
export const guardarPedidos = (p) => {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
};

// ================= Semana =================
const lunesDe = (d) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const fmt = (d) => d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' });
export const etiquetaSemana = (iso) => {
  const l = new Date(`${iso}T00:00:00`); const d = new Date(l); d.setDate(l.getDate() + 6);
  return `Semana del ${fmt(l)} al ${fmt(d)}`;
};
const nuevaSemana = () => ({ id: lunesDe(new Date()).toISOString().slice(0, 10), cerrada: false, ordenes: [], envios: [] });

export const semanaAbierta = (pedidos) => pedidos.find((p) => !p.cerrada) || null;

// ================= Registrar una orden =================
// Misma sucursal + mismo N° de orden = es un cambio sobre la orden anterior.
// Si ya había sido enviada, pasa a "modificada"; si no, queda "pendiente".
export const registrarOrden = async ({ orden, sucursal, items, fecha }) => {
  const pedidos = leerPedidos();
  let sem = semanaAbierta(pedidos);
  if (!sem) { sem = nuevaSemana(); pedidos.unshift(sem); }
  const limpios = items.filter((i) => i.nombre.trim()).map((i) => ({ ...i }));
  const previa = orden && sem.ordenes.find((o) => o.sucursal === sucursal && o.orden === orden);
  let id;
  if (previa) {
    id = previa.id;
    previa.items = limpios;
    previa.fecha = fecha;
    previa.estado = previa.enviadoItems ? 'modificada' : 'pendiente';
  } else {
    id = Date.now();
    sem.ordenes.push({ id, orden, sucursal, fecha, items: limpios, estado: 'pendiente', enviadoItems: null });
  }
  guardarPedidos(pedidos);
  return { pedidos, modificada: !!previa };
};

// ================= Cambios respecto a lo ya enviado =================
const num = (v) => parseFloat(String(v).replace(',', '.')) || 0;
const clave = (n) => n.trim().toLowerCase();
export const cambios = (antes, ahora) => {
  if (!antes) return [];
  const a = new Map(antes.map((i) => [clave(i.nombre), i]));
  const b = new Map(ahora.map((i) => [clave(i.nombre), i]));
  const out = [];
  for (const [k, i] of b) {
    if (!a.has(k)) out.push(`Nuevo: ${i.nombre} ${i.cantidad}`);
    else if (num(a.get(k).cantidad) !== num(i.cantidad)) out.push(`${i.nombre}: ${a.get(k).cantidad} -> ${i.cantidad}`);
  }
  for (const [k, i] of a) if (!b.has(k)) out.push(`Eliminado: ${i.nombre}`);
  return out;
};

// Matriz producto x sucursal (suma por sucursal y total global)
export const matriz = (ordenes) => {
  const sucs = [...new Set(ordenes.map((o) => o.sucursal))];
  const prods = new Map();
  for (const o of ordenes) {
    for (const i of o.items) {
      const k = clave(i.nombre);
      if (!prods.has(k)) prods.set(k, { nombre: i.nombre, porSuc: {} });
      const p = prods.get(k);
      p.porSuc[o.sucursal] = (p.porSuc[o.sucursal] || 0) + num(i.cantidad);
    }
  }
  const filas = [...prods.values()].map((p) => ({ ...p, total: Object.values(p.porSuc).reduce((s, v) => s + v, 0) }));
  return { sucs, filas };
};

// ================= PDF =================
export const nombreArchivo = (sem, tipo, n) =>
  `Pedido_${sem.id}_${tipo.toUpperCase()}${n}_${new Date().toISOString().slice(0, 10)}.pdf`;

export const generarPDF = async ({ sem, tipo, numero, ordenes }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 12; const H = 297;
  let y = M;
  const salto = (alto) => { if (y + alto > H - M) { doc.addPage(); y = M; } };
  const texto = (t, x, tam = 10, bold = false) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(tam); doc.text(String(t), x, y); };

  doc.setFillColor(0, 92, 41); doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255); y = 10; texto('Inversiones Agro Delivery P&H, C.A.', M, 14, true);
  y = 17; texto(`PEDIDO ${tipo === 'definitivo' ? 'DEFINITIVO' : `PARCIAL N° ${numero}`}  -  ${etiquetaSemana(sem.id)}  -  Enviado: ${new Date().toLocaleDateString('es-VE')}`, M, 9);
  doc.setTextColor(0); y = 32;

  // 1) Matriz producto x sucursal
  const { sucs, filas } = matriz(ordenes);
  texto('Resumen por sucursal', M, 12, true); y += 6;
  const wProd = 44; const wTot = 16;
  const wCol = Math.min(24, (W - 2 * M - wProd - wTot) / Math.max(1, sucs.length));
  const fila = (celdas, bold, fondo) => {
    salto(7);
    if (fondo) { doc.setFillColor(...fondo); doc.rect(M, y - 4.5, wProd + wCol * sucs.length + wTot, 6.5, 'F'); }
    texto(celdas[0], M + 1, 9, bold);
    sucs.forEach((_, i) => texto(celdas[i + 1], M + wProd + wCol * i + 1, 9, bold));
    texto(celdas[sucs.length + 1], M + wProd + wCol * sucs.length + 1, 9, true);
    y += 6.5;
  };
  fila(['Producto', ...sucs.map((s) => s.slice(0, 11)), 'TOTAL'], true, [225, 240, 230]);
  filas.forEach((f) => fila([f.nombre.slice(0, 24), ...sucs.map((s) => f.porSuc[s] ?? '-'), f.total], false));
  y += 6;

  // 2) Detalle por sucursal (se factura por sucursal)
  texto('Detalle por sucursal', M, 12, true); y += 7;
  for (const o of ordenes) {
    salto(14 + o.items.length * 5.5);
    doc.setFillColor(235, 235, 235); doc.rect(M, y - 4.5, W - 2 * M, 7, 'F');
    texto(`${o.sucursal}  -  Orden N° ${o.orden || 's/n'}  -  ${o.fecha}`, M + 1, 10, true);
    if (o.estado === 'modificada') { doc.setTextColor(200, 0, 0); texto('MODIFICADO', W - M - 28, 10, true); doc.setTextColor(0); }
    y += 7;
    o.items.forEach((i) => { texto(`${i.cantidad} ${i.unidad || ''}`.trim(), M + 2, 9); texto(i.nombre, M + 30, 9); y += 5.5; });
    const c = o.estado === 'modificada' ? cambios(o.enviadoItems, o.items) : [];
    if (c.length) {
      doc.setTextColor(200, 0, 0); y += 1; texto('Cambios respecto al envío anterior:', M + 2, 9, true); y += 5;
      c.forEach((t) => { salto(6); texto(`- ${t}`, M + 4, 9); y += 5; });
      doc.setTextColor(0);
    }
    y += 5;
  }

  return doc.output('blob');
};

// Compartir (WhatsApp, OneDrive, etc. desde el teléfono) o descargar
export const entregarArchivo = async (blob, nombre) => {
  const file = new File([blob], nombre, { type: 'application/pdf' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: nombre }); return 'compartido'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelado'; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'descargado';
};
