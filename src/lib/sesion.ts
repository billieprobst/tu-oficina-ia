import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { COOKIE_SESION, sesionValida } from "@/lib/seguridad";

/** ¿Quien abre esta página entró con la contraseña de la oficina? */
export async function haySesion(): Promise<boolean> {
  const c = config();
  const jar = await cookies();
  return sesionValida(jar.get(COOKIE_SESION)?.value, c.clave, c.secreto);
}

export const noAutorizado = () => Response.json({ ok: false, error: "Entra primero a tu oficina." }, { status: 401 });

/** Mensaje de error para el usuario, sin filtrar claves. */
export function mensajeError(e: unknown): string {
  const t = e instanceof Error ? e.message : String(e);
  return t.replace(/(key|token|bot)[=:/][A-Za-z0-9:_-]{10,}/gi, "$1=…").slice(0, 300);
}
