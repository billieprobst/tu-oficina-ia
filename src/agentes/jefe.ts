import { config } from "@/lib/config";
import { eventosDeHoy, registrarEvento, type Evento } from "@/lib/eventos";
import { gastoActual } from "@/lib/ia";
import { avisarDuenos } from "@/lib/telegram";
import { fechaLarga } from "@/lib/tiempo";

// JEFE DE OFICINA: cada noche cuenta lo que hizo cada agente y te lo manda. No usa IA: cero costo.

const NOMBRES = { recepcion: "Recepción", obra: "Obra", jefe: "Jefe" } as const;

/** El texto del resumen del día. Puro, con pruebas. */
export function textoResumen(eventos: Evento[], gasto: number, tope: number, fecha: string): string {
  const propios = eventos.filter((e) => e.agente !== "jefe");
  if (!propios.length) {
    return `Jefe de oficina · Resumen del ${fecha}\nHoy no hubo movimiento. Mañana seguimos.\n\nIA del mes: ${gasto.toFixed(2)} de ${tope} USD.`;
  }
  const leads = propios.filter((e) => e.agente === "recepcion");
  const calientes = leads.filter((e) => e.texto.includes("caliente")).length;
  const obra = propios.filter((e) => e.agente === "obra");
  const lineas = [`Jefe de oficina · Resumen del ${fecha}`];
  if (leads.length) lineas.push(`Recepción atendió ${leads.length} ${leads.length === 1 ? "interesado" : "interesados"}${calientes ? ` (${calientes} ${calientes === 1 ? "caliente" : "calientes"})` : ""}.`);
  if (obra.length) lineas.push(`Obra anotó ${obra.length} ${obra.length === 1 ? "avance" : "avances"} de la obra.`);
  lineas.push("", "Lo último:");
  for (const e of propios.slice(-5)) lineas.push(`· ${NOMBRES[e.agente]}: ${e.texto}`);
  lineas.push("", `IA del mes: ${gasto.toFixed(2)} de ${tope} USD.`);
  return lineas.join("\n");
}

export async function resumenDelDia(): Promise<string> {
  const c = config();
  const [eventos, gasto] = await Promise.all([eventosDeHoy(), gastoActual()]);
  const texto = textoResumen(eventos, gasto, c.topeMensualUsd, fechaLarga(new Date(), c.zona));
  await avisarDuenos(texto);
  await registrarEvento("jefe", "Te mandé el resumen del día por Telegram.");
  return texto;
}
