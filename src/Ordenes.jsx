import { useState, useEffect, useRef } from 'react';

// ================= CONFIGURACIÓN (edita aquí) =================
// Las sucursales se agregan y borran desde la app (sección 🏬 Sucursales)
// Palabras que se eliminan automáticamente de los nombres de producto
const PALABRAS_QUITAR = ['MICROGREEN', 'ARAUAK'];
// Dirección del Worker que lee las imágenes
const API_URL = 'https://agro-calculadora.ewuardp.workers.dev/api/extract';
// ==============================================================

const leer = (k, def) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
};
const guardar = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento disponible */ }
};

const limpiar = (texto) => {
  let t = String(texto || '');
  for (const p of PALABRAS_QUITAR) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(new RegExp(`\\b${esc}\\b`, 'gi'), ' ');
  }
  return t.replace(/\s+/g, ' ').replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, '').trim();
};

const reducirImagen = (file, max = 1600) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    resolve({ dataUrl, base64: dataUrl.split(',')[1] });
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
  img.src = url;
});

const construirMensaje = ({ orden, sucursal, items, fecha }) => {
  const lineas = items
    .filter((i) => i.nombre.trim())
    .map((i) => `• ${i.cantidad} ${i.unidad} ${i.nombre}`.replace(/\s+/g, ' '));
  return [
    `*ORDEN DE PEDIDO*${orden ? ` N° ${orden}` : ''}`,
    `Sucursal: ${sucursal}`,
    `Fecha: ${fecha}`,
    '',
    ...lineas,
  ].join('\n');
};

// Acepta 0412 1234567, 4121234567 o 584121234567 y lo deja como 584121234567
const normalizarTel = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('0')) return `58${d.slice(1)}`;
  if (d.length === 10 && d.startsWith('4')) return `58${d}`;
  return d;
};

const linkWhatsApp = (sucursales, sucursal, mensaje) => {
  const tel = normalizarTel(sucursales.find((s) => s.nombre === sucursal)?.tel);
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
};

export default function Ordenes() {
  const [pin, setPin] = useState(() => leer('agro_pin', ''));
  const [verPin, setVerPin] = useState(false);
  const [preview, setPreview] = useState(null);
  const [orden, setOrden] = useState('');
  const [items, setItems] = useState([]);
  const [sucursal, setSucursal] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [historial, setHistorial] = useState(() => leer('agro_ordenes', []));
  const [sucursales, setSucursales] = useState(() => leer('agro_sucursales', []));
  const [panelSuc, setPanelSuc] = useState(false);
  const [nuevaNombre, setNuevaNombre] = useState('');
  const [nuevaTel, setNuevaTel] = useState('');
  const inputRef = useRef(null);

  const procesar = async (file) => {
    if (!file) return;
    setError(''); setAviso(''); setCargando(true);
    try {
      const { dataUrl, base64 } = await reducirImagen(file);
      setPreview(dataUrl);
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Pin': pin.trim() },
        body: JSON.stringify({ image: base64, mime: 'image/jpeg' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `Error al leer la imagen (código ${r.status})`);
      setOrden(data.orden || '');
      setItems(
        (data.items || [])
          .map((i) => ({ nombre: limpiar(i.nombre), cantidad: String(i.cantidad ?? ''), unidad: i.unidad || '' }))
          .filter((i) => i.nombre)
      );
    } catch (e) {
      setError(e instanceof TypeError ? 'No se pudo conectar con el servidor. Revisa tu internet.' : e.message);
    } finally {
      setCargando(false);
    }
  };

  // Pegar imagen con Ctrl+V (PC)
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
      if (f) procesar(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const cambiarItem = (idx, campo, valor) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));

  const actualizarSucursales = (lista) => { setSucursales(lista); guardar('agro_sucursales', lista); };

  const agregarSucursal = () => {
    const nombre = nuevaNombre.trim();
    if (!nombre) return;
    if (sucursales.some((x) => x.nombre.toLowerCase() === nombre.toLowerCase())) return;
    actualizarSucursales([...sucursales, { nombre, tel: nuevaTel.trim() }]);
    setNuevaNombre(''); setNuevaTel('');
  };

  const borrarSucursal = (nombre) => {
    actualizarSucursales(sucursales.filter((x) => x.nombre !== nombre));
    if (sucursal === nombre) setSucursal('');
  };

  const nueva = () => { setPreview(null); setOrden(''); setItems([]); setError(''); setAviso(''); };

  const datosActuales = () => ({
    orden, sucursal, items, fecha: new Date().toLocaleDateString('es-VE'),
  });

  const enviar = () => {
    const d = datosActuales();
    const nuevoHist = [{ id: Date.now(), ...d }, ...historial].slice(0, 30);
    setHistorial(nuevoHist);
    guardar('agro_ordenes', nuevoHist);
    window.open(linkWhatsApp(sucursales, sucursal, construirMensaje(d)), '_blank');
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(construirMensaje(datosActuales()));
      setAviso('Copiado ✔');
    } catch {
      setAviso('No se pudo copiar');
    }
  };

  const listo = sucursal && items.some((i) => i.nombre.trim());

  return (
    <div className="space-y-5">
      <section className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h2 className="text-sm font-bold text-[#005c29] mb-3">1. Orden recibida (foto o captura)</h2>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { procesar(e.target.files?.[0]); e.target.value = ''; }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={cargando}
          className="w-full bg-[#005c29] text-white font-bold py-3 rounded-lg disabled:opacity-50"
        >
          {cargando ? 'Leyendo orden…' : '📷 Subir foto o captura'}
        </button>
        <p className="text-[11px] text-gray-500 mt-2 text-center">En PC también puedes pegar con Ctrl+V</p>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-[11px] font-semibold text-gray-600">PIN</label>
          <input
            type={verPin ? 'text' : 'password'}
            value={pin}
            onChange={(e) => { setPin(e.target.value); guardar('agro_pin', e.target.value); }}
            className="flex-1 border rounded p-1 text-sm"
            placeholder="PIN de acceso"
          />
          <button type="button" onClick={() => setVerPin((v) => !v)} className="text-lg px-1" aria-label="Mostrar u ocultar PIN">
            {verPin ? '🙈' : '👁️'}
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      <section className="border border-gray-200 rounded-lg">
        <button
          onClick={() => setPanelSuc((v) => !v)}
          className="w-full flex justify-between items-center p-3 text-sm font-bold text-gray-700"
        >
          <span>🏬 Sucursales ({sucursales.length})</span>
          <span>{panelSuc ? '▲' : '▼'}</span>
        </button>
        {panelSuc && (
          <div className="p-3 pt-0 space-y-3">
            {sucursales.length === 0 && (
              <p className="text-xs text-gray-500">Aún no hay sucursales. Agrega la primera aquí abajo.</p>
            )}
            <ul className="space-y-2">
              {sucursales.map((x) => (
                <li key={x.nombre} className="flex justify-between items-center text-sm bg-gray-50 border rounded p-2">
                  <span>
                    <b>{x.nombre}</b>
                    <span className="block text-[11px] text-gray-500">{x.tel ? `WhatsApp: ${normalizarTel(x.tel)}` : 'Sin número de WhatsApp'}</span>
                  </span>
                  <button onClick={() => borrarSucursal(x.nombre)} className="text-red-500 font-black px-2">✕</button>
                </li>
              ))}
            </ul>
            <div className="space-y-2 bg-gray-50 border rounded p-2">
              <input
                value={nuevaNombre}
                onChange={(e) => setNuevaNombre(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                placeholder="Nombre de la sucursal"
              />
              <input
                value={nuevaTel}
                inputMode="tel"
                onChange={(e) => setNuevaTel(e.target.value)}
                className="w-full border rounded p-2 text-sm"
                placeholder="WhatsApp (ej. 0412 1234567)"
              />
              <button
                onClick={agregarSucursal}
                disabled={!nuevaNombre.trim()}
                className="w-full bg-[#005c29] text-white font-bold py-2 rounded disabled:opacity-40"
              >
                + Agregar sucursal
              </button>
            </div>
          </div>
        )}
      </section>

      {preview && (
        <img src={preview} alt="Orden" className="w-full max-h-48 object-contain rounded-lg border bg-gray-50" />
      )}

      {items.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 border-b pb-2">2. Revisa y corrige</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-600">N° de orden</label>
            <input value={orden} onChange={(e) => setOrden(e.target.value)} className="w-full border rounded p-2 font-bold" />
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                value={it.cantidad}
                inputMode="decimal"
                onChange={(e) => cambiarItem(idx, 'cantidad', e.target.value)}
                className="w-16 border rounded p-2 text-center font-bold"
              />
              <input
                value={it.unidad}
                onChange={(e) => cambiarItem(idx, 'unidad', e.target.value)}
                className="w-16 border rounded p-2 text-center text-sm"
                placeholder="und"
              />
              <input
                value={it.nombre}
                onChange={(e) => cambiarItem(idx, 'nombre', e.target.value)}
                className="flex-1 min-w-0 border rounded p-2 text-sm"
              />
              <button onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-red-500 font-black px-1">✕</button>
            </div>
          ))}
          <button
            onClick={() => setItems((p) => [...p, { nombre: '', cantidad: '', unidad: '' }])}
            className="text-sm font-bold text-[#005c29]"
          >
            + Agregar producto
          </button>

          <div>
            <label className="block text-xs font-semibold text-gray-600">Sucursal de destino</label>
            <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} className="w-full border rounded p-2 bg-white font-bold">
              <option value="">Selecciona…</option>
              {sucursales.map((s) => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={enviar} disabled={!listo} className="bg-[#25d366] text-white font-bold py-3 rounded-lg disabled:opacity-40">
              Enviar por WhatsApp
            </button>
            <button onClick={copiar} disabled={!listo} className="bg-gray-700 text-white font-bold py-3 rounded-lg disabled:opacity-40">
              Copiar texto
            </button>
          </div>
          {aviso && <p className="text-center text-sm font-semibold text-[#005c29]">{aviso}</p>}
          <button onClick={nueva} className="w-full text-sm text-gray-500 underline">Nueva orden</button>
        </section>
      )}

      {historial.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-gray-700 border-b pb-2 mb-2">Historial (en este teléfono)</h2>
          <ul className="space-y-2">
            {historial.map((h) => (
              <li key={h.id} className="flex justify-between items-center text-sm bg-gray-50 border rounded p-2">
                <span>
                  <b>{h.orden ? `N° ${h.orden}` : 'Sin N°'}</b> · {h.sucursal}
                  <span className="block text-[11px] text-gray-500">{h.fecha} · {h.items.length} productos</span>
                </span>
                <button
                  onClick={() => window.open(linkWhatsApp(sucursales, h.sucursal, construirMensaje(h)), '_blank')}
                  className="text-[#25d366] font-bold"
                >
                  Reenviar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
