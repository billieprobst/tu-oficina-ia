import { config } from "@/lib/config";

// Telegram es el canal de tu oficina: te avisa a ti y recibe las fotos de obra. Es gratis y no pide permisos de Meta.

const api = (metodo: string) => `https://api.telegram.org/bot${config().telegram.token}/${metodo}`;

async function llamar<T>(metodo: string, cuerpo: Record<string, unknown>): Promise<T> {
  const res = await fetch(api(metodo), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    cache: "no-store",
  });
  const d = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!d.ok) throw new Error(`Telegram (${metodo}): ${d.description ?? res.status}`);
  return d.result as T;
}

/** Telegram corta los mensajes en 4.096 caracteres. */
export const recortar = (t: string) => (t.length > 4000 ? `${t.slice(0, 3990)}…` : t);

export async function enviar(chatId: string | number, texto: string): Promise<void> {
  await llamar("sendMessage", { chat_id: chatId, text: recortar(texto), link_preview_options: { is_disabled: true } });
}

/** Avisa a todos los dueños (TELEGRAM_DUENOS). Nunca rompe el flujo si Telegram falla. */
export async function avisarDuenos(texto: string): Promise<void> {
  const { token, duenos } = config().telegram;
  if (!token || !duenos.length) return;
  await Promise.all(duenos.map((id) => enviar(id, texto).catch(() => undefined)));
}

export async function configurarWebhook(url: string, secreto: string): Promise<void> {
  await llamar("setWebhook", { url, secret_token: secreto, allowed_updates: ["message"], drop_pending_updates: false });
}

/** Descarga un archivo de Telegram (hasta 20 MB) por su file_id. */
export async function descargar(fileId: string): Promise<{ datos: Buffer; tipo: string }> {
  const f = await llamar<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!f.file_path) throw new Error("Telegram no tiene ese archivo.");
  const res = await fetch(`https://api.telegram.org/file/bot${config().telegram.token}/${f.file_path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No pude bajar el archivo (${res.status}).`);
  const ext = f.file_path.split(".").pop()?.toLowerCase() ?? "";
  const tipo = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return { datos: Buffer.from(await res.arrayBuffer()), tipo };
}

// ---------- Mensajes que llegan ----------

export interface MensajeTelegram {
  chatId: string;
  deId: string;
  nombre: string;
  texto: string;
  /** file_id de la foto más grande, si mandó foto. */
  foto: string | null;
}

/** Lee lo que importa de un update de Telegram. Puro, con pruebas. */
export function leerUpdate(update: unknown): MensajeTelegram | null {
  const m = (update as { message?: Record<string, unknown> })?.message;
  if (!m) return null;
  const chat = m.chat as { id?: number } | undefined;
  const de = m.from as { id?: number; first_name?: string; last_name?: string } | undefined;
  if (!chat?.id || !de?.id) return null;
  const fotos = (m.photo as { file_id: string; file_size?: number; width?: number }[] | undefined) ?? [];
  const mayor = fotos.reduce<{ file_id: string; width?: number } | null>((a, b) => (!a || (b.width ?? 0) > (a.width ?? 0) ? b : a), null);
  const doc = m.document as { file_id: string; mime_type?: string } | undefined;
  const fotoDoc = doc?.mime_type?.startsWith("image/") ? doc.file_id : null;
  return {
    chatId: String(chat.id),
    deId: String(de.id),
    nombre: [de.first_name, de.last_name].filter(Boolean).join(" ") || "Alguien",
    texto: String(m.text ?? m.caption ?? "").trim(),
    foto: mayor?.file_id ?? fotoDoc,
  };
}
