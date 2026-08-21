/* ==========================================================
   Sahyly booking backend — Resend integration

   Server-side only. RESEND_API_KEY is read from process.env and
   never touches any file the browser can load.
   ========================================================== */
"use strict";

const { Resend } = require("resend");
const { buildBookingEmailHtml, buildBookingEmailSubject } = require("./email-template.js");

let resendClient = null;
function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/**
 * Sends the admin notification for a booking. Never throws — a failed
 * email must not affect the already-created booking. Returns
 * { status: 'sent' | 'failed', error?: string }.
 */
async function sendBookingNotification(booking) {
  const client = getClient();
  const from = `${process.env.RESEND_FROM_NAME || "Sahyly Salon & Boutique"} <${process.env.RESEND_FROM_EMAIL || ""}>`;
  const to = process.env.BOOKING_NOTIFICATION_EMAIL;

  if (!client || !process.env.RESEND_FROM_EMAIL || !to) {
    const missing = [
      !process.env.RESEND_API_KEY && "RESEND_API_KEY",
      !process.env.RESEND_FROM_EMAIL && "RESEND_FROM_EMAIL",
      !to && "BOOKING_NOTIFICATION_EMAIL"
    ].filter(Boolean).join(", ");
    console.error(`[mailer] skipped sending for ${booking.booking_code} — missing env var(s): ${missing}`);
    return { status: "failed", error: `Missing env var(s): ${missing}` };
  }

  try {
    const result = await client.emails.send({
      from,
      to,
      replyTo: booking.email,
      subject: buildBookingEmailSubject(booking),
      html: buildBookingEmailHtml(booking)
    });
    if (result && result.error) {
      console.error(`[mailer] Resend returned an error for ${booking.booking_code}:`, result.error);
      return { status: "failed", error: String(result.error.message || result.error) };
    }
    return { status: "sent" };
  } catch (err) {
    console.error(`[mailer] failed to send notification for ${booking.booking_code}:`, err);
    return { status: "failed", error: String((err && err.message) || err) };
  }
}

module.exports = { sendBookingNotification };
