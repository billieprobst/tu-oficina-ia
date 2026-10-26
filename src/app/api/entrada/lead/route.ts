import { config } from "@/lib/config";
import { iguales } from "@/lib/seguridad";
import { mensajeError } from "@/lib/sesion";
import { TopeAlcanzado } from "@/lib/ia";
import { atenderLead, LeadEntrada } from "@/agentes/recepcion";

// Puerta de entrada de interesados. La llaman Make, Zapier, n8n, el formulario de tu web o un anuncio.
// POST con JSON { mensaje, nombre?, telefono?, correo?, origen? } y el secreto en la cabecera
// "x-oficina-secreto" (o ?secreto= en la dirección, si la herramienta no deja poner cabeceras).

export const maxDuration = 60;

async function leerCuerpo(req: Request): Promise<unknown> {
  const tipo = req.headers.get("content-type") ?? "";
  if (tipo.includes("application/json")) return req.json();
  if (tipo.includes("form")) return Object.fromEntries((await req.formData()).entries());
  const t = await req.text();
  try {
    return JSON.parse(t);
  } catch {
    return { mensaje: t };
  }
}

export async function POST(req: Request) {
  const c = config();
  const dado = req.headers.get("x-oficina-secreto") ?? new URL(req.url).searchParams.get("secreto") ?? "";
  if (c.secreto.length < 24 || !iguales(dado, c.secreto)) {
    return Response.json({ ok: false, error: "Secreto incorrecto." }, { status: 401 });
  }
  let cuerpo: unknown;
  try {
    cuerpo = await leerCuerpo(req);
  } catch {
    return Response.json({ ok: false, error: "No pude leer lo que mandaste." }, { status: 400 });
  }
  const lead = LeadEntrada.safeParse(cuerpo);
  if (!lead.success) {
    return Response.json({ ok: false, error: "Falta el campo mensaje (o es muy largo)." }, { status: 400 });
  }
  try {
    const calificacion = await atenderLead(lead.data);
    return Response.json({ ok: true, ...calificacion });
  } catch (e) {
    const status = e instanceof TopeAlcanzado ? 429 : 500;
    return Response.json({ ok: false, error: mensajeError(e) }, { status });
  }
}
