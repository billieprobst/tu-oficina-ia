import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { COOKIE_SESION, crearSesion, iguales } from "@/lib/seguridad";
import { haySesion } from "@/lib/sesion";
import { Marca } from "@/app/marca";

async function entrar(datos: FormData) {
  "use server";
  const c = config();
  const dada = String(datos.get("clave") ?? "");
  if (!c.clave || c.secreto.length < 24 || !iguales(dada, c.clave)) redirect("/entrar?error=1");
  const s = crearSesion(c.clave, c.secreto);
  const jar = await cookies();
  jar.set(COOKIE_SESION, s.valor, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: s.maxAge });
  redirect("/oficina");
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await haySesion()) redirect("/oficina");
  const { error } = await searchParams;
  const c = config();
  const listo = Boolean(c.clave) && c.secreto.length >= 24;
  return (
    <main className="envoltura" style={{ maxWidth: 440, paddingTop: 48 }}>
      <div className="top">
        <Marca sub={c.negocio.nombre} />
      </div>
      <form action={entrar} className="card">
        <h2>Entra a tu oficina</h2>
        {listo ? (
          <>
            <label className="campo">
              <span>Contraseña</span>
              <input id="clave" name="clave" type="password" autoComplete="current-password" required />
            </label>
            {error ? <p className="pill falta">Esa no es la contraseña. Prueba de nuevo.</p> : null}
            <button className="btn principal" type="submit">
              Entrar
            </button>
          </>
        ) : (
          <p className="sub">
            Falta configurar la contraseña. En Vercel, entra a Settings → Environment Variables y agrega
            OFICINA_CLAVE y SECRETO_ENTRADA. Después toca Redeploy.
          </p>
        )}
      </form>
    </main>
  );
}
