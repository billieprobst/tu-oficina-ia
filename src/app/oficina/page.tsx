import Link from "next/link";
import { redirect } from "next/navigation";
import { config, estado } from "@/lib/config";
import { haySesion } from "@/lib/sesion";
import { Marca } from "@/app/marca";
import { Oficina } from "@/app/oficina/oficina-cliente";

export default async function PaginaOficina() {
  if (!(await haySesion())) redirect("/entrar");
  const c = config();
  const e = estado(c);
  return (
    <main className="envoltura">
      <header className="top">
        <Marca sub={c.negocio.nombre} />
        <div className="acciones">
          {e.faltan.length || !e.telegram ? (
            <Link className="btn" href="/configuracion">
              Terminar de configurar
            </Link>
          ) : (
            <Link className="btn" href="/configuracion">
              Configuración
            </Link>
          )}
        </div>
      </header>
      <Oficina negocio={c.negocio.nombre} />
    </main>
  );
}
