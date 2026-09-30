/* ==========================================================
   Sahyly Salon & Boutique — correo de notificación al salón

   Maquetación con tablas + estilos inline, ancho máximo 600px, sin JS,
   sin CSS externo y sin fuentes remotas obligatorias (solo familias
   seguras: Georgia / Arial / Helvetica). Probado contra las reglas que
   aplica Gmail (web y móvil): se conservan únicamente las media queries
   dentro de <style>, y todo lo demás va inline por si Gmail las descarta.

   Todos los datos que vienen del cliente pasan por escapeHtml().
   ========================================================== */
"use strict";

const BookingData = require("../js/booking-data.js");

/* Paleta tomada de css/style.css (:root) para que el correo y la
   landing se vean como la misma marca. */
const PINK = "#E31C5F";
const PINK_DARK = "#C4134E";
const PINK_SOFT = "#FDEAF0";
const BLACK = "#171412";
const CHARCOAL = "#2b2724";
const GRAY = "#6f6a67";
const WHITE = "#ffffff";
const BORDER = "#f1e8e6";

const SALON_TIMEZONE = "America/El_Salvador";

/** Precio en español: la landing está en inglés, el correo no. */
function formatPriceEs(priceFrom) {
  return priceFrom == null ? "Precio a consultar" : "Desde $" + priceFrom;
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/** Solo dígitos, para tel: y wa.me. Asume +1 (EE. UU.) si vienen 10 dígitos. */
function phoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? "1" + digits : digits;
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOW_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = DOW_ES[dt.getDay()];
  return dow.charAt(0).toUpperCase() + dow.slice(1) + ", " + d + " de " + MONTHS_ES[m - 1] + " de " + y;
}

function formatTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + period;
}

/** Fecha y hora de envío en la zona horaria del salón (America/El_Salvador). */
function formatSentAt(isoString) {
  const dt = isoString ? new Date(isoString) : new Date();
  const parts = new Intl.DateTimeFormat("es-SV", {
    timeZone: SALON_TIMEZONE,
    dateStyle: "long",
    timeStyle: "short"
  }).format(dt);
  return parts + " (hora de El Salvador)";
}

/** Logo real solo si hay una URL pública; si no, nombre estilizado. */
function brandHeader() {
  const base = String(process.env.PUBLIC_SITE_URL || "").replace(/\/+$/, "");
  if (base) {
    return `<img src="${escapeHtml(base)}/img/logo.png" width="150" alt="Sahyly Salon &amp; Boutique" style="display:block;margin:0 auto;border:0;width:150px;max-width:60%;height:auto;">`;
  }
  return `<div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${PINK};letter-spacing:.02em;">Sahyly</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;letter-spacing:.28em;color:${WHITE};margin-top:6px;">SALON &amp; BOUTIQUE</div>`;
}

/** Fila etiqueta/valor de la tarjeta de datos. */
function row(label, valueHtml) {
  return `
      <tr>
        <td class="bk-row" style="padding:13px 0;border-bottom:1px solid ${BORDER};">
          <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:${GRAY};margin:0 0 5px;">${label}</span>
          <span style="display:block;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;color:${BLACK};line-height:1.45;">${valueHtml}</span>
        </td>
      </tr>`;
}

/** Botón "bulletproof": tabla + <a> con padding, sin depender de CSS. */
function button(href, label, bg, borderColor, textColor) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;margin:0 6px 10px;">
              <tr><td align="center" bgcolor="${bg}" style="border-radius:999px;border:1.5px solid ${borderColor};">
                <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;color:${textColor};text-decoration:none;border-radius:999px;">${label}</a>
              </td></tr>
            </table>`;
}

function buildBookingEmailSubject(booking) {
  const clientName = `${booking.customer_first_name} ${booking.customer_last_name}`.trim();
  return `Nuevo mensaje desde la web – Sahaly Salon – ${clientName}`;
}

function buildBookingEmailHtml(booking) {
  const clientName = escapeHtml(`${booking.customer_first_name} ${booking.customer_last_name}`.trim());
  const email = escapeHtml(booking.email);
  const digits = phoneDigits(booking.phone);
  const priceLabel = formatPriceEs(booking.price_from_snapshot);
  const stylistLabel = booking.assignment_mode === "automatic"
    ? escapeHtml(booking.stylist_name_snapshot) + " (asignación automática)"
    : escapeHtml(booking.stylist_name_snapshot);

  const recipientRow = booking.booking_for_someone_else
    ? row("La cita es para", escapeHtml(booking.recipient_name))
    : "";

  const messageBlock = booking.notes
    ? `
    <tr><td class="bk-pad" style="padding:28px 40px 0;">
      <h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.3;color:${BLACK};">Mensaje del cliente</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PINK_SOFT};border-radius:8px;border-left:4px solid ${PINK};">
        <tr><td style="padding:18px 20px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${CHARCOAL};">${escapeHtml(booking.notes).replace(/\r?\n/g, "<br>")}</td></tr>
      </table>
    </td></tr>`
    : "";

  const replyBtn = button(`mailto:${email}?subject=${encodeURIComponent("Tu cita en Sahyly Salon & Boutique")}`, "Responder al cliente", PINK, PINK, WHITE);
  const whatsappBtn = digits ? button(`https://wa.me/${digits}`, "WhatsApp", WHITE, BLACK, BLACK) : "";
  const callBtn = digits ? button(`tel:+${digits}`, "Llamar", WHITE, BLACK, BLACK) : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Nueva solicitud desde tu sitio web</title>
<style>
  /* Único CSS no inline: ajustes responsive. Si el cliente de correo lo
     ignora, el diseño inline sigue siendo válido y legible. */
  @media only screen and (max-width: 620px) {
    .bk-card  { width: 100% !important; border-radius: 0 !important; }
    .bk-pad   { padding-left: 22px !important; padding-right: 22px !important; }
    .bk-hero  { padding: 28px 22px !important; }
    .bk-btn a { display: block !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;width:100%;background:${PINK_SOFT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PINK_SOFT};">Nueva solicitud de cita de ${clientName} — ${escapeHtml(booking.service_name_snapshot)}, ${formatDateLong(booking.appointment_date)} a las ${formatTime(booking.start_time)}.</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PINK_SOFT}" style="background:${PINK_SOFT};">
<tr><td align="center" style="padding:32px 12px;">

<table role="presentation" class="bk-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${WHITE}" style="width:600px;max-width:600px;background:${WHITE};border-radius:12px;overflow:hidden;">

  <!-- encabezado con marca -->
  <tr><td class="bk-hero" align="center" bgcolor="${BLACK}" style="background:${BLACK};padding:34px 40px;">
    ${brandHeader()}
  </td></tr>

  <!-- franja de color principal -->
  <tr><td bgcolor="${PINK}" style="background:${PINK};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

  <!-- título -->
  <tr><td class="bk-pad" style="padding:36px 40px 0;">
    <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase;color:${PINK};">Sitio web</p>
    <h1 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;color:${BLACK};font-weight:normal;">Nueva solicitud desde tu sitio web</h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${GRAY};">${clientName} acaba de reservar una cita desde el sitio web. Estos son los datos:</p>
  </td></tr>

  <!-- código de reserva -->
  <tr><td class="bk-pad" style="padding:26px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PINK_SOFT}" style="background:${PINK_SOFT};border-radius:8px;">
      <tr><td align="center" style="padding:20px;">
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;color:${GRAY};margin-bottom:6px;">Código de reserva</span>
        <span style="display:block;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:bold;letter-spacing:.02em;color:${PINK_DARK};">${escapeHtml(booking.booking_code)}</span>
      </td></tr>
    </table>
  </td></tr>

  <!-- tarjeta: datos de la cita -->
  <tr><td class="bk-pad" style="padding:28px 40px 0;">
    <h2 style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.3;color:${BLACK};">Detalle de la cita</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Servicio", escapeHtml(booking.service_name_snapshot))}
      ${row("Estilista", stylistLabel)}
      ${row("Precio desde", escapeHtml(priceLabel))}
      ${row("Fecha", formatDateLong(booking.appointment_date))}
      ${row("Hora", formatTime(booking.start_time) + " &ndash; " + formatTime(booking.end_time))}
    </table>
  </td></tr>

  <!-- tarjeta: datos del cliente -->
  <tr><td class="bk-pad" style="padding:28px 40px 0;">
    <h2 style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.3;color:${BLACK};">Datos del cliente</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${row("Nombre", clientName)}
      ${row("Teléfono", `<a href="tel:+${digits}" style="color:${BLACK};text-decoration:none;">${escapeHtml(booking.phone)}</a>`)}
      ${row("Correo", `<a href="mailto:${email}" style="color:${BLACK};text-decoration:none;">${email}</a>`)}
      ${recipientRow}
    </table>
  </td></tr>

  ${messageBlock}

  <!-- acciones -->
  <tr><td class="bk-pad bk-btn" align="center" style="padding:30px 40px 6px;">
    ${replyBtn}${whatsappBtn}${callBtn}
  </td></tr>

  <!-- separador -->
  <tr><td class="bk-pad" style="padding:20px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td bgcolor="${BORDER}" style="background:${BORDER};height:1px;line-height:1px;font-size:0;">&nbsp;</td>
    </tr></table>
  </td></tr>

  <!-- pie -->
  <tr><td class="bk-pad" align="center" style="padding:24px 40px 36px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:bold;color:${BLACK};margin-bottom:6px;">Sahyly Salon &amp; Boutique</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.7;color:${GRAY};">
      ${escapeHtml(BookingData.salon.address1)}<br>${escapeHtml(BookingData.salon.address2)}<br>${escapeHtml(BookingData.salon.phone)}
    </div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${GRAY};margin-top:14px;">
      Enviado el ${escapeHtml(formatSentAt(booking.created_at))}
    </div>
  </td></tr>

</table>

<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${GRAY};margin-top:18px;">Correo automático generado por el sitio web de Sahyly Salon &amp; Boutique.</div>

</td></tr>
</table>
</body>
</html>`;
}

/** Versión en texto plano (se envía junto con la HTML). */
function buildBookingEmailText(booking) {
  const clientName = `${booking.customer_first_name} ${booking.customer_last_name}`.trim();
  const priceLabel = formatPriceEs(booking.price_from_snapshot);
  const stylistLabel = booking.assignment_mode === "automatic"
    ? `${booking.stylist_name_snapshot} (asignación automática)`
    : booking.stylist_name_snapshot;

  const lines = [
    "SAHYLY SALON & BOUTIQUE",
    "Nueva solicitud desde tu sitio web",
    "",
    `Código de reserva: ${booking.booking_code}`,
    "",
    "DETALLE DE LA CITA",
    `Servicio: ${booking.service_name_snapshot}`,
    `Estilista: ${stylistLabel}`,
    `Precio desde: ${priceLabel}`,
    `Fecha: ${formatDateLong(booking.appointment_date)}`,
    `Hora: ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`,
    "",
    "DATOS DEL CLIENTE",
    `Nombre: ${clientName}`,
    `Teléfono: ${booking.phone}`,
    `Correo: ${booking.email}`
  ];

  if (booking.booking_for_someone_else) lines.push(`La cita es para: ${booking.recipient_name}`);
  if (booking.notes) lines.push("", "MENSAJE DEL CLIENTE", booking.notes);

  lines.push(
    "",
    `Responder al cliente: mailto:${booking.email}`,
    ...(phoneDigits(booking.phone) ? [`WhatsApp: https://wa.me/${phoneDigits(booking.phone)}`, `Llamar: tel:+${phoneDigits(booking.phone)}`] : []),
    "",
    "--",
    "Sahyly Salon & Boutique",
    `${BookingData.salon.address1}, ${BookingData.salon.address2}`,
    BookingData.salon.phone,
    `Enviado el ${formatSentAt(booking.created_at)}`
  );

  return lines.join("\n");
}

module.exports = {
  buildBookingEmailHtml,
  buildBookingEmailText,
  buildBookingEmailSubject,
  escapeHtml,
  formatSentAt,
  SALON_TIMEZONE
};
