import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// Las tres IAs que puede usar tu oficina. Cada una recibe lo mismo y devuelve lo mismo:
// un JSON que cumple el esquema, más los tokens que gastó.

export interface Imagen {
  datos: Buffer;
  tipo: string; // "image/jpeg"
}

export interface Pedido {
  modelo: string;
  clave: string;
  sistema: string;
  texto: string;
  imagenes: Imagen[];
  esquema: Record<string, unknown>; // JSON Schema
}

export interface Respuesta {
  json: unknown;
  tokensEntrada: number;
  tokensSalida: number;
}

const quitarCerco = (t: string) => t.trim().replace(/^`{3}(?:json)?\s*/, "").replace(/\s*`{3}$/, "");

// ---------- Gemini (Google) ----------
export async function gemini(p: Pedido): Promise<Respuesta> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.modelo)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": p.clave, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: p.sistema }] },
      contents: [
        {
          role: "user",
          parts: [
            ...p.imagenes.map((im) => ({ inlineData: { mimeType: im.tipo, data: im.datos.toString("base64") } })),
            { text: p.texto },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: p.esquema, maxOutputTokens: 8192 },
    }),
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  const texto = (d.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? "").join("");
  return {
    json: JSON.parse(quitarCerco(texto)),
    tokensEntrada: d.usageMetadata?.promptTokenCount ?? 0,
    tokensSalida: (d.usageMetadata?.candidatesTokenCount ?? 0) + (d.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}

// ---------- Claude (Anthropic) ----------
export async function claude(p: Pedido): Promise<Respuesta> {
  const cliente = new Anthropic({ apiKey: p.clave, timeout: 55_000, maxRetries: 1 });
  const imagenes = p.imagenes.map((im) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: im.tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: im.datos.toString("base64") },
  }));
  const r = await cliente.messages.parse({
    model: p.modelo,
    max_tokens: 16000,
    system: p.sistema,
    messages: [{ role: "user", content: [...imagenes, { type: "text", text: p.texto }] }],
    output_config: {
      effort: "low",
      format: jsonSchemaOutputFormat(p.esquema as Parameters<typeof jsonSchemaOutputFormat>[0]),
    },
  });
  if (r.stop_reason === "refusal") throw new Error("Claude no quiso responder este pedido.");
  if (r.parsed_output == null) throw new Error("Claude no devolvió un JSON válido.");
  return { json: r.parsed_output, tokensEntrada: r.usage.input_tokens, tokensSalida: r.usage.output_tokens };
}

// ---------- OpenAI ----------
/** El modo estricto de OpenAI pide additionalProperties: false en cada objeto. */
export function esquemaEstricto(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(esquemaEstricto);
  if (!s || typeof s !== "object") return s;
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (k !== "$schema") o[k] = esquemaEstricto(v);
  if (o.type === "object") o.additionalProperties = false;
  return o;
}

export async function openai(p: Pedido): Promise<Respuesta> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${p.clave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.modelo,
      messages: [
        { role: "system", content: p.sistema },
        {
          role: "user",
          content: [
            ...p.imagenes.map((im) => ({ type: "image_url", image_url: { url: `data:${im.tipo};base64,${im.datos.toString("base64")}` } })),
            { type: "text", text: p.texto },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: { name: "respuesta", strict: true, schema: esquemaEstricto(p.esquema) } },
    }),
    signal: AbortSignal.timeout(55_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as {
    choices?: { message?: { content?: string; refusal?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const m = d.choices?.[0]?.message;
  if (m?.refusal) throw new Error("OpenAI no quiso responder este pedido.");
  return { json: JSON.parse(quitarCerco(m?.content ?? "")), tokensEntrada: d.usage?.prompt_tokens ?? 0, tokensSalida: d.usage?.completion_tokens ?? 0 };
}
