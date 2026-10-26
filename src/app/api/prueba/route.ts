import { config } from "@/lib/config";
import { secretoTelegram } from "@/lib/seguridad";
import { haySesion, mensajeError, noAutorizado } from "@/lib/sesion";
import { prepararHoja } from "@/lib/sheets";
import { configurarWebhook } from "@/lib/telegram";
import { atenderLead } from "@/agentes/recepcion";

// Botones de la pantalla de Configuración: preparar la hoja, conectar Telegram y probar Recepción.

export const maxDuration = 60;

const LEAD_DE_PRUEBA = {
  nombre: "Carla Prueba",
  origen: "Prueba desde Configuración",
  mensaje:
    "Hola, vi el departamento de 2 habitaciones en el anuncio. Tengo el crédito preaprobado por 95 mil y me gustaría verlo este sábado. ¿Tiene estacionamiento?",
};

export async function POST(req: Request) {
  if (!(await haySesion())) return noAutorizado();
  const { que } = (await req.json().catch(() => ({}))) as { que?: string };
  try {
    if (que === "hoja") {
      const nuevas = await prepararHoja();
      return Response.json({ ok: true, mensaje: nuevas.length ? `Listo. Creé las pestañas: ${nuevas.join(", ")}.` : "Tu hoja ya estaba lista." });
    }
    if (que === "telegram") {
      const c = config();
      const url = `${new URL(req.url).origin}/api/telegram`;
      await configurarWebhook(url, secretoTelegram(c.secreto));
      return Response.json({ ok: true, mensaje: "Listo. Escríbele /start a tu bot para probar." });
    }
    if (que === "lead") {
      const cal = await atenderLead(LEAD_DE_PRUEBA);
      return Response.json({ ok: true, mensaje: `Recepción lo calificó ${cal.temperatura}. Mira tu oficina, tu hoja y tu Telegram.` });
    }
    return Response.json({ ok: false, error: "No sé qué probar." }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: mensajeError(e) }, { status: 500 });
  }
}
