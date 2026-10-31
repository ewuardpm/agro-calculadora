import { useState } from 'react';
import {
  leerPedidos, guardarPedidos, semanaAbierta, etiquetaSemana, matriz,
  generarPDF, nombreArchivo, entregarArchivo,
} from './pedidoSemanal.js';

const CHIP = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  modificada: 'bg-red-100 text-red-700',
  enviada: 'bg-green-100 text-green-800',
};

export default function Pedido() {
  const [pedidos, setPedidos] = useState(leerPedidos);
  const [sel, setSel] = useState({});
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  const sem = semanaAbierta(pedidos);
  const ordenes = sem?.ordenes || [];
  const enviables = ordenes.filter((o) => o.estado !== 'enviada');
  // por defecto van marcadas todas las pendientes y modificadas
  const marcada = (o) => sel[o.id] ?? true;
  const elegidas = enviables.filter(marcada);

  const guardar = (p) => { setPedidos(p); guardarPedidos(p); };

  const quitar = (id) => {
    if (!window.confirm('¿Quitar esta orden del pedido semanal?')) return;
    const p = structuredClone(pedidos);
    const s = semanaAbierta(p);
    s.ordenes = s.ordenes.filter((o) => o.id !== id);
    guardar(p);
  };

  const enviar = async (tipo) => {
    if (!elegidas.length) return;
    if (tipo === 'definitivo' && !window.confirm('Pedido DEFINITIVO: se cerrará la semana. ¿Continuar?')) return;
    setOcupado(true); setAviso('');
    try {
      const numero = sem.envios.filter((e) => e.tipo === 'parcial').length + 1;
      const snapshot = structuredClone(elegidas);
      const blob = await generarPDF({ sem, tipo, numero, ordenes: snapshot });
      const nombre = nombreArchivo(sem, tipo === 'parcial' ? 'parcial' : 'definitivo', tipo === 'parcial' ? numero : '');
      const r = await entregarArchivo(blob, nombre);
      if (r === 'cancelado') { setAviso('Envío cancelado; no se marcó nada como enviado.'); return; }
      const p = structuredClone(pedidos);
      const s = semanaAbierta(p);
      const ids = new Set(snapshot.map((o) => o.id));
      s.ordenes.forEach((o) => { if (ids.has(o.id)) { o.estado = 'enviada'; o.enviadoItems = structuredClone(o.items); } });
      s.envios.push({ id: Date.now(), tipo, numero, fecha: new Date().toLocaleString('es-VE'), nombre, ordenes: snapshot });
      if (tipo === 'definitivo') s.cerrada = true;
      guardar(p); setSel({});
      setAviso(r === 'descargado' ? `Descargado: ${nombre}. Guárdalo en OneDrive.` : 'Enviado ✔ (si elegiste OneDrive, ya quedó el respaldo)');
    } catch (e) {
      setAviso(`No se pudo generar el PDF: ${e.message}`);
    } finally {
      setOcupado(false);
    }
  };

  const descargarDeNuevo = async (s, e) => {
    setOcupado(true);
    try { await entregarArchivo(await generarPDF({ sem: s, tipo: e.tipo, numero: e.numero, ordenes: e.ordenes }), e.nombre); }
    finally { setOcupado(false); }
  };

  const { sucs, filas } = matriz(ordenes);
  const todos = pedidos.flatMap((s) => s.envios.map((e) => ({ s, e }))).reverse();

  return (
    <div className="space-y-5">
      <section className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h2 className="text-sm font-bold text-[#005c29]">📋 Pedido semanal al proveedor</h2>
        <p className="text-xs text-gray-600 mt-1">
          {sem ? etiquetaSemana(sem.id) : 'No hay semana abierta. Se crea sola al guardar la primera orden desde 📲 Órdenes.'}
        </p>
      </section>

      {ordenes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-gray-700 border-b pb-2">Sucursales de la semana</h2>
          {ordenes.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-sm bg-gray-50 border rounded p-2">
              {o.estado !== 'enviada' ? (
                <input type="checkbox" checked={marcada(o)} onChange={(e) => setSel({ ...sel, [o.id]: e.target.checked })} className="w-5 h-5" />
              ) : <span className="w-5" />}
              <span className="flex-1 min-w-0">
                <b>{o.sucursal}</b>{` · N° ${o.orden || 's/n'}`}
                <span className="block text-[11px] text-gray-500">{o.fecha} · {o.items.length} productos</span>
              </span>
              <span className={`text-[11px] font-bold px-2 py-1 rounded ${CHIP[o.estado]}`}>{o.estado}</span>
              {o.estado === 'pendiente' && <button onClick={() => quitar(o.id)} className="text-red-500 font-black px-1">✕</button>}
            </div>
          ))}
        </section>
      )}

      {filas.length > 0 && (
        <section className="overflow-x-auto">
          <h2 className="text-sm font-bold text-gray-700 border-b pb-2 mb-2">Consolidado de la semana</h2>
          <table className="text-xs w-full border">
            <thead className="bg-green-50">
              <tr>
                <th className="text-left p-1">Producto</th>
                {sucs.map((s) => <th key={s} className="p-1">{s}</th>)}
                <th className="p-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.nombre} className="border-t">
                  <td className="p-1">{f.nombre}</td>
                  {sucs.map((s) => <td key={s} className="p-1 text-center">{f.porSuc[s] ?? '–'}</td>)}
                  <td className="p-1 text-center font-bold">{f.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {sem && (
        <section className="space-y-2">
          <p className="text-xs text-gray-600">
            Se enviarán {elegidas.length} sucursal(es) marcada(s). Las ya enviadas no se repiten, salvo que estén “modificada”.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => enviar('parcial')} disabled={ocupado || !elegidas.length} className="bg-[#25d366] text-white font-bold py-3 rounded-lg disabled:opacity-40">
              {ocupado ? 'Generando…' : 'Enviar PARCIAL'}
            </button>
            <button onClick={() => enviar('definitivo')} disabled={ocupado || !elegidas.length} className="bg-[#005c29] text-white font-bold py-3 rounded-lg disabled:opacity-40">
              Enviar DEFINITIVO
            </button>
          </div>
          {aviso && <p className="text-center text-sm font-semibold text-[#005c29]">{aviso}</p>}
        </section>
      )}

      {todos.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-700 border-b pb-2 mb-2">Envíos realizados</h2>
          <ul className="space-y-2">
            {todos.map(({ s, e }) => (
              <li key={e.id} className="flex justify-between items-center text-sm bg-gray-50 border rounded p-2">
                <span>
                  <b>{e.tipo === 'definitivo' ? 'Definitivo' : `Parcial ${e.numero}`}</b> · {etiquetaSemana(s.id)}
                  <span className="block text-[11px] text-gray-500">{e.fecha} · {e.ordenes.map((o) => o.sucursal).join(', ')}</span>
                </span>
                <button onClick={() => descargarDeNuevo(s, e)} disabled={ocupado} className="text-[#005c29] font-bold">PDF</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
