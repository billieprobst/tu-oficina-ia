import { config } from "@/lib/config";
import { iguales } from "@/lib/seguridad";
import { mensajeError } from "@/lib/sesion";
import { diaSemana, sinTildes } from "@/lib/tiempo";
import { armarReporte } from "@/agentes/obra";
import { resumenDelDia } from "@/agentes/jefe";

// El reloj de la oficina. Vercel lo llama una vez al día (vercel.json) con la cabecera
// "Authorization: Bearer <CRON_SECRET>". El día del reporte arma el de obra; todos los días, el resumen del Jefe.

export const maxDuration = 60;

export async function GET(req: Request) {
  const c = config();
  const dado = req.headers.get("authorization") ?? "";
  if (!c.cron || !iguales(dado, `Bearer ${c.cron}`)) return new Response("no", { status: 401 });

  const hecho: string[] = [];
  const errores: string[] = [];
  if (diaSemana(new Date(), c.zona) === sinTildes(c.obra.diaReporte)) {
    try {
      const r = await armarReporte();
      hecho.push(r ? "reporte de obra" : "sin avances de obra esta semana");
    } catch (e) {
      errores.push(`obra: ${mensajeError(e)}`);
    }
  }
  try {
    await resumenDelDia();
    hecho.push("resumen del día");
  } catch (e) {
    errores.push(`jefe: ${mensajeError(e)}`);
  }
  return Response.json({ ok: !errores.length, hecho, errores });
}
