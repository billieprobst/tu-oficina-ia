import { config } from "@/lib/config";
import { firmaValida } from "@/lib/seguridad";
import { descargar } from "@/lib/telegram";

// Muestra una foto de obra guardada en Telegram, sin exponer el token del bot.
// Solo con firma válida: el enlace lo arma el reporte.

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = config();
  const f = new URL(req.url).searchParams.get("f") ?? "";
  if (!firmaValida(id, f, c.clave, c.secreto, "foto")) return new Response("no", { status: 403 });
  try {
    const { datos, tipo } = await descargar(id);
    return new Response(new Uint8Array(datos), { headers: { "Content-Type": tipo, "Cache-Control": "private, max-age=86400" } });
  } catch {
    return new Response("no encontrada", { status: 404 });
  }
}
