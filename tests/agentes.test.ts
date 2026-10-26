import { describe, expect, it } from "vitest";
import { avisoTelegram, Calificacion, globoRecepcion, LeadEntrada, textoParaIa } from "@/agentes/recepcion";
import { elegirFotos, filasDeLaSemana, Reporte } from "@/agentes/obra";
import { textoResumen } from "@/agentes/jefe";
import { decidir } from "@/agentes/telegram-bot";
import { leerUpdate } from "@/lib/telegram";

const lead = LeadEntrada.parse({ mensaje: "Quiero ver el depa de 2 habitaciones el sábado", nombre: "Carla Ruiz", telefono: "+593999", origen: "Portal" });
const cal: Calificacion = {
  temperatura: "caliente",
  tipo: "comprador",
  presupuesto: "95 mil",
  zona: null,
  plazo: "este sábado",
  credito: "preaprobado",
  resumen: "Busca un depa de 2 habitaciones.",
  siguiente_paso: "Llamarla hoy.",
  respuesta_sugerida: "Hola, Carla. ¿Te queda bien el sábado a las 10?",
};

describe("Recepción", () => {
  it("exige el mensaje y limita el largo", () => {
    expect(LeadEntrada.safeParse({ nombre: "X" }).success).toBe(false);
    expect(LeadEntrada.safeParse({ mensaje: "x".repeat(5001) }).success).toBe(false);
    expect(LeadEntrada.safeParse({ mensaje: "Hola, me interesa" }).success).toBe(true);
  });
  it("no le manda el teléfono ni el correo a la IA", () => {
    const t = textoParaIa({ ...lead, correo: "carla@correo.com" });
    expect(t).not.toContain("+593999");
    expect(t).not.toContain("carla@correo.com");
    expect(t).toContain("Quiero ver el depa");
  });
  it("arma el aviso de Telegram y el globito", () => {
    const a = avisoTelegram(lead, cal);
    expect(a).toContain("Lead caliente: Carla Ruiz (Portal)");
    expect(a).toContain("Presupuesto: 95 mil · Plazo: este sábado · Crédito: preaprobado");
    expect(a).toContain("Teléfono: +593999");
    expect(a).toContain("Hola, Carla.");
    expect(a).not.toMatch(/\n\n\n/);
    expect(globoRecepcion(lead, cal)).toBe("Carla escribió desde Portal. Lo califiqué caliente: Busca un depa de 2 habitaciones.");
  });
  it("valida lo que devuelve la IA", () => {
    expect(Calificacion.safeParse({ ...cal, temperatura: "hirviendo" }).success).toBe(false);
    expect(Calificacion.safeParse(cal).success).toBe(true);
  });
});

describe("Obra", () => {
  it("elige fotos repartidas en la semana", () => {
    expect(elegirFotos([1, 2, 3])).toEqual([1, 2, 3]);
    const doce = Array.from({ length: 12 }, (_, i) => i);
    const ocho = elegirFotos(doce);
    expect(ocho).toHaveLength(8);
    expect(ocho[0]).toBe(0);
    expect(ocho[7]).toBe(11);
  });
  it("toma solo los últimos 7 días en la zona del negocio", () => {
    const filas = [
      { fecha: "2026-10-20T15:00:00Z", texto: "fuera" },
      { fecha: "2026-10-21T15:00:00Z", texto: "dentro" },
      { fecha: "2026-10-28T02:00:00Z", texto: "todavía 27 en Guayaquil" },
    ];
    expect(filasDeLaSemana(filas, "2026-10-21", "2026-10-27", "America/Guayaquil").map((f) => f.texto)).toEqual(["dentro", "todavía 27 en Guayaquil"]);
  });
  it("no acepta porcentajes inventados fuera de rango", () => {
    const base = { titulo: "T", resumen: "R", avance_general: null, etapas: [], fotos: [], proximos_pasos: [], riesgos: [] };
    expect(Reporte.safeParse(base).success).toBe(true);
    expect(Reporte.safeParse({ ...base, avance_general: 140 }).success).toBe(false);
  });
});

describe("Jefe de oficina", () => {
  it("resume el día sin IA", () => {
    const t = textoResumen(
      [
        { id: "1", fecha: "", agente: "recepcion", texto: "Carla escribió. Lo califiqué caliente: busca casa." },
        { id: "2", fecha: "", agente: "recepcion", texto: "Luis escribió. Lo califiqué tibio: pregunta precios." },
        { id: "3", fecha: "", agente: "obra", texto: "Pedro mandó una foto." },
        { id: "4", fecha: "", agente: "jefe", texto: "Resumen" },
      ],
      0.42,
      5,
      "26 de octubre",
    );
    expect(t).toContain("Recepción atendió 2 interesados (1 caliente).");
    expect(t).toContain("Obra anotó 1 avance de la obra.");
    expect(t).toContain("IA del mes: 0.42 de 5 USD.");
    expect(textoResumen([], 0, 5, "26 de octubre")).toContain("Hoy no hubo movimiento.");
  });
});

describe("bot de Telegram", () => {
  const c = { telegram: { token: "x", duenos: ["111"], obra: ["222"] } };
  const msg = (deId: string, texto: string, foto: string | null = null) => ({ chatId: deId, deId, nombre: "N", texto, foto });

  it("lee un update con foto (la más grande)", () => {
    const m = leerUpdate({
      message: { chat: { id: 111 }, from: { id: 111, first_name: "Ana" }, caption: "Losa lista", photo: [{ file_id: "chica", width: 90 }, { file_id: "grande", width: 1280 }] },
    });
    expect(m).toEqual({ chatId: "111", deId: "111", nombre: "Ana", texto: "Losa lista", foto: "grande" });
    expect(leerUpdate({})).toBeNull();
  });
  it("decide qué hacer según quién escribe", () => {
    expect(decidir(msg("999", "/start"), c)).toEqual({ tipo: "id" });
    expect(decidir(msg("999", "hola"), c)).toEqual({ tipo: "desconocido" });
    expect(decidir(msg("111", "Hola, vi la casa en Samborondón"), c)).toEqual({ tipo: "lead", mensaje: "Hola, vi la casa en Samborondón" });
    expect(decidir(msg("111", "/lead Me interesa el depa"), c)).toEqual({ tipo: "lead", mensaje: "Me interesa el depa" });
    expect(decidir(msg("111", "", "f1"), c)).toEqual({ tipo: "obra" });
    expect(decidir(msg("111", "/obra Se terminó la losa"), c)).toEqual({ tipo: "obra" });
    expect(decidir(msg("111", "/reporte"), c)).toEqual({ tipo: "reporte" });
    expect(decidir(msg("111", "/resumen@MiBot"), c)).toEqual({ tipo: "resumen" });
    expect(decidir(msg("111", "/nose"), c)).toEqual({ tipo: "ayuda" });
    expect(decidir(msg("222", "Avanzamos con mampostería"), c)).toEqual({ tipo: "obra" });
    expect(decidir(msg("222", "/reporte"), c)).toEqual({ tipo: "ayuda" });
  });
});
