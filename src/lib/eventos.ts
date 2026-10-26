import { config } from "@/lib/config";
import { agregarFila, leerFilas } from "@/lib/sheets";
import { diaLocal } from "@/lib/tiempo";

// Un evento es algo que hizo un agente. La oficina 3D los muestra en globitos y en "Lo que pasó hoy".

export type AgenteId = "jefe" | "recepcion" | "obra";

export interface Evento {
  id: string;
  fecha: string; // ISO
  agente: AgenteId;
  texto: string;
  visita?: AgenteId;
}

export async function registrarEvento(agente: AgenteId, texto: string, opciones: { visita?: AgenteId; detalle?: string } = {}) {
  await agregarFila("Eventos", {
    fecha: new Date().toISOString(),
    agente,
    texto: texto.slice(0, 280),
    visita: opciones.visita ?? "",
    detalle: opciones.detalle ?? "",
  });
}

const AGENTES = new Set<AgenteId>(["jefe", "recepcion", "obra"]);

/** Convierte filas de la pestaña Eventos en eventos de un día (en la zona del negocio). Puro, con pruebas. */
export function eventosDelDia(filas: Record<string, string>[], dia: string, zona: string): Evento[] {
  return filas
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.fecha && AGENTES.has(f.agente as AgenteId) && diaLocal(new Date(f.fecha), zona) === dia)
    .map(({ f, i }) => ({
      id: `e${i + 2}`, // número de fila en la hoja
      fecha: f.fecha,
      agente: f.agente as AgenteId,
      texto: f.texto,
      ...(AGENTES.has(f.visita as AgenteId) ? { visita: f.visita as AgenteId } : {}),
    }));
}

export async function eventosDeHoy(): Promise<Evento[]> {
  const { zona } = config();
  return eventosDelDia(await leerFilas("Eventos"), diaLocal(new Date(), zona), zona);
}
