import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { firmar, firmaValida } from "@/lib/seguridad";
import { leerReporte } from "@/agentes/obra";
import "./reporte.css";

// El reporte de avance que Obra arma cada semana. Se abre con el enlace firmado: así lo puedes mandar
// a tus compradores sin que tengan que entrar a tu oficina.

export const metadata: Metadata = { title: "Reporte de avance de obra", robots: { index: false, follow: false } };

const ESTADOS = { terminada: "Terminada", en_curso: "En curso", por_empezar: "Por empezar", detenida: "Detenida" } as const;

const fecha = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("es", { day: "numeric", month: "long", timeZone: "UTC" });

export default async function PaginaReporte({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> }) {
  const { id } = await params;
  const { f } = await searchParams;
  const c = config();
  if (!/^[a-f0-9]{12}$/.test(id) || !firmaValida(id, f ?? "", c.clave, c.secreto, "reporte")) notFound();
  const r = await leerReporte(id).catch(() => null);
  if (!r) notFound();
  const { reporte } = r;
  const fotos = reporte.fotos
    .filter((x) => r.fotos[x.numero - 1])
    .slice(0, 6)
    .map((x) => {
      const fileId = r.fotos[x.numero - 1];
      return { pie: x.pie, src: `/api/foto/${encodeURIComponent(fileId)}?f=${firmar(fileId, c.clave, c.secreto, "foto")}` };
    });

  return (
    <main className="reporte">
      <header>
        <p className="eyebrow">
          {c.negocio.nombre} · Reporte de avance
        </p>
        <h1>{reporte.titulo}</h1>
        <p className="sub">
          {r.proyecto} · Semana del {fecha(r.desde)} al {fecha(r.hasta)}
        </p>
      </header>

      {reporte.avance_general !== null ? (
        <section className="avance" aria-label="Avance general">
          <div className="barra">
            <span style={{ width: `${reporte.avance_general}%` }} />
          </div>
          <p>
            <b>{Math.round(reporte.avance_general)} %</b> de avance general
          </p>
        </section>
      ) : null}

      <section>
        <p className="resumen">{reporte.resumen}</p>
      </section>

      {fotos.length ? (
        <section className="fotos">
          {fotos.map((x) => (
            <figure key={x.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.src} alt={x.pie} loading="lazy" />
              <figcaption>{x.pie}</figcaption>
            </figure>
          ))}
        </section>
      ) : null}

      {reporte.etapas.length ? (
        <section>
          <h2>Cómo va cada etapa</h2>
          <ul className="etapas">
            {reporte.etapas.map((e) => (
              <li key={e.nombre}>
                <div>
                  <b>{e.nombre}</b>
                  <span className={`estado ${e.estado}`}>{ESTADOS[e.estado]}</span>
                  {e.avance !== null ? <span className="pct">{Math.round(e.avance)} %</span> : null}
                </div>
                <p>{e.detalle}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reporte.proximos_pasos.length ? (
        <section>
          <h2>La próxima semana</h2>
          <ul>
            {reporte.proximos_pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {reporte.riesgos.length ? (
        <section>
          <h2>A tener en cuenta</h2>
          <ul>
            {reporte.riesgos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="sub">Reporte armado con las fotos y notas del equipo de obra.</footer>
    </main>
  );
}
