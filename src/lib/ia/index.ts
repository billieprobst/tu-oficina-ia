import { z } from "zod";
import { config } from "@/lib/config";
import { agregarFila, leerFilas } from "@/lib/sheets";
import { mesLocal } from "@/lib/tiempo";
import type { AgenteId } from "@/lib/eventos";
import { costoUsd, precioDe } from "@/lib/ia/precios";
import { claude, gemini, openai, type Imagen } from "@/lib/ia/proveedores";

export class TopeAlcanzado extends Error {
  constructor(public gastado: number, public tope: number) {
    super(`Llegaste a tu tope de IA del mes (${gastado.toFixed(2)} de ${tope} USD). Súbelo en TOPE_MENSUAL_USD o espera al próximo mes.`);
  }
}

/** Lo que llevas gastado este mes, sumando la pestaña Uso. Puro, con pruebas. */
export function gastoDelMes(filas: Record<string, string>[], mes: string, zona: string): number {
  return filas
    .filter((f) => f.fecha && mesLocal(new Date(f.fecha), zona) === mes)
    .reduce((s, f) => s + (Number(String(f.costo_usd).replace(",", ".")) || 0), 0);
}

export async function gastoActual(): Promise<number> {
  const { zona } = config();
  return gastoDelMes(await leerFilas("Uso"), mesLocal(new Date(), zona), zona);
}

/**
 * Le pide a la IA del usuario un JSON que cumpla el esquema. Antes revisa el tope del mes;
 * después anota lo gastado en la pestaña Uso.
 */
export async function pedirJson<T extends z.ZodType>(entrada: {
  agente: AgenteId;
  sistema: string;
  texto: string;
  imagenes?: Imagen[];
  esquema: T;
}): Promise<z.infer<T>> {
  const c = config();
  if (!c.ia.clave) throw new Error(`Falta ${c.ia.nombreClave}: tu clave de IA.`);
  const gastado = await gastoActual();
  if (gastado >= c.topeMensualUsd) throw new TopeAlcanzado(gastado, c.topeMensualUsd);

  const llamar = c.ia.proveedor === "claude" ? claude : c.ia.proveedor === "openai" ? openai : gemini;
  const r = await llamar({
    modelo: c.ia.modelo,
    clave: c.ia.clave,
    sistema: entrada.sistema,
    texto: entrada.texto,
    imagenes: entrada.imagenes ?? [],
    esquema: z.toJSONSchema(entrada.esquema) as Record<string, unknown>,
  });
  const costo = costoUsd(r.tokensEntrada, r.tokensSalida, precioDe(c.ia.modelo, c.ia.precioEntrada, c.ia.precioSalida));
  await agregarFila("Uso", {
    fecha: new Date().toISOString(),
    agente: entrada.agente,
    proveedor: c.ia.proveedor,
    modelo: c.ia.modelo,
    tokens_entrada: r.tokensEntrada,
    tokens_salida: r.tokensSalida,
    costo_usd: costo,
  });
  return entrada.esquema.parse(r.json);
}
