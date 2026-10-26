import { randomBytes } from "node:crypto";
import { z } from "zod";
import { config } from "@/lib/config";
import { pedirJson } from "@/lib/ia";
import { agregarFila, leerFilas } from "@/lib/sheets";
import { registrarEvento } from "@/lib/eventos";
import { avisarDuenos, descargar, type MensajeTelegram } from "@/lib/telegram";
import { firmar } from "@/lib/seguridad";
import { diaLocal, fechaLarga } from "@/lib/tiempo";
import { contextoNegocio } from "@/agentes/negocio";

// OBRA: el residente (o tú) manda fotos y notas al bot de Telegram durante la semana.
// El día del reporte, Obra arma solo el informe de avance para compradores o inversionistas y te manda el enlace.

export const MAX_FOTOS_REPORTE = 8;

export async function guardarAvance(m: MensajeTelegram): Promise<"foto" | "nota"> {
  const tipo = m.foto ? "foto" : "nota";
  const { obra } = config();
  await agregarFila("Obra", {
    fecha: new Date().toISOString(),
    proyecto: obra.proyecto,
    autor: m.nombre,
    tipo,
    texto: m.texto.slice(0, 2000),
    archivo: m.foto ?? "",
  });
  const corto = m.texto.length > 70 ? `${m.texto.slice(0, 70)}…` : m.texto;
  await registrarEvento("obra", tipo === "foto" ? `${m.nombre} mandó una foto de la obra${corto ? `: ${corto}` : "."}` : `${m.nombre} anotó: ${corto}`);
  return tipo;
}

export const Reporte = z.object({
  titulo: z.string(),
  resumen: z.string(),
  avance_general: z.number().min(0).max(100).nullable(),
  etapas: z.array(
    z.object({
      nombre: z.string(),
      estado: z.enum(["terminada", "en_curso", "por_empezar", "detenida"]),
      avance: z.number().min(0).max(100).nullable(),
      detalle: z.string(),
    }),
  ),
  fotos: z.array(z.object({ numero: z.number().int().min(1), pie: z.string() })),
  proximos_pasos: z.array(z.string()),
  riesgos: z.array(z.string()),
});
export type Reporte = z.infer<typeof Reporte>;

export const SISTEMA_OBRA = `Eres Obra, el agente que arma el reporte semanal de avance de una construcción.
Recibes las notas y fotos que el equipo mandó durante la semana. Con eso escribes un reporte claro para compradores o inversionistas que no son técnicos.
Reglas:
- Usa solo lo que se ve en las fotos y lo que dicen las notas. No inventes porcentajes: si nadie dio un porcentaje y no se puede estimar con seguridad, avance va en null.
- titulo: corto, con el nombre del proyecto y la semana.
- resumen: 3 o 4 frases con lo más importante de la semana, en tono positivo pero honesto.
- etapas: las partes de la obra que aparecen (por ejemplo estructura, mampostería, instalaciones, acabados), con su estado y un detalle corto.
- fotos: elige las mejores (máximo 6) por su número y escribe un pie de foto de una línea.
- proximos_pasos: lo que viene la próxima semana, si se sabe.
- riesgos: retrasos o problemas que mencionen las notas. Si no hay, lista vacía.`;

/** Las filas de Obra entre dos días (incluidos), del proyecto actual. Puro, con pruebas. */
export function filasDeLaSemana(filas: Record<string, string>[], desde: string, hasta: string, zona: string): Record<string, string>[] {
  return filas.filter((f) => {
    if (!f.fecha) return false;
    const d = diaLocal(new Date(f.fecha), zona);
    return d >= desde && d <= hasta;
  });
}

/** Reparte hasta `max` fotos a lo largo de la semana, en orden. Puro, con pruebas. */
export function elegirFotos<T>(fotos: T[], max = MAX_FOTOS_REPORTE): T[] {
  if (fotos.length <= max) return fotos;
  return Array.from({ length: max }, (_, i) => fotos[Math.round((i * (fotos.length - 1)) / (max - 1))]);
}

export function urlBase(): string {
  const propia = (process.env.URL_OFICINA ?? "").trim().replace(/\/$/, "");
  if (propia) return propia;
  const vercel = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? "").trim();
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

export function enlaceReporte(id: string): string {
  const c = config();
  return `${urlBase()}/reporte/${id}?f=${firmar(id, c.clave, c.secreto, "reporte")}`;
}

export async function armarReporte(): Promise<{ id: string; enlace: string } | null> {
  const c = config();
  const hoy = new Date();
  const hasta = diaLocal(hoy, c.zona);
  const desde = diaLocal(new Date(hoy.getTime() - 6 * 86_400_000), c.zona);
  const filas = filasDeLaSemana(await leerFilas("Obra"), desde, hasta, c.zona).filter((f) => f.proyecto === c.obra.proyecto);
  if (!filas.length) {
    await avisarDuenos(`Obra · Esta semana no llegaron fotos ni notas de ${c.obra.proyecto}, así que no armé reporte.`);
    return null;
  }

  const fotos = elegirFotos(filas.filter((f) => f.tipo === "foto" && f.archivo));
  const imagenes = [];
  const fotosUsadas: string[] = [];
  for (const f of fotos) {
    try {
      imagenes.push(await descargar(f.archivo).then((d) => ({ datos: d.datos, tipo: d.tipo })));
      fotosUsadas.push(f.archivo);
    } catch {
      /* una foto que no baja no frena el reporte */
    }
  }
  const notas = filas
    .map((f) => `- ${diaLocal(new Date(f.fecha), c.zona)} · ${f.autor}${f.tipo === "foto" ? " (foto)" : ""}: ${f.texto || "sin texto"}`)
    .join("\n");

  const reporte = await pedirJson({
    agente: "obra",
    sistema: `${SISTEMA_OBRA}\n\n${contextoNegocio(c)}`,
    texto: `Proyecto: ${c.obra.proyecto}\nSemana: del ${desde} al ${hasta}\nTe paso ${imagenes.length} fotos, numeradas en el orden en que llegan (la primera es la 1).\nNotas del equipo:\n${notas}`,
    imagenes,
    esquema: Reporte,
  });

  const id = randomBytes(6).toString("hex");
  await agregarFila("Reportes", {
    id,
    fecha: hoy.toISOString(),
    proyecto: c.obra.proyecto,
    desde,
    hasta,
    contenido: JSON.stringify({ reporte, fotos: fotosUsadas }),
  });
  const enlace = enlaceReporte(id);
  await registrarEvento("obra", `Terminé el reporte de ${c.obra.proyecto} de esta semana. Jefe, te lo dejo.`, { visita: "jefe" });
  await avisarDuenos(
    `Obra · Listo el reporte de avance de ${c.obra.proyecto} (semana al ${fechaLarga(hoy, c.zona)}).\n\n${reporte.resumen}\n\nRevísalo y compártelo con tus compradores:\n${enlace}`,
  );
  return { id, enlace };
}

export interface ReporteGuardado {
  id: string;
  fecha: string;
  proyecto: string;
  desde: string;
  hasta: string;
  reporte: Reporte;
  fotos: string[];
}

export async function leerReporte(id: string): Promise<ReporteGuardado | null> {
  const fila = (await leerFilas("Reportes")).find((f) => f.id === id);
  if (!fila) return null;
  try {
    const c = JSON.parse(fila.contenido) as { reporte: unknown; fotos: string[] };
    return { id, fecha: fila.fecha, proyecto: fila.proyecto, desde: fila.desde, hasta: fila.hasta, reporte: Reporte.parse(c.reporte), fotos: c.fotos ?? [] };
  } catch {
    return null;
  }
}
