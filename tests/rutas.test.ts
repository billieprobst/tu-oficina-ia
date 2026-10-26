import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Las rutas, con la hoja, la IA y Telegram simulados: nada sale a internet.
const filas: Record<string, Record<string, unknown>[]> = {};
vi.mock("@/lib/sheets", () => ({
  agregarFila: vi.fn(async (p: string, f: Record<string, unknown>) => void (filas[p] ??= []).push(f)),
  leerFilas: vi.fn(async () => []),
  prepararHoja: vi.fn(async () => []),
}));
vi.mock("@/lib/telegram", async (original) => ({
  ...(await original<typeof import("@/lib/telegram")>()),
  avisarDuenos: vi.fn(async () => undefined),
  enviar: vi.fn(async () => undefined),
}));
vi.mock("@/lib/ia/proveedores", async (original) => ({
  ...(await original<typeof import("@/lib/ia/proveedores")>()),
  gemini: vi.fn(async () => ({
    json: {
      temperatura: "caliente",
      tipo: "comprador",
      presupuesto: "95 mil",
      zona: null,
      plazo: "sábado",
      credito: "preaprobado",
      resumen: "Busca 2 habitaciones.",
      siguiente_paso: "Llamar hoy.",
      respuesta_sugerida: "Hola, Carla.",
    },
    tokensEntrada: 1000,
    tokensSalida: 200,
  })),
}));

const SECRETO = "secreto-de-prueba-de-al-menos-24";

beforeEach(() => {
  for (const k of Object.keys(filas)) delete filas[k];
  vi.stubEnv("SECRETO_ENTRADA", SECRETO);
  vi.stubEnv("OFICINA_CLAVE", "clave");
  vi.stubEnv("GEMINI_API_KEY", "clave-falsa");
  vi.stubEnv("IA_PROVEEDOR", "gemini");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
  vi.stubEnv("TELEGRAM_DUENOS", "111");
});
afterEach(() => vi.unstubAllEnvs());

const pedir = (cuerpo: unknown, secreto = SECRETO) =>
  new Request("https://oficina.test/api/entrada/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-oficina-secreto": secreto },
    body: JSON.stringify(cuerpo),
  });

describe("POST /api/entrada/lead", () => {
  it("rechaza sin el secreto", async () => {
    const { POST } = await import("@/app/api/entrada/lead/route");
    expect((await POST(pedir({ mensaje: "Hola" }, "otro"))).status).toBe(401);
  });
  it("pide el mensaje", async () => {
    const { POST } = await import("@/app/api/entrada/lead/route");
    expect((await POST(pedir({ nombre: "Carla" }))).status).toBe(400);
  });
  it("califica, anota el lead, el evento y el gasto", async () => {
    const { POST } = await import("@/app/api/entrada/lead/route");
    const r = await POST(pedir({ mensaje: "Quiero ver el depa el sábado", nombre: "Carla Ruiz", origen: "Portal" }));
    const d = await r.json();
    expect(r.status).toBe(200);
    expect(d).toMatchObject({ ok: true, temperatura: "caliente", respuesta_sugerida: "Hola, Carla." });
    expect(filas.Leads?.[0]).toMatchObject({ nombre: "Carla Ruiz", temperatura: "caliente", origen: "Portal" });
    expect(filas.Eventos?.[0]).toMatchObject({ agente: "recepcion" });
    expect(filas.Uso?.[0]).toMatchObject({ agente: "recepcion", proveedor: "gemini", tokens_entrada: 1000 });
  });
  it("acepta el secreto en la dirección si la herramienta no deja poner cabeceras", async () => {
    const { POST } = await import("@/app/api/entrada/lead/route");
    const r = await POST(
      new Request(`https://oficina.test/api/entrada/lead?secreto=${SECRETO}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje: "Hola" }) }),
    );
    expect(r.status).toBe(200);
  });
});

describe("POST /api/telegram", () => {
  it("rechaza si no viene de Telegram", async () => {
    const { POST } = await import("@/app/api/telegram/route");
    const r = await POST(new Request("https://oficina.test/api/telegram", { method: "POST", body: "{}" }));
    expect(r.status).toBe(401);
  });
});

describe("GET /api/reloj", () => {
  it("solo con CRON_SECRET", async () => {
    vi.stubEnv("CRON_SECRET", "cron-123");
    const { GET } = await import("@/app/api/reloj/route");
    expect((await GET(new Request("https://oficina.test/api/reloj"))).status).toBe(401);
    expect((await GET(new Request("https://oficina.test/api/reloj", { headers: { authorization: "Bearer otro" } }))).status).toBe(401);
  });
});
