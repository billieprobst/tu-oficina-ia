// Toda la configuración sale de las variables de entorno (en Vercel: Settings → Environment Variables).
// Este archivo solo las lee y dice qué falta. Nunca muestra una clave.

export type Proveedor = "gemini" | "claude" | "openai";
export type TipoNegocio = "asesor" | "constructor" | "ambos";

const texto = (n: string) => (process.env[n] ?? "").trim();
const lista = (n: string) =>
  texto(n)
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
const numero = (n: string, porDefecto: number) => {
  const v = Number(texto(n).replace(",", "."));
  return Number.isFinite(v) && v > 0 ? v : porDefecto;
};

export const MODELO_POR_DEFECTO: Record<Proveedor, string> = {
  gemini: "gemini-3.8-flash",
  claude: "claude-opus-5-5",
  openai: "gpt-5.4-mini",
};
const LLAVE: Record<Proveedor, string> = { gemini: "GEMINI_API_KEY", claude: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY" };

export function config() {
  const p = texto("IA_PROVEEDOR").toLowerCase();
  const proveedor: Proveedor = p === "claude" || p === "openai" ? p : "gemini";
  const t = texto("NEGOCIO_TIPO").toLowerCase();
  const tipo: TipoNegocio = t === "asesor" || t === "constructor" ? t : "ambos";
  return {
    ia: {
      proveedor,
      clave: texto(LLAVE[proveedor]),
      nombreClave: LLAVE[proveedor],
      modelo: texto("IA_MODELO") || MODELO_POR_DEFECTO[proveedor],
      /** Precio en USD por millón de tokens, si el usuario lo quiere fijar a mano. */
      precioEntrada: numero("IA_PRECIO_ENTRADA", NaN),
      precioSalida: numero("IA_PRECIO_SALIDA", NaN),
    },
    topeMensualUsd: numero("TOPE_MENSUAL_USD", 5),
    zona: texto("ZONA_HORARIA") || "America/Guayaquil",
    clave: texto("OFICINA_CLAVE"),
    secreto: texto("SECRETO_ENTRADA"),
    negocio: {
      tipo,
      nombre: texto("NEGOCIO_NOMBRE") || "Mi oficina",
      descripcion: texto("NEGOCIO_DESCRIPCION"),
    },
    sheets: {
      id: texto("GOOGLE_SHEET_ID"),
      correo: texto("GOOGLE_CUENTA_CORREO"),
      llave: texto("GOOGLE_CUENTA_LLAVE").replace(/\\n/g, "\n"),
    },
    telegram: {
      token: texto("TELEGRAM_BOT_TOKEN"),
      duenos: lista("TELEGRAM_DUENOS"),
      obra: lista("TELEGRAM_OBRA"),
    },
    obra: {
      proyecto: texto("OBRA_PROYECTO") || "Mi obra",
      diaReporte: texto("OBRA_DIA_REPORTE").toLowerCase() || "viernes",
    },
    cron: texto("CRON_SECRET"),
  };
}
export type Config = ReturnType<typeof config>;

export interface Estado {
  ia: boolean;
  sheets: boolean;
  telegram: boolean;
  clave: boolean;
  secreto: boolean;
  faltan: string[];
}

/** Qué está listo y qué falta, en palabras simples (para la pantalla de Configuración). */
export function estado(c: Config = config()): Estado {
  const faltan: string[] = [];
  if (!c.clave) faltan.push("OFICINA_CLAVE (la contraseña para entrar a tu oficina)");
  if (c.secreto.length < 24) faltan.push("SECRETO_ENTRADA (una frase secreta de al menos 24 caracteres)");
  if (!c.ia.clave) faltan.push(`${c.ia.nombreClave} (tu clave de IA)`);
  const sheets = Boolean(c.sheets.id && c.sheets.correo && c.sheets.llave.includes("PRIVATE KEY"));
  if (!sheets) faltan.push("GOOGLE_SHEET_ID, GOOGLE_CUENTA_CORREO y GOOGLE_CUENTA_LLAVE (tu Google Sheets)");
  const telegram = Boolean(c.telegram.token && c.telegram.duenos.length);
  return { ia: Boolean(c.ia.clave), sheets, telegram, clave: Boolean(c.clave), secreto: c.secreto.length >= 24, faltan };
}
