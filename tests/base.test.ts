import { describe, expect, it } from "vitest";
import { crearSesion, firmar, firmaValida, iguales, secretoTelegram, sesionValida } from "@/lib/seguridad";
import { diaLocal, diaSemana, mesLocal, sinTildes } from "@/lib/tiempo";
import { celdaSegura } from "@/lib/sheets";
import { eventosDelDia } from "@/lib/eventos";
import { gastoDelMes } from "@/lib/ia";
import { costoUsd, precioDe } from "@/lib/ia/precios";
import { esquemaEstricto } from "@/lib/ia/proveedores";

const CLAVE = "mi-clave", SECRETO = "un-secreto-largo-de-prueba-123456";

describe("seguridad", () => {
  it("compara textos", () => {
    expect(iguales("abc", "abc")).toBe(true);
    expect(iguales("abc", "abd")).toBe(false);
    expect(iguales("", "x")).toBe(false);
  });
  it("firma y verifica", () => {
    const f = firmar("reporte1", CLAVE, SECRETO, "reporte");
    expect(firmaValida("reporte1", f, CLAVE, SECRETO, "reporte")).toBe(true);
    expect(firmaValida("reporte2", f, CLAVE, SECRETO, "reporte")).toBe(false);
    expect(firmaValida("reporte1", f, CLAVE, SECRETO, "foto")).toBe(false);
    expect(firmaValida("reporte1", f, "otra", SECRETO, "reporte")).toBe(false);
  });
  it("sesión: vale, vence y se invalida al cambiar la contraseña", () => {
    const ahora = Date.UTC(2026, 9, 26);
    const s = crearSesion(CLAVE, SECRETO, ahora);
    expect(sesionValida(s.valor, CLAVE, SECRETO, ahora)).toBe(true);
    expect(sesionValida(s.valor, CLAVE, SECRETO, ahora + 31 * 86_400_000)).toBe(false);
    expect(sesionValida(s.valor, "nueva", SECRETO, ahora)).toBe(false);
    expect(sesionValida("9999999999.falsa", CLAVE, SECRETO, ahora)).toBe(false);
    expect(sesionValida(undefined, CLAVE, SECRETO, ahora)).toBe(false);
  });
  it("el secreto de Telegram usa solo caracteres permitidos", () => {
    expect(secretoTelegram(SECRETO)).toMatch(/^[a-f0-9]{48}$/);
  });
});

describe("tiempo", () => {
  it("usa la zona del negocio", () => {
    const f = new Date("2026-10-27T03:00:00Z"); // en Guayaquil todavía es 26
    expect(diaLocal(f, "America/Guayaquil")).toBe("2026-10-26");
    expect(diaLocal(f, "Europe/Madrid")).toBe("2026-10-27");
    expect(mesLocal(f, "America/Guayaquil")).toBe("2026-10");
    expect(diaSemana(new Date("2026-10-30T15:00:00Z"), "America/Guayaquil")).toBe("viernes");
    expect(sinTildes("Miércoles ")).toBe("miercoles");
  });
});

describe("hoja", () => {
  it("nunca deja pasar una fórmula", () => {
    expect(celdaSegura("=IMPORTXML(\"x\")")).toBe("'=IMPORTXML(\"x\")");
    expect(celdaSegura("+593 99 999 9999")).toBe("'+593 99 999 9999");
    expect(celdaSegura("Hola")).toBe("Hola");
    expect(celdaSegura(12.5)).toBe(12.5);
    expect(celdaSegura(null)).toBe("");
    expect(celdaSegura({ a: 1 })).toBe('{"a":1}');
  });
  it("arma los eventos del día en la zona del negocio", () => {
    const filas = [
      { fecha: "2026-10-26T14:00:00Z", agente: "recepcion", texto: "Llegó Carla", visita: "" },
      { fecha: "2026-10-27T03:30:00Z", agente: "obra", texto: "Foto", visita: "jefe" },
      { fecha: "2026-10-25T14:00:00Z", agente: "jefe", texto: "Ayer", visita: "" },
      { fecha: "2026-10-26T15:00:00Z", agente: "intruso", texto: "No", visita: "" },
    ];
    const ev = eventosDelDia(filas, "2026-10-26", "America/Guayaquil");
    expect(ev.map((e) => e.texto)).toEqual(["Llegó Carla", "Foto"]);
    expect(ev[1]).toMatchObject({ id: "e3", visita: "jefe" });
    expect(ev[0].visita).toBeUndefined();
  });
});

describe("gasto de IA", () => {
  it("suma solo el mes actual", () => {
    const filas = [
      { fecha: "2026-10-01T15:00:00Z", costo_usd: "0,5" },
      { fecha: "2026-10-20T15:00:00Z", costo_usd: "0.25" },
      { fecha: "2026-09-30T15:00:00Z", costo_usd: "9" },
      { fecha: "", costo_usd: "1" },
    ];
    expect(gastoDelMes(filas, "2026-10", "America/Guayaquil")).toBeCloseTo(0.75);
  });
  it("calcula el costo por tokens", () => {
    expect(costoUsd(1_000_000, 100_000, { entrada: 0.1, salida: 0.5 })).toBeCloseTo(0.15);
    expect(costoUsd(1000, 1000, null)).toBe(0);
    expect(precioDe("claude-haiku-5-5", NaN, NaN)).toEqual({ entrada: 0.1, salida: 0.5 });
    expect(precioDe("modelo-raro", 1, 2)).toEqual({ entrada: 1, salida: 2 });
    expect(precioDe("modelo-raro", NaN, NaN)).toBeNull();
  });
  it("prepara el esquema estricto para OpenAI", () => {
    const s = esquemaEstricto({ $schema: "x", type: "object", properties: { a: { type: "object", properties: {} }, b: { type: "array", items: { type: "object" } } } }) as Record<string, any>;
    expect(s.$schema).toBeUndefined();
    expect(s.additionalProperties).toBe(false);
    expect(s.properties.a.additionalProperties).toBe(false);
    expect(s.properties.b.items.additionalProperties).toBe(false);
  });
});
