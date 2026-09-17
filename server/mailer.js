/* ==========================================================
   Sahyly — envío de correos con Resend

   Solo servidor. RESEND_API_KEY se lee de process.env y nunca llega a
   ningún archivo que el navegador pueda descargar (server.js solo
   publica /css, /js, /img e index.html).
   ========================================================== */
"use strict";

const { Resend } = require("resend");
const {
  buildBookingEmailHtml,
  buildBookingEmailText,
  buildBookingEmailSubject
} = require("./email-template.js");

let resendClient = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// CONTACT_TO_EMAIL / CONTACT_FROM_EMAIL son los nombres actuales;
// RESEND_FROM_EMAIL, RESEND_FROM_NAME y BOOKING_NOTIFICATION_EMAIL se
// mantienen como alias para no romper despliegues antiguos.
function fromAddress() {
  if (process.env.CONTACT_FROM_EMAIL) return process.env.CONTACT_FROM_EMAIL;
  if (process.env.RESEND_FROM_EMAIL) {
    return `${process.env.RESEND_FROM_NAME || "Sahyly Salon & Boutique"} <${process.env.RESEND_FROM_EMAIL}>`;
  }
  return "";
}
function toAddress() {
  return process.env.CONTACT_TO_EMAIL || process.env.BOOKING_NOTIFICATION_EMAIL || "";
}

/**
 * Envía al salón la notificación de una cita. Nunca lanza: un correo
 * fallido no debe afectar a la reserva ya creada.
 * Devuelve { status: 'sent', id } o { status: 'failed', error }.
 * `error` es para el log/BD — al cliente solo se le devuelve un mensaje
 * genérico desde server.js.
 */
async function sendBookingNotification(booking) {
  const client = getClient();
  const from = fromAddress();
  const to = toAddress();

  if (!client || !from || !to) {
    const missing = [
      !process.env.RESEND_API_KEY && "RESEND_API_KEY",
      !from && "CONTACT_FROM_EMAIL",
      !to && "CONTACT_TO_EMAIL"
    ].filter(Boolean).join(", ");
    console.error(`[mailer] envío omitido para ${booking.booking_code} — falta(n) variable(s) de entorno: ${missing}`);
    return { status: "failed", error: `Missing env var(s): ${missing}` };
  }

  try {
    const result = await client.emails.send({
      from,
      to,
      replyTo: booking.email, // responder al correo escribe directo al cliente
      subject: buildBookingEmailSubject(booking),
      html: buildBookingEmailHtml(booking),
      text: buildBookingEmailText(booking)
    });

    if (result && result.error) {
      // Resend devuelve el error en el cuerpo, no como excepción.
      console.error(`[mailer] Resend devolvió un error para ${booking.booking_code}:`, result.error);
      return { status: "failed", error: String(result.error.message || result.error) };
    }

    const id = result && result.data ? result.data.id : null;
    console.log(`[mailer] correo enviado para ${booking.booking_code} — Resend id: ${id}`);
    return { status: "sent", id };
  } catch (err) {
    console.error(`[mailer] fallo al enviar la notificación de ${booking.booking_code}:`, err);
    return { status: "failed", error: String((err && err.message) || err) };
  }
}

module.exports = { sendBookingNotification };
