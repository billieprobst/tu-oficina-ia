import { config, estado } from "@/lib/config";
import { eventosDeHoy } from "@/lib/eventos";
import { gastoActual } from "@/lib/ia";
import { haySesion, mensajeError, noAutorizado } from "@/lib/sesion";

// La oficina 3D pregunta aquí cada 20 segundos qué pasó hoy.

export async function GET() {
  if (!(await haySesion())) return noAutorizado();
  const c = config();
  if (!estado(c).sheets) return Response.json({ ok: true, eventos: [], gasto: 0, tope: c.topeMensualUsd, aviso: "Conecta tu Google Sheets para ver lo que pasa." });
  try {
    const [eventos, gasto] = await Promise.all([eventosDeHoy(), gastoActual()]);
    return Response.json({ ok: true, eventos, gasto, tope: c.topeMensualUsd });
  } catch (e) {
    return Response.json({ ok: false, eventos: [], error: mensajeError(e) }, { status: 502 });
  }
}
