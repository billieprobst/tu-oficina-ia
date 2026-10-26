import { config } from "@/lib/config";
import { iguales, secretoTelegram } from "@/lib/seguridad";
import { enviar, leerUpdate } from "@/lib/telegram";
import { mensajeError } from "@/lib/sesion";
import { atenderLead } from "@/agentes/recepcion";
import { armarReporte, guardarAvance } from "@/agentes/obra";
import { resumenDelDia } from "@/agentes/jefe";
import { AYUDA_DUENO, AYUDA_OBRA, decidir } from "@/agentes/telegram-bot";

// Telegram llama aquí con cada mensaje que recibe tu bot.

export const maxDuration = 60;

export async function POST(req: Request) {
  const c = config();
  const dado = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!c.telegram.token || c.secreto.length < 24 || !iguales(dado, secretoTelegram(c.secreto))) {
    return new Response("no", { status: 401 });
  }
  const m = leerUpdate(await req.json().catch(() => null));
  if (!m) return Response.json({ ok: true });

  const responder = (t: string) => enviar(m.chatId, t).catch(() => undefined);
  const accion = decidir(m, c);
  try {
    switch (accion.tipo) {
      case "id":
        await responder(
          `Hola, ${m.nombre}. Tu número de Telegram es ${m.deId}.\nSi eres el dueño, ponlo en TELEGRAM_DUENOS. Si eres del equipo de obra, pídele al dueño que lo ponga en TELEGRAM_OBRA.`,
        );
        break;
      case "desconocido":
        await responder(`Todavía no te conozco. Tu número de Telegram es ${m.deId}: pásaselo al dueño de la oficina.`);
        break;
      case "ayuda":
        await responder(c.telegram.duenos.includes(m.deId) ? AYUDA_DUENO : AYUDA_OBRA);
        break;
      case "lead": {
        const cal = await atenderLead({ mensaje: accion.mensaje, origen: "Telegram" });
        if (!c.telegram.duenos.includes(m.chatId)) await responder(`Listo. Lo califiqué ${cal.temperatura}.`);
        break;
      }
      case "obra": {
        const texto = m.texto.replace(/^\/obra(@\w+)?\s*/i, "");
        const tipo = await guardarAvance({ ...m, texto });
        await responder(tipo === "foto" ? "Foto guardada para el reporte de la semana." : "Nota guardada para el reporte de la semana.");
        break;
      }
      case "reporte": {
        await responder("Armando el reporte. Te aviso en un momento.");
        const r = await armarReporte();
        if (!r) await responder("No encontré fotos ni notas de los últimos 7 días.");
        break;
      }
      case "resumen":
        await resumenDelDia();
        break;
    }
  } catch (e) {
    await responder(`No pude hacerlo: ${mensajeError(e)}`);
  }
  return Response.json({ ok: true });
}
