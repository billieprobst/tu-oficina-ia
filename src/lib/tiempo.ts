// Fechas en la zona del negocio (ZONA_HORARIA). En la hoja se guarda la hora en ISO (UTC).

/** "2026-10-26" en la zona dada. */
export function diaLocal(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha);
}

/** "2026-10" en la zona dada. */
export const mesLocal = (fecha: Date, zona: string) => diaLocal(fecha, zona).slice(0, 7);

/** "14:05" en la zona dada. */
export function horaLocal(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat("es", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(fecha);
}

const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

/** "viernes" en la zona dada (sin tilde, para comparar con OBRA_DIA_REPORTE). */
export function diaSemana(fecha: Date, zona: string): string {
  const d = new Date(`${diaLocal(fecha, zona)}T12:00:00Z`);
  return DIAS[d.getUTCDay()];
}

export const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "26 de octubre" en la zona dada. */
export function fechaLarga(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat("es", { timeZone: zona, day: "numeric", month: "long" }).format(fecha);
}
