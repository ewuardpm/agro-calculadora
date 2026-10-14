import React, { useState } from 'react';

export default function AgroDeliveryApp() {
  const [modoActivo, setModoActivo] = useState('compras');

  // ==========================================
  // ESTADOS: MESA
  // ==========================================
  const [yMesa, setYMesa] = useState('');
  const [aMesa, setAMesa] = useState('');
  const [oMesa, setOMesa] = useState('');
  const [auMesa, setAuMesa] = useState('');
  const [cMesa, setCMesa] = useState('');
  const [cambiosMesa, setCambiosMesa] = useState('');

  // ==========================================
  // ESTADOS: COMPRAS
  // ==========================================
  const [mBolsas, setMBolsas] = useState('');
  const [mCambios, setMCambios] = useState('');
  const [margen, setMargen] = useState('30');
  
  const [pOcumo, setPOcumo] = useState('6.00');
  const [pApio, setPApio] = useState('2.50');
  const [pYuca, setPYuca] = useState('2.00');
  const [pAuyama, setPAuyama] = useState('1.00');
  const [pCelery, setPCelery] = useState('1.00');

  // Lector de números a prueba de fallos
  const num = (valor) => {
    if (!valor || valor === '') return 0;
    const normalizado = String(valor).replace(',', '.');
    const parseado = parseFloat(normalizado);
    return isNaN(parseado) ? 0 : parseado;
  };

  // ==========================================
  // LÓGICA: MODO EMPAQUETADO 
  // ==========================================
  const pesoTotalMesa = num(yMesa) + num(aMesa) + num(oMesa) + num(auMesa) + num(cMesa);
  const grupoSurtidoMesa = num(yMesa) + num(aMesa) + num(oMesa);
  
  let pctCelery = pesoTotalMesa > 0 ? num(cMesa) / pesoTotalMesa : 0;
  let pctAuyama = pesoTotalMesa > 0 ? num(auMesa) / pesoTotalMesa : 0;
  let pctSurtido = pesoTotalMesa > 0 ? grupoSurtidoMesa / pesoTotalMesa : 0;

  if (pctCelery > 0.05) {
    const excedente = pctCelery - 0.05;
    pctCelery = 0.05;
    const subTotal = pctAuyama + pctSurtido;
    if (subTotal > 0) {
      pctAuyama += excedente * (pctAuyama / subTotal);
      pctSurtido += excedente * (pctSurtido / subTotal);
    }
  }

  const recetaCambio = {
    surtido: Math.round(800 * pctSurtido),
    auyama: Math.round(800 * pctAuyama),
    celery: Math.round(800 * pctCelery)
  };
  const recetaBolsa = {
    surtido: Math.round(1000 * pctSurtido),
    auyama: Math.round(1000 * pctAuyama),
    celery: Math.round(1000 * pctCelery)
  };

  const kilosUsados = (800 * num(cambiosMesa)) / 1000;
  const kilosRestantesMesa = pesoTotalMesa - kilosUsados;
  const bolsasLogrables = kilosRestantesMesa > 0 ? Math.floor(kilosRestantesMesa) : 0;
  const remanenteGramos = kilosRestantesMesa > 0 ? Math.round((kilosRestantesMesa % 1) * 1000) : 0;

  // ==========================================
  // LÓGICA: MODO COMPRAS Y GANANCIA NETA
  // ==========================================
  const pesoTotalCompras = (num(mBolsas) * 1) + (num(mCambios) * 0.8);
  
  const kCelery = pesoTotalCompras > 0 ? Math.ceil(pesoTotalCompras * 0.05) : 0;
  const kAuyama = pesoTotalCompras > 0 ? Math.ceil(pesoTotalCompras * 0.27) : 0;
  const kSurtidoBase = pesoTotalCompras * 0.68;

  let tuberculos = [
    { nombre: 'Yuca', precio: num(pYuca) },
    { nombre: 'Apio', precio: num(pApio) },
    { nombre: 'Ocumo', precio: num(pOcumo) }
  ].sort((a, b) => a.precio - b.precio);

  if (pesoTotalCompras > 0) {
    tuberculos[0].kilos = Math.ceil(kSurtidoBase * 0.50);
    tuberculos[1].kilos = Math.ceil(kSurtidoBase * 0.30);
    tuberculos[2].kilos = Math.ceil(kSurtidoBase * 0.20);
  } else {
    tuberculos[0].kilos = 0; tuberculos[1].kilos = 0; tuberculos[2].kilos = 0;
  }

  const costoCelery = kCelery * num(pCelery);
  const costoAuyama = kAuyama * num(pAuyama);
  const costoSurtido = tuberculos.reduce((acc, t) => acc + (t.kilos * t.precio), 0);
  
  const costoTotalInversion = costoCelery + costoAuyama + costoSurtido;
  const kilosTotalesComprados = kCelery + kAuyama + tuberculos.reduce((acc, t) => acc + t.kilos, 0);
  
  // FINANZAS: Costo Real y Precio de Venta (Dividiendo por factor complementario)
  const costoRealPorKilo = kilosTotalesComprados > 0 ? costoTotalInversion / kilosTotalesComprados : 0;
  const factorComplementario = (100 - num(margen)) / 100;
  const ventaBolsa = factorComplementario > 0 ? (costoRealPorKilo * 1) / factorComplementario : 0;
  
  // FINANZAS: Cálculo de Ganancia Neta y Rendimiento Real
  const ingresoBruto = num(mBolsas) * ventaBolsa; // Solo las bolsas generan dinero
  const costoAbsorbidoPorCambio = costoRealPorKilo * 0.8;
  const gananciaNeta = ingresoBruto - costoTotalInversion;
  const porcentajeReal = ingresoBruto > 0 ? (gananciaNeta / ingresoBruto) * 100 : (gananciaNeta < 0 ? -100 : 0);

  // ==========================================
  // NUEVA LÓGICA: ENVIAR A WHATSAPP
  // ==========================================
  const enviarPorWhatsApp = () => {
    // Número de Irte formateado para la API internacional de WhatsApp
    const numeroIrte = "584241399538"; 
    
    // Mapeamos dinámicamente los tubérculos para que el mensaje respete el orden (Más económico a más costoso)
    const listaTuberculos = tuberculos.map((t, idx) => {
      let etiqueta = "";
      if (idx === 0) etiqueta = "(Más económico - 50%)";
      if (idx === 1) etiqueta = "(Medio - 30%)";
      if (idx === 2) etiqueta = "(Costoso - 20%)";
      return `*${t.nombre}:* ${t.kilos} Kg ${etiqueta}`;
    }).join('%0A'); // %0A es el salto de línea en URLs

    // Construcción del texto del mensaje
    const textoMensaje = `*Pedido de Compras - Inversiones Agro Delivery P&H C.A.*%0A%0A` +
                         `Hola Irte, aquí tienes las cantidades exactas a comprar hoy:%0A%0A` +
                         `*Auyama:* ${kAuyama} Kg%0A` +
                         `*Celery:* ${kCelery} Kg (Máx 5%)%0A` +
                         `${listaTuberculos}%0A%0A` +
                         `¡Quedo atento!`;

    // Abre una nueva pestaña hacia WhatsApp Web o lanza la app móvil nativa
    window.open(`https://wa.me/${numeroIrte}?text=${textoMensaje}`, '_blank');
  };

  // Escudo Antitraducción: div con translate="no" y clase notranslate
  return (
    <div translate="no" className="notranslate min-h-screen bg-[#f8f5ee] p-2 md:p-4 font-sans text-gray-800 pb-10">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        
        <div className="bg-[#005c29] p-4 text-white text-center">
          <h1 className="text-xl font-bold">Inversiones Agro Delivery P&H</h1>
          <p className="text-[10px] uppercase tracking-wider opacity-80 mt-1">RIF: J-40846235-4</p>
          <p className="text-sm font-semibold mt-1">Gestor de Producción</p>
        </div>

        <div className="flex border-b">
          <button 
            onClick={() => setModoActivo('empaquetado')}
            className={`flex-1 py-3 font-bold text-sm transition-colors ${modoActivo === 'empaquetado' ? 'bg-white text-[#005c29] border-b-4 border-[#005c29]' : 'bg-[#e9e4d8] text-gray-600'}`}
          >
            📦 Empaquetado
          </button>
          <button 
            onClick={() => setModoActivo('compras')}
            className={`flex-1 py-3 font-bold text-sm transition-colors ${modoActivo === 'compras' ? 'bg-white text-[#005c29] border-b-4 border-[#005c29]' : 'bg-[#e9e4d8] text-gray-600'}`}
          >
            🛒 Compras
          </button>
        </div>

        <div className="p-4">
          
          {modoActivo === 'empaquetado' && (
            <div className="space-y-6">
              <section className="bg-[#f0f4f8] p-4 rounded-lg border border-blue-100">
                <h2 className="text-sm font-bold text-[#003366] mb-3">1. Materia Prima en Mesa (Kg)</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Yuca</label>
                    <input type="text" inputMode="decimal" value={yMesa} onChange={(e) => setYMesa(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold shadow-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#003366]">Apio</label>
                    <input type="text" inputMode="decimal" value={aMesa} onChange={(e) => setAMesa(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold shadow-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Ocumo</label>
                    <input type="text" inputMode="decimal" value={oMesa} onChange={(e) => setOMesa(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold shadow-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Auyama</label>
                    <input type="text" inputMode="decimal" value={auMesa} onChange={(e) => setAuMesa(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold shadow-sm" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#005c29]">Celery</label>
                    <input type="text" inputMode="decimal" value={cMesa} onChange={(e) => setCMesa(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold shadow-sm border-green-300" placeholder="0" />
                  </div>
                </div>
                <div className="mt-3 text-right text-sm font-black text-[#003366]">
                  Mesa total: {pesoTotalMesa.toFixed(2)} kg
                </div>
              </section>

              <section className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex justify-between items-center">
                <label className="text-sm font-bold text-gray-800">Cambios de 800g a armar:</label>
                <input type="text" inputMode="numeric" value={cambiosMesa} onChange={(e) => setCambiosMesa(e.target.value)} className="w-24 border rounded p-2 text-center text-lg font-black bg-gray-50" placeholder="0" />
              </section>

              <section className="border-t border-gray-200 pt-5">
                <h2 className="text-lg font-black text-[#003366] text-center mb-1">RECETA DE EMPAQUETADO</h2>
                <p className="text-xs text-center text-red-600 mb-4 font-bold">* Celery ajustado a máx. 50g por kilo</p>
                
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="bg-[#fcfaf5] border border-gray-300 rounded-lg p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-500 text-center border-b border-gray-200 pb-2 mb-2">BOLSA 1 KG</h3>
                    <ul className="text-sm space-y-2">
                      <li className="flex justify-between"><span>Surtido:</span> <b className="text-gray-800">{recetaBolsa.surtido} g</b></li>
                      <li className="flex justify-between"><span>Auyama:</span> <b className="text-gray-800">{recetaBolsa.auyama} g</b></li>
                      <li className="flex justify-between text-[#005c29] font-bold"><span>Celery:</span> <b>{recetaBolsa.celery} g</b></li>
                    </ul>
                  </div>
                  <div className="bg-[#fcfaf5] border border-gray-300 rounded-lg p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-500 text-center border-b border-gray-200 pb-2 mb-2">CAMBIO 800 g</h3>
                    <ul className="text-sm space-y-2">
                      <li className="flex justify-between"><span>Surtido:</span> <b className="text-gray-800">{recetaCambio.surtido} g</b></li>
                      <li className="flex justify-between"><span>Auyama:</span> <b className="text-gray-800">{recetaCambio.auyama} g</b></li>
                      <li className="flex justify-between text-[#005c29] font-bold"><span>Celery:</span> <b>{recetaCambio.celery} g</b></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-[#003366] to-[#005c29] text-white p-4 rounded-xl text-center shadow-md">
                  <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Rendimiento Proyectado</p>
                  <p className="text-3xl font-black mt-1">{bolsasLogrables} <span className="text-sm font-normal">Bolsas de 1kg</span></p>
                  <p className="text-xs text-yellow-300 mt-2 font-semibold">Sobra remanente de: {remanenteGramos} g</p>
                </div>
              </section>
            </div>
          )}

          {modoActivo === 'compras' && (
            <div className="space-y-5">
              <section className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h2 className="text-sm font-bold text-[#005c29] mb-3">1. Meta de Producción</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Bolsas (1 Kg)</label>
                    <input type="text" inputMode="numeric" value={mBolsas} onChange={(e) => setMBolsas(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600">Cambios (Reposición 800g)</label>
                    <input type="text" inputMode="numeric" value={mCambios} onChange={(e) => setMCambios(e.target.value)} className="w-full border rounded p-2 text-center text-lg font-bold text-red-800 bg-red-50" placeholder="0" />
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-sm font-bold text-gray-700 border-b pb-2 mb-3">2. Precios del Mercado ($/Kg)</h2>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase text-center">Ocumo</label>
                    <input type="text" inputMode="decimal" value={pOcumo} onChange={(e) => setPOcumo(e.target.value)} className="w-full border rounded p-1 text-center text-sm font-bold bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#003366] uppercase text-center">Apio</label>
                    <input type="text" inputMode="decimal" value={pApio} onChange={(e) => setPApio(e.target.value)} className="w-full border rounded p-1 text-center text-sm font-bold bg-blue-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase text-center">Yuca</label>
                    <input type="text" inputMode="decimal" value={pYuca} onChange={(e) => setPYuca(e.target.value)} className="w-full border rounded p-1 text-center text-sm font-bold bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase text-center">Auyama</label>
                    <input type="text" inputMode="decimal" value={pAuyama} onChange={(e) => setPAuyama(e.target.value)} className="w-full border rounded p-1 text-center text-sm font-bold bg-gray-50" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#005c29] uppercase text-center">Celery</label>
                    <input type="text" inputMode="decimal" value={pCelery} onChange={(e) => setPCelery(e.target.value)} className="w-full border rounded p-1 text-center text-sm font-bold bg-green-50" />
                  </div>
                </div>
              </section>

              <section className="bg-gray-800 p-4 rounded-xl text-white shadow-md">
                <h2 className="text-sm font-bold text-center mb-4 text-green-400 tracking-wide uppercase">🛒 QUÉ DEBES COMPRAR (Kilos Exactos)</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-600 pb-2">
                    <span className="font-semibold text-gray-100">Auyama</span>
                    <span className="font-bold text-xl">{kAuyama} Kg</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-600 pb-2">
                    <span className="font-semibold text-gray-100">Celery <span className="text-[10px] text-red-400 font-normal block">Máx 5%</span></span>
                    <span className="font-bold text-xl text-green-400">{kCelery} Kg</span>
                  </div>
                  {tuberculos.map((t, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-gray-600 pb-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-100">{t.nombre}</span>
                        {idx === 0 && <span className="text-[10px] text-yellow-300 italic">Más económico (50%)</span>}
                        {idx === 1 && <span className="text-[10px] text-gray-400 italic">Medio (30%)</span>}
                        {idx === 2 && <span className="text-[10px] text-red-300 italic">Costoso (20%)</span>}
                      </div>
                      <span className="font-bold text-xl">{t.kilos} Kg</span>
                    </div>
                  ))}
                </div>
                
                {/* NUEVO BOTÓN DE WHATSAPP INTEGRADO DENTRO DE LA CAJA DE COMPRAS */}
                <button
                  onClick={enviarPorWhatsApp}
                  className="mt-6 mb-2 w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors shadow-md border border-[#1ebd5b]"
                >
                  <svg className="w-5 h-5 mr-2 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                  </svg>
                  Enviar Lista a Irte
                </button>

                <div className="mt-4 pt-3 text-right bg-gray-900 -mx-4 -mb-4 p-4 rounded-b-xl">
                  <span className="text-xs text-gray-400 uppercase tracking-wide block mb-1">Inversión Exacta Estimada</span>
                  <span className="font-black text-3xl text-yellow-400">${costoTotalInversion.toFixed(2)}</span>
                </div>
              </section>

              <section className="border border-blue-200 bg-blue-50 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-black text-[#003366] uppercase">Proyección Financiera</h2>
                  <div className="flex items-center space-x-2 bg-white p-1 px-2 rounded border border-blue-200">
                    <label className="text-xs text-[#003366] font-bold">Margen Base</label>
                    <div className="flex items-center">
                      <input type="text" inputMode="numeric" value={margen} onChange={(e) => setMargen(e.target.value)} className="w-10 text-center font-black text-[#003366] outline-none" />
                      <span className="font-black text-[#003366]">%</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white p-3 rounded-lg text-center shadow-sm border border-gray-200">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Precio Bolsa 1 Kg</p>
                    <p className="text-2xl font-black text-[#005c29]">${ventaBolsa.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-100 p-3 rounded-lg text-center shadow-sm border border-gray-200 opacity-90 relative">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Cambio 800g</p>
                    <p className="text-2xl font-black text-gray-400">$0.00</p>
                    <p className="text-[9px] text-red-500 font-bold mt-1 leading-tight">COSTO ABSORBIDO: <br/>${costoAbsorbidoPorCambio.toFixed(2)} c/u</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">Ingreso Bruto (Solo Bolsas):</span>
                    <span className="font-bold text-gray-800">${ingresoBruto.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 font-semibold">Inversión Total en Compras:</span>
                    <span className="font-bold text-red-500">-${costoTotalInversion.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 mt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-gray-800 font-black uppercase text-sm">Ganancia Neta:</span>
                    <div className="text-right">
                      <span className={`text-2xl font-black ${gananciaNeta >= 0 ? 'text-[#005c29]' : 'text-red-600'}`}>
                        ${gananciaNeta.toFixed(2)}
                      </span>
                      <p className={`text-[11px] font-bold mt-1 ${porcentajeReal >= num(margen) ? 'text-[#005c29]' : (porcentajeReal > 0 ? 'text-yellow-600' : 'text-red-500')}`}>
                        Margen Real: {porcentajeReal.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
