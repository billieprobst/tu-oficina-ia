import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Compara dos textos sin dar pistas por el tiempo que tarda. */
export function iguales(a: string, b: string): boolean {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

/** Llave para firmar: sale de la contraseña y del secreto. Si cambias cualquiera, las sesiones y enlaces viejos dejan de valer. */
function llave(clave: string, secreto: string, uso: string): Buffer {
  return createHash("sha256").update(`tu-oficina-ia|${uso}|${clave}|${secreto}`).digest();
}

export function firmar(valor: string, clave: string, secreto: string, uso: string): string {
  return createHmac("sha256", llave(clave, secreto, uso)).update(valor).digest("base64url");
}

export function firmaValida(valor: string, firma: string, clave: string, secreto: string, uso: string): boolean {
  if (!firma) return false;
  return iguales(firmar(valor, clave, secreto, uso), firma);
}

export const COOKIE_SESION = "oficina_sesion";
const DURACION_SESION_S = 60 * 60 * 24 * 30;

/** Cookie de sesión: "vence.firma". Sin base de datos. */
export function crearSesion(clave: string, secreto: string, ahora = Date.now()): { valor: string; maxAge: number } {
  const vence = Math.floor(ahora / 1000) + DURACION_SESION_S;
  return { valor: `${vence}.${firmar(String(vence), clave, secreto, "sesion")}`, maxAge: DURACION_SESION_S };
}

export function sesionValida(cookie: string | undefined, clave: string, secreto: string, ahora = Date.now()): boolean {
  if (!cookie || !clave) return false;
  const [vence, firma] = cookie.split(".");
  if (!vence || !firma || Number(vence) * 1000 < ahora) return false;
  return firmaValida(vence, firma, clave, secreto, "sesion");
}

/** Token que Telegram nos manda en cada mensaje (cabecera X-Telegram-Bot-Api-Secret-Token). Solo letras, números, _ y -. */
export function secretoTelegram(secreto: string): string {
  return createHash("sha256").update(`telegram|${secreto}`).digest("hex").slice(0, 48);
}
