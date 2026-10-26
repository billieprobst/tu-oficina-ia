import { createSign } from "node:crypto";
import { config } from "@/lib/config";

// Google Sheets es la "base de datos" de tu oficina: todo queda en tu propia hoja, donde lo puedes ver y editar.
// Entra con una cuenta de servicio de Google (un "robot" al que le compartes la hoja como Editor).

/** Las pestañas que usa la oficina y sus columnas. Si faltan, se crean solas. */
export const PESTANAS = {
  Eventos: ["fecha", "agente", "texto", "visita", "detalle"],
  Leads: [
    "fecha", "origen", "nombre", "telefono", "correo", "mensaje", "temperatura", "tipo", "presupuesto",
    "zona", "plazo", "credito", "resumen", "siguiente_paso", "respuesta_sugerida",
  ],
  Obra: ["fecha", "proyecto", "autor", "tipo", "texto", "archivo"],
  Reportes: ["id", "fecha", "proyecto", "desde", "hasta", "contenido"],
  Uso: ["fecha", "agente", "proveedor", "modelo", "tokens_entrada", "tokens_salida", "costo_usd"],
} as const;
export type Pestana = keyof typeof PESTANAS;

const API = "https://sheets.googleapis.com/v4/spreadsheets";
let token: { valor: string; vence: number } | null = null;

const b64url = (x: string | Buffer) => Buffer.from(x).toString("base64url");

/** Firma un JWT con la llave de la cuenta de servicio y lo cambia por un token de acceso (dura 1 hora). */
async function acceso(): Promise<string> {
  if (token && token.vence > Date.now() + 60_000) return token.valor;
  const { correo, llave } = config().sheets;
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(
    JSON.stringify({
      iss: correo,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: ahora,
      exp: ahora + 3600,
    }),
  );
  const firma = createSign("RSA-SHA256").update(`${cabecera}.${cuerpo}`).sign(llave).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cabecera}.${cuerpo}.${firma}` }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google no aceptó la cuenta de servicio (${res.status}). Revisa GOOGLE_CUENTA_CORREO y GOOGLE_CUENTA_LLAVE.`);
  const datos = (await res.json()) as { access_token: string; expires_in: number };
  token = { valor: datos.access_token, vence: Date.now() + datos.expires_in * 1000 };
  return token.valor;
}

async function pedir(ruta: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${API}/${config().sheets.id}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${await acceso()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 403 || res.status === 404) {
    throw new Error("No puedo abrir tu hoja. Revisa GOOGLE_SHEET_ID y que la compartiste como Editor con el correo de la cuenta de servicio.");
  }
  if (!res.ok) throw new Error(`Google Sheets respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

let preparada = false;

/** Crea las pestañas que falten, con sus títulos. Se puede llamar muchas veces. */
export async function prepararHoja(): Promise<string[]> {
  if (preparada) return [];
  const info = (await pedir("?fields=sheets.properties.title")) as { sheets?: { properties: { title: string } }[] };
  const existentes = new Set((info.sheets ?? []).map((s) => s.properties.title));
  const nuevas = (Object.keys(PESTANAS) as Pestana[]).filter((p) => !existentes.has(p));
  if (nuevas.length) {
    await pedir(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: nuevas.map((title) => ({ addSheet: { properties: { title } } })) }),
    });
    for (const p of nuevas) {
      await pedir(`/values/${p}!A1:append?valueInputOption=RAW`, { method: "POST", body: JSON.stringify({ values: [PESTANAS[p]] }) });
    }
  }
  preparada = true;
  return nuevas;
}

/** Una celda nunca empieza con =, +, - o @: así nadie puede colar una fórmula en tu hoja. */
export function celdaSegura(v: unknown): string | number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const t = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  const corto = t.slice(0, 45_000);
  return /^[=+\-@]/.test(corto) ? `'${corto}` : corto;
}

export async function agregarFila(pestana: Pestana, fila: Record<string, unknown>): Promise<void> {
  await prepararHoja();
  const valores = PESTANAS[pestana].map((col) => celdaSegura(fila[col]));
  await pedir(`/values/${pestana}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [valores] }),
  });
}

/** Todas las filas de una pestaña como objetos { columna: valor }. */
export async function leerFilas(pestana: Pestana): Promise<Record<string, string>[]> {
  await prepararHoja();
  const datos = (await pedir(`/values/${pestana}!A:Z`)) as { values?: string[][] };
  const [titulos, ...filas] = datos.values ?? [];
  if (!titulos) return [];
  return filas.map((f) => Object.fromEntries(titulos.map((t, i) => [t, f[i] ?? ""])));
}
