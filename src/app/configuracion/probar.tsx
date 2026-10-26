"use client";

import { useState } from "react";

export function Probar({ que, texto }: { que: "hoja" | "telegram" | "lead"; texto: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const probar = async () => {
    setOcupado(true);
    setResultado(null);
    try {
      const r = await fetch("/api/prueba", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ que }) });
      const d = (await r.json()) as { ok: boolean; mensaje?: string; error?: string };
      setResultado({ ok: d.ok, texto: d.ok ? (d.mensaje ?? "Listo.") : (d.error ?? "No funcionó.") });
    } catch {
      setResultado({ ok: false, texto: "Sin conexión. Prueba de nuevo." });
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button className="btn principal" type="button" onClick={probar} disabled={ocupado}>
        {ocupado ? "Un momento…" : texto}
      </button>
      {resultado ? (
        <p className={`pill ${resultado.ok ? "ok" : "falta"}`} role="status">
          {resultado.texto}
        </p>
      ) : null}
    </div>
  );
}
