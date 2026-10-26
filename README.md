# Tu oficina IA

Tu equipo de agentes trabajando solos, en una oficina 3D que puedes mirar desde el celular.
Hecho por Inmoescala para asesores inmobiliarios y constructores.

Usa **tus** cuentas y **tus** claves: tus datos quedan en tu Google Sheets y la IA la pagas tú, directo a la empresa
que elijas. Nada pasa por Inmoescala.

## Qué hace hoy

| Agente | Se despierta cuando… | Hace solo |
|---|---|---|
| **Recepción** | Llega un interesado: Make, Zapier, n8n, el formulario de tu web, o le reenvías el mensaje al bot | Lo califica (caliente, tibio o frío), lo anota en tu hoja y te manda a Telegram el resumen y la respuesta lista para copiar |
| **Obra** | Tu residente le manda fotos o notas al bot de Telegram | Las guarda, y el día que elijas arma el **reporte de avance** con fotos, para compartirlo con tus compradores |
| **Jefe de oficina** | Todas las noches | Te manda el resumen del día y cuánto llevas gastado de IA. No usa IA |

Ningún agente le escribe a un cliente por su cuenta: te deja todo listo y tú decides.

Vienen pronto: Seguimiento, Documentos, Cotizaciones y Analista de mercado.

## Lo que necesitas (todo tiene plan gratis para empezar)

1. Una cuenta de **GitHub** y una de **Vercel**.
2. Una clave de IA: **Gemini** (recomendado para empezar), **Claude** u **OpenAI**.
3. Una hoja de **Google Sheets** y una cuenta de servicio de Google.
4. Un bot de **Telegram**, creado con @BotFather.

La guía paso a paso, con capturas y video, está en La Bóveda del Club de Inmoescala.

## Instalación (resumen)

1. Copia este repositorio a tu GitHub (**Use this template** o **Fork**).
2. En Vercel: **Add New → Project**, elige tu copia y, antes de **Deploy**, agrega las variables de `.env.example`.
3. Comparte tu Google Sheets como **Editor** con el correo de tu cuenta de servicio.
4. Entra a tu oficina con tu contraseña y abre **Configuración**:
   - **Preparar mi hoja**: crea las pestañas.
   - **Conectar mi bot**: conecta Telegram. Escríbele `/start` a tu bot, pon el número que te da en `TELEGRAM_DUENOS` y vuelve a desplegar.
   - **Probar Recepción**: manda un lead de ejemplo.
5. Conecta tus fuentes de leads: en Make o Zapier, agrega un paso **HTTP / Webhook** que haga POST a
   `https://TU-OFICINA.vercel.app/api/entrada/lead`, con la cabecera `x-oficina-secreto: TU SECRETO_ENTRADA`
   y un JSON así:

```json
{ "mensaje": "Hola, me interesa la casa…", "nombre": "Carla Ruiz", "telefono": "+593…", "correo": "carla@…", "origen": "Portal" }
```

La respuesta trae la calificación y `respuesta_sugerida`. Con eso, el mismo escenario de Make o Zapier puede crear
el borrador en tu Gmail.

## El reloj

`vercel.json` llama a `/api/reloj` una vez al día (23:00 UTC; en Ecuador, 18:00). En el plan gratis de Vercel las
tareas programadas corren como máximo una vez al día, y eso alcanza para el resumen diario y el reporte semanal.
Para otro horario, cambia `schedule` en `vercel.json`.

## Cuánto cuesta la IA

Cada uso queda anotado en la pestaña **Uso** de tu hoja, con sus tokens y su costo. Al llegar a `TOPE_MENSUAL_USD`,
los agentes paran hasta el mes siguiente.

- Los precios de Claude y OpenAI vienen cargados en `src/lib/ia/precios.ts`.
- Para Gemini, o si tu precio es otro, pon `IA_PRECIO_ENTRADA` e `IA_PRECIO_SALIDA` (USD por millón de tokens).
  Sin precio, el gasto se anota como 0.
- Con Claude, el modelo por defecto es `claude-opus-5-5`. Para gastar menos, usa `IA_MODELO=claude-haiku-5-5`.

En el plan gratis de Gemini, Google puede usar lo que mandas para mejorar sus modelos. Si prefieres que no, usa un
plan de pago.

## Para quien programa

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm test           # pruebas (no salen a internet)
npm run typecheck
```

- `src/agentes/`: qué hace cada agente.
- `src/lib/`: IA, Google Sheets, Telegram y seguridad.
- `src/oficina/motor.js`: la oficina 3D (Three.js).

Licencia MIT. Puedes usarlo y modificarlo; conserva el aviso de Inmoescala.
