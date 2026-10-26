import type { Config } from "@/lib/config";
import type { MensajeTelegram } from "@/lib/telegram";

// Qué hace el bot con cada mensaje. Puro, con pruebas: aquí solo se decide, no se ejecuta nada.

export type Accion =
  | { tipo: "id" }
  | { tipo: "desconocido" }
  | { tipo: "ayuda" }
  | { tipo: "lead"; mensaje: string }
  | { tipo: "obra" }
  | { tipo: "reporte" }
  | { tipo: "resumen" };

export function decidir(m: MensajeTelegram, c: Pick<Config, "telegram">): Accion {
  const comando = m.texto.match(/^\/([a-z]+)(?:@\w+)?\s*([\s\S]*)$/i);
  const nombre = comando?.[1].toLowerCase();
  if (nombre === "start" || nombre === "id") return { tipo: "id" };

  const esDueno = c.telegram.duenos.includes(m.deId);
  const esObra = c.telegram.obra.includes(m.deId);
  if (!esDueno && !esObra) return { tipo: "desconocido" };

  // El equipo de obra solo manda avances.
  if (!esDueno) return m.foto || (m.texto && !comando) || nombre === "obra" ? { tipo: "obra" } : { tipo: "ayuda" };

  if (nombre === "reporte") return { tipo: "reporte" };
  if (nombre === "resumen") return { tipo: "resumen" };
  if (nombre === "ayuda" || nombre === "help") return { tipo: "ayuda" };
  if (nombre === "obra" || m.foto) return { tipo: "obra" };
  if (nombre === "lead") return comando?.[2].trim() ? { tipo: "lead", mensaje: comando[2].trim() } : { tipo: "ayuda" };
  if (comando) return { tipo: "ayuda" };
  // El dueño reenvía o pega el mensaje de un interesado: lo atiende Recepción.
  return m.texto ? { tipo: "lead", mensaje: m.texto } : { tipo: "ayuda" };
}

export const AYUDA_DUENO = `Así trabajo contigo:
· Reenvíame o pégame el mensaje de un interesado y Recepción lo califica.
· Mándame fotos de la obra (con una nota si quieres) y Obra las guarda para el reporte.
· /obra seguido de una nota: anota un avance sin foto.
· /reporte: arma ahora el reporte de obra de los últimos 7 días.
· /resumen: el resumen de hoy.`;

export const AYUDA_OBRA = `Mándame fotos de la obra, con una nota corta si quieres.
También puedes escribir una nota de avance. Todo va al reporte de la semana.`;
