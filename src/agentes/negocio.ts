import type { Config } from "@/lib/config";

/** Contexto del negocio que todos los agentes reciben, para que respondan como tu equipo y no como un robot. */
export function contextoNegocio(c: Config): string {
  const quien =
    c.negocio.tipo === "asesor"
      ? "un asesor inmobiliario (compra, venta y alquiler de propiedades)"
      : c.negocio.tipo === "constructor"
        ? "una constructora o promotora que vende proyectos en preventa y en obra"
        : "un negocio inmobiliario que hace corretaje y también desarrolla o vende proyectos";
  return [
    `Trabajas para "${c.negocio.nombre}", ${quien}.`,
    c.negocio.descripcion ? `Así describe el dueño su negocio: ${c.negocio.descripcion}` : "",
    "Escribes en español neutro, de tú, cálido y breve. Frases cortas. Nada de fórmulas de vendedor ni signos « ».",
    "Nunca inventas precios, datos ni promesas. Si algo no está en lo que te dieron, lo dejas en null o dices que hay que confirmarlo.",
  ]
    .filter(Boolean)
    .join("\n");
}
