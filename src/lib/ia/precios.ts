// Precios en USD por millón de tokens, para calcular cuánto gasta cada agente y respetar tu tope del mes.
// Revisados el 26 oct 2026. Si tu modelo no está aquí o el precio cambió, ponlo a mano con
// IA_PRECIO_ENTRADA e IA_PRECIO_SALIDA. Sin precio, el gasto se cuenta como 0 y la oficina te avisa.

export const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  // Claude (precios oficiales de Anthropic)
  "claude-opus-5-5": { entrada: 4, salida: 20 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10 },
  "claude-haiku-5-5": { entrada: 0.1, salida: 0.5 },
  // OpenAI (según listados públicos; confírmalo en openai.com/api/pricing)
  "gpt-5.4-mini": { entrada: 0.75, salida: 4.5 },
};

export function precioDe(modelo: string, entradaManual: number, salidaManual: number): { entrada: number; salida: number } | null {
  if (Number.isFinite(entradaManual) && Number.isFinite(salidaManual)) return { entrada: entradaManual, salida: salidaManual };
  return PRECIOS[modelo] ?? null;
}

export function costoUsd(tokensEntrada: number, tokensSalida: number, precio: { entrada: number; salida: number } | null): number {
  if (!precio) return 0;
  return Math.round(((tokensEntrada * precio.entrada + tokensSalida * precio.salida) / 1_000_000) * 1_000_000) / 1_000_000;
}
