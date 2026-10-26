"use client";

import { useEffect, useRef, useState } from "react";
import "./oficina.css";

type AgenteId = "recepcion" | "obra" | "jefe";
interface Evento {
  id: string;
  fecha: string;
  agente: AgenteId;
  texto: string;
  visita?: AgenteId;
}
interface Motor {
  mostrar(eventos: Evento[]): void;
  elegir(id: string | null): void;
  destruir(): void;
}

const FICHAS: Record<AgenteId, { nombre: string; color: string; hace: string; como: string }> = {
  recepcion: {
    nombre: "Recepción",
    color: "#d9480f",
    hace: "Califica a cada interesado que llega (caliente, tibio o frío), lo anota en tu hoja y te deja la respuesta lista en Telegram.",
    como: "Se despierta cuando llega un lead por Make, Zapier, tu formulario o cuando le reenvías un mensaje al bot.",
  },
  obra: {
    nombre: "Obra",
    color: "#e67700",
    hace: "Guarda las fotos y notas de la obra y cada semana arma solo el reporte de avance para tus compradores.",
    como: "Se despierta cuando el residente le manda fotos al bot de Telegram. El reporte sale el día que elegiste.",
  },
  jefe: {
    nombre: "Jefe de oficina",
    color: "#2f52a0",
    hace: "Cada noche te manda el resumen de lo que hizo cada agente y cuánto llevas gastado de IA. No usa IA.",
    como: "Se despierta solo, una vez al día.",
  },
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false });

let vistos: Set<string> | null = null;
function yaVisto(id: string): boolean {
  if (!vistos) {
    try {
      vistos = new Set(JSON.parse(sessionStorage.getItem("oficina_vistos") ?? "[]"));
    } catch {
      vistos = new Set();
    }
  }
  if (vistos.has(id)) return true;
  vistos.add(id);
  try {
    sessionStorage.setItem("oficina_vistos", JSON.stringify([...vistos].slice(-300)));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
  return false;
}

export function Oficina({ negocio }: { negocio: string }) {
  const escena = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const motor = useRef<Motor | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [elegido, setElegido] = useState<AgenteId | null>(null);
  const [gasto, setGasto] = useState<{ gasto: number; tope: number } | null>(null);
  const [aviso, setAviso] = useState("");
  const [sin3d, setSin3d] = useState(false);

  // El motor 3D se carga solo en el navegador.
  useEffect(() => {
    let cancelado = false;
    import("@/oficina/motor.js")
      .then(({ crearOficina }) => {
        if (cancelado || !escena.current || !capa.current) return;
        try {
          motor.current = crearOficina(escena.current, capa.current, {
            negocio,
            alElegir: (id: string | null) => setElegido(id as AgenteId | null),
          }) as Motor;
        } catch {
          setSin3d(true);
        }
      })
      .catch(() => setSin3d(true));
    return () => {
      cancelado = true;
      motor.current?.destruir();
      motor.current = null;
    };
  }, [negocio]);

  useEffect(() => motor.current?.elegir(elegido), [elegido]);

  // Pregunta qué pasó hoy cada 20 segundos (solo con la pestaña a la vista).
  useEffect(() => {
    let primera = true;
    const traer = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch("/api/eventos", { cache: "no-store" });
        const d = (await r.json()) as { ok: boolean; eventos?: Evento[]; gasto?: number; tope?: number; aviso?: string; error?: string };
        if (!d.ok) return setAviso(d.error ?? "No pude leer tu hoja.");
        setAviso(d.aviso ?? "");
        const todos = d.eventos ?? [];
        setEventos(todos);
        if (typeof d.gasto === "number" && typeof d.tope === "number") setGasto({ gasto: d.gasto, tope: d.tope });
        const nuevos = todos.filter((e) => !yaVisto(e.id));
        // Al abrir, solo se cuentan los 3 últimos; lo demás queda en la lista.
        const aMostrar = primera ? nuevos.slice(-3) : nuevos.length > 6 ? nuevos.slice(-2) : nuevos;
        primera = false;
        if (aMostrar.length) {
          const tarda = () => motor.current?.mostrar(aMostrar);
          if (motor.current) tarda();
          else setTimeout(tarda, 1500);
        }
      } catch {
        setAviso("Sin conexión. Vuelvo a intentar en unos segundos.");
      }
    };
    traer();
    const intervalo = setInterval(traer, 20_000);
    return () => clearInterval(intervalo);
  }, []);

  const ficha = elegido ? FICHAS[elegido] : null;
  const hechos = elegido ? eventos.filter((e) => e.agente === elegido).length : 0;

  return (
    <div className="oficina">
      <div className="escena" ref={escena}>
        {sin3d ? <p className="sin3d">Tu navegador no puede mostrar la oficina en 3D. Aquí al lado está todo lo que pasó hoy.</p> : null}
        <div className="capa" ref={capa} />
        <span className="ayuda">Arrastra para girar · toca a alguien</span>
      </div>
      <aside className="panel">
        <section className="card" aria-live="polite">
          {ficha ? (
            <>
              <div className="ficha">
                <span className="avatar" style={{ background: ficha.color }}>
                  {ficha.nombre.charAt(0)}
                </span>
                <div className="ficha-texto">
                  <b>{ficha.nombre}</b>
                  <span className="sub">Agente de tu oficina · {hechos === 0 ? "hoy todavía nada" : `${hechos} ${hechos === 1 ? "cosa" : "cosas"} hoy`}</span>
                </div>
                <button className="btn" type="button" onClick={() => setElegido(null)}>
                  Cerrar
                </button>
              </div>
              <p>{ficha.hace}</p>
              <p className="sub">{ficha.como}</p>
            </>
          ) : (
            <>
              <h2>Tu equipo</h2>
              <p className="sub">3 agentes trabajando y 4 escritorios que se llenan pronto. Toca a alguien para ver qué hace.</p>
              <div className="chips">
                {(Object.keys(FICHAS) as AgenteId[]).map((id) => (
                  <button key={id} type="button" className="chip" onClick={() => setElegido(id)}>
                    <i style={{ background: FICHAS[id].color }} />
                    {FICHAS[id].nombre}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="card">
          <h2>Lo que pasó hoy</h2>
          {aviso ? <p className="pill falta">{aviso}</p> : null}
          {eventos.length ? (
            <ol className="feed">
              {[...eventos].reverse().slice(0, 10).map((e) => (
                <li key={e.id} className="linea">
                  <i style={{ background: FICHAS[e.agente].color }} />
                  <div>
                    {e.texto}
                    <small>
                      {hora(e.fecha)} · {FICHAS[e.agente].nombre}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="sub">Todavía no pasa nada hoy. Cuando llegue un interesado o una foto de obra, lo vas a ver aquí.</p>
          )}
        </section>
        {gasto ? (
          <p className="sub gasto">
            IA del mes: {gasto.gasto.toFixed(2)} de {gasto.tope} USD
          </p>
        ) : null}
      </aside>
    </div>
  );
}
