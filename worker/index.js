// Worker de Cloudflare: sirve la calculadora (assets) y expone /api/extract
// Secretos necesarios (Cloudflare): GEMINI_API_KEY, ACCESS_PIN
// Opcional: GEMINI_MODEL (por defecto gemini-3.5-flash)

const PROMPT = `Eres un asistente que lee órdenes de compra recibidas por WhatsApp (capturas o fotos).
Extrae:
- orden: el número de orden de compra (texto). Si no aparece, cadena vacía.
- items: lista de productos pedidos, cada uno con:
  - nombre: el nombre del producto tal como aparece, sin códigos internos ni precios.
  - cantidad: número pedido.
  - unidad: unidad si aparece (kg, und, caja, bulto, etc.); si no, cadena vacía.
No inventes productos. Ignora saludos, totales, direcciones y cualquier texto que no sea un producto pedido.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    orden: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING' },
          cantidad: { type: 'NUMBER' },
          unidad: { type: 'STRING' },
        },
        required: ['nombre', 'cantidad'],
      },
    },
  },
  required: ['items'],
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Comparación de PIN en tiempo constante
const igual = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

async function extraer(request, env) {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const pin = request.headers.get('X-Pin') || '';
  if (!env.ACCESS_PIN || !igual(pin, env.ACCESS_PIN)) {
    return json({ error: 'PIN incorrecto' }, 401);
  }
  if (!env.GEMINI_API_KEY) return json({ error: 'Falta configurar GEMINI_API_KEY' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Solicitud inválida' }, 400);
  }
  const { image, mime } = body || {};
  if (!image || typeof image !== 'string' || image.length > 6_000_000) {
    return json({ error: 'Imagen ausente o demasiado grande' }, 400);
  }

  const model = env.GEMINI_MODEL || 'gemini-3.5-flash';
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: PROMPT }, { inlineData: { mimeType: mime || 'image/jpeg', data: image } }] },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          temperature: 0,
        },
      }),
    }
  );

  if (!resp.ok) {
    const detalle = await resp.text();
    console.error('Gemini error', resp.status, detalle);
    return json({ error: `Gemini respondió con error ${resp.status}` }, 502);
  }

  try {
    const data = await resp.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const out = JSON.parse(texto);
    return json({ orden: out.orden || '', items: Array.isArray(out.items) ? out.items : [] });
  } catch {
    return json({ error: 'No se pudo interpretar la respuesta de Gemini' }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/extract') return extraer(request, env);
    return env.ASSETS.fetch(request);
  },
};
