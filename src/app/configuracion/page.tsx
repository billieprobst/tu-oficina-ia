import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { config, estado } from "@/lib/config";
import { haySesion } from "@/lib/sesion";
import { Marca } from "@/app/marca";
import { Probar } from "@/app/configuracion/probar";

function Fila({ listo, titulo, children }: { listo: boolean; titulo: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h2>{titulo}</h2>
        <span className={`pill ${listo ? "ok" : "falta"}`}>{listo ? "Listo" : "Falta"}</span>
      </div>
      {children}
    </section>
  );
}

export default async function Configuracion() {
  if (!(await haySesion())) redirect("/entrar");
  const c = config();
  const e = estado(c);
  const h = await headers();
  const origen = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return (
    <main className="envoltura">
      <header className="top">
        <Marca sub="Configuración" />
        <a className="btn" href="/oficina">
          Volver a la oficina
        </a>
      </header>
      <div className="rejilla">
        <Fila listo={e.ia} titulo="1. Tu IA">
          <p>
            Usas <b>{c.ia.proveedor === "gemini" ? "Gemini (Google)" : c.ia.proveedor === "claude" ? "Claude (Anthropic)" : "OpenAI"}</b> con el modelo{" "}
            <code>{c.ia.modelo}</code>. Tope del mes: {c.topeMensualUsd} USD.
          </p>
          {!e.ia ? <p className="sub">Agrega {c.ia.nombreClave} en Vercel con tu clave.</p> : null}
        </Fila>
        <Fila listo={e.sheets} titulo="2. Tu Google Sheets">
          <p className="sub">Ahí quedan tus leads, los avances de obra, los reportes y lo que gasta cada agente.</p>
          {e.sheets ? <Probar que="hoja" texto="Preparar mi hoja" /> : <p className="sub">Agrega GOOGLE_SHEET_ID, GOOGLE_CUENTA_CORREO y GOOGLE_CUENTA_LLAVE.</p>}
        </Fila>
        <Fila listo={e.telegram} titulo="3. Tu bot de Telegram">
          <p className="sub">Te avisa de cada lead y recibe las fotos de obra.</p>
          {c.telegram.token ? (
            <>
              <Probar que="telegram" texto="Conectar mi bot" />
              {!c.telegram.duenos.length ? (
                <p className="sub">Después escríbele /start a tu bot: te dirá tu número. Ponlo en TELEGRAM_DUENOS.</p>
              ) : null}
            </>
          ) : (
            <p className="sub">Crea tu bot con @BotFather y agrega TELEGRAM_BOT_TOKEN.</p>
          )}
        </Fila>
        <Fila listo={e.secreto} titulo="4. Entrada de leads (Make, Zapier, n8n o tu web)">
          <p className="sub">Manda cada interesado a esta dirección, con el método POST y un JSON con el campo mensaje:</p>
          <p>
            <span className="codigo">{origen}/api/entrada/lead</span>
          </p>
          <p className="sub">
            Pon tu SECRETO_ENTRADA en la cabecera <code>x-oficina-secreto</code>. Campos que acepta: <code>mensaje</code> (obligatorio), <code>nombre</code>,{" "}
            <code>telefono</code>, <code>correo</code> y <code>origen</code>.
          </p>
          {e.ia && e.sheets ? <Probar que="lead" texto="Probar Recepción con un lead de ejemplo" /> : null}
        </Fila>
        <Fila listo={Boolean(c.cron)} titulo="5. El reloj de la oficina">
          <p className="sub">
            Una vez al día el Jefe te manda el resumen. Los {c.obra.diaReporte}, Obra arma el reporte de {c.obra.proyecto}. Necesita CRON_SECRET en Vercel.
          </p>
        </Fila>
      </div>
      {e.faltan.length ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Lo que falta</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {e.faltan.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="sub">Se agregan en Vercel → tu proyecto → Settings → Environment Variables. Después toca Redeploy.</p>
        </section>
      ) : null}
    </main>
  );
}
