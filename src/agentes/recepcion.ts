import { z } from "zod";
import { config } from "@/lib/config";
import { pedirJson } from "@/lib/ia";
import { agregarFila } from "@/lib/sheets";
import { registrarEvento } from "@/lib/eventos";
import { avisarDuenos } from "@/lib/telegram";
import { contextoNegocio } from "@/agentes/negocio";

// RECEPCIÓN: llega un interesado (portal, anuncio, formulario, Telegram) y en segundos queda calificado,
// anotado en tu hoja, con la respuesta lista y un aviso a tu Telegram. Nunca le escribe al cliente por su cuenta.

/** Lo que puede mandar Make, Zapier, n8n o tu formulario. Solo "mensaje" es obligatorio. */
export const LeadEntrada = z.object({
  mensaje: z.string().trim().min(2).max(5000),
  nombre: z.string().trim().max(120).optional(),
  telefono: z.string().trim().max(40).optional(),
  correo: z.string().trim().max(160).optional(),
  origen: z.string().trim().max(80).optional(),
});
export type LeadEntrada = z.infer<typeof LeadEntrada>;

export const Calificacion = z.object({
  temperatura: z.enum(["caliente", "tibio", "frio"]),
  tipo: z.enum(["comprador", "arrendatario", "inversionista", "propietario", "comprador_preventa", "otro"]),
  presupuesto: z.string().nullable(),
  zona: z.string().nullable(),
  plazo: z.string().nullable(),
  credito: z.string().nullable(),
  resumen: z.string(),
  siguiente_paso: z.string(),
  respuesta_sugerida: z.string(),
});
export type Calificacion = z.infer<typeof Calificacion>;

export const SISTEMA_RECEPCION = `Eres Recepción, el agente que atiende a los interesados que llegan al negocio.
Lees el mensaje de un posible cliente y devuelves:
- temperatura: "caliente" si quiere visitar, tiene presupuesto o crédito y fecha cercana; "tibio" si pregunta en serio pero le falta algo; "frio" si solo curiosea o el mensaje es muy vago.
- tipo: comprador, arrendatario, inversionista, propietario (quiere vender o alquilar lo suyo), comprador_preventa (pregunta por un proyecto en construcción) u otro.
- presupuesto, zona, plazo y credito: solo si el mensaje lo dice. Si no, null.
- resumen: una frase de qué busca.
- siguiente_paso: qué conviene hacer ahora, en una frase (por ejemplo "Llamarlo hoy y ofrecer visita el sábado").
- respuesta_sugerida: el primer mensaje para el cliente, listo para copiar. Saluda por su nombre si lo sabes, responde lo que preguntó sin inventar datos y termina con una sola pregunta para avanzar (presupuesto, zona, fecha de visita o forma de pago). Máximo 5 líneas.`;

export function textoParaIa(l: LeadEntrada): string {
  return [
    `Origen: ${l.origen || "sin dato"}`,
    `Nombre: ${l.nombre || "sin dato"}`,
    `Teléfono: ${l.telefono ? "sí lo dejó" : "no lo dejó"}`,
    `Correo: ${l.correo ? "sí lo dejó" : "no lo dejó"}`,
    "Mensaje del interesado:",
    l.mensaje,
  ].join("\n");
}

const EMOJI = { caliente: "Caliente", tibio: "Tibio", frio: "Frío" } as const;

/** Texto del aviso a Telegram. Puro, con pruebas. */
export function avisoTelegram(l: LeadEntrada, c: Calificacion): string {
  return [
    `Recepción · Lead ${EMOJI[c.temperatura].toLowerCase()}: ${l.nombre || "sin nombre"}${l.origen ? ` (${l.origen})` : ""}`,
    c.resumen,
    [c.presupuesto && `Presupuesto: ${c.presupuesto}`, c.zona && `Zona: ${c.zona}`, c.plazo && `Plazo: ${c.plazo}`, c.credito && `Crédito: ${c.credito}`]
      .filter(Boolean)
      .join(" · "),
    l.telefono ? `Teléfono: ${l.telefono}` : "",
    "",
    `Siguiente paso: ${c.siguiente_paso}`,
    "",
    "Respuesta lista para copiar:",
    c.respuesta_sugerida,
  ]
    .filter((x, i, a) => x !== "" || (a[i - 1] ?? "") !== "")
    .join("\n");
}

/** Texto del globito en la oficina. Puro, con pruebas. */
export function globoRecepcion(l: LeadEntrada, c: Calificacion): string {
  const quien = l.nombre?.split(" ")[0] || "Un interesado";
  return `${quien} escribió${l.origen ? ` desde ${l.origen}` : ""}. Lo califiqué ${EMOJI[c.temperatura].toLowerCase()}: ${c.resumen}`;
}

export async function atenderLead(l: LeadEntrada): Promise<Calificacion> {
  const c = config();
  const cal = await pedirJson({
    agente: "recepcion",
    sistema: `${SISTEMA_RECEPCION}\n\n${contextoNegocio(c)}`,
    texto: textoParaIa(l),
    esquema: Calificacion,
  });
  await agregarFila("Leads", { fecha: new Date().toISOString(), ...l, ...cal });
  await registrarEvento("recepcion", globoRecepcion(l, cal));
  await avisarDuenos(avisoTelegram(l, cal));
  return cal;
}
