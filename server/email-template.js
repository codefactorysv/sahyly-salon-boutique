/* ==========================================================
   Sahyly booking backend — admin notification email (HTML)
   Table-based layout, inline CSS only, no JS — for Gmail/Outlook/
   Apple Mail compatibility. All user-supplied fields are escaped.
   ========================================================== */
"use strict";

const BookingData = require("../js/booking-data.js");

const PINK = "#E31C5F";
const PINK_SOFT = "#FDEAF0";
const BLACK = "#171412";
const CHARCOAL = "#2b2724";
const GRAY = "#6f6a67";

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOW_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = DOW_ES[dt.getDay()];
  return dow.charAt(0).toUpperCase() + dow.slice(1) + ", " + d + " de " + MONTHS_ES[m - 1] + " de " + y;
}
function formatDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}
function formatTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  return h12 + ":" + String(m).padStart(2, "0") + " " + period;
}

function row(label, valueHtml) {
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #f1e8e6;">
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${GRAY};margin:0 0 4px;">${label}</span>
        <span style="display:block;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;color:${BLACK};line-height:1.4;">${valueHtml}</span>
      </td>
    </tr>`;
}

function buildBookingEmailHtml(booking) {
  const priceLabel = BookingData.formatPrice(booking.price_from_snapshot);
  const stylistLabel = booking.assignment_mode === "automatic"
    ? escapeHtml(booking.stylist_name_snapshot) + " (asignación automática)"
    : escapeHtml(booking.stylist_name_snapshot);

  const notesBlock = booking.notes
    ? `
    <tr><td style="padding-top:26px;">
      <h3 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:${BLACK};">Notas del cliente</h3>
      <p style="margin:0;padding:14px 16px;background:${PINK_SOFT};border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${CHARCOAL};">${escapeHtml(booking.notes).replace(/\n/g, "<br>")}</p>
    </td></tr>`
    : "";

  const recipientBlock = booking.booking_for_someone_else
    ? row("La cita es para", escapeHtml(booking.recipient_name))
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nueva cita Sahyly</title>
</head>
<body style="margin:0;padding:0;background:${PINK_SOFT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PINK_SOFT};padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">

  <tr><td style="background:${BLACK};padding:32px 40px;text-align:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:${PINK};letter-spacing:.02em;">Sahyly</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:.28em;color:#ffffff;margin-top:4px;">SALON &amp; BOUTIQUE</div>
  </td></tr>

  <tr><td style="padding:36px 40px 8px;">
    <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${BLACK};">Nueva cita registrada</h1>
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${GRAY};line-height:1.6;">Se ha recibido una nueva reserva desde el sitio web.</p>
  </td></tr>

  <tr><td style="padding:24px 40px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PINK_SOFT};border-radius:8px;">
      <tr><td style="padding:22px 20px;text-align:center;">
        <span style="display:block;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${GRAY};margin-bottom:6px;">Código de reserva</span>
        <span style="display:block;font-family:Georgia,'Times New Roman',serif;font-size:23px;font-weight:700;letter-spacing:.02em;color:${PINK};white-space:nowrap;">${escapeHtml(booking.booking_code)}</span>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:8px 40px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Servicio", escapeHtml(booking.service_name_snapshot))}
      ${row("Estilista", stylistLabel)}
      ${row("Precio", priceLabel)}
      ${row("Fecha", formatDateLong(booking.appointment_date))}
      ${row("Hora", formatTime(booking.start_time))}
    </table>
  </td></tr>

  <tr><td style="padding:26px 40px 0;">
    <h2 style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:${BLACK};">Datos del cliente</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row("Nombre", escapeHtml(booking.customer_first_name) + " " + escapeHtml(booking.customer_last_name))}
      ${row("Teléfono", escapeHtml(booking.phone))}
      ${row("Correo", escapeHtml(booking.email))}
      ${recipientBlock}
    </table>
  </td></tr>

  ${notesBlock}

  <tr><td style="padding:34px 40px 0;">
    <div style="height:1px;background:linear-gradient(to right, transparent, ${PINK}, transparent);"></div>
  </td></tr>

  <tr><td style="padding:26px 40px 36px;text-align:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;color:${BLACK};margin-bottom:6px;">Sahyly Salon &amp; Boutique</div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${GRAY};line-height:1.6;">
      3604 Fairmont Pkwy<br>Suite A-2<br>Pasadena, TX 77504<br>713-505-4551
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildBookingEmailSubject(booking) {
  return `Nueva cita Sahyly | ${formatDateShort(booking.appointment_date)} | ${booking.customer_first_name} ${booking.customer_last_name} | ${booking.booking_code}`;
}

module.exports = { buildBookingEmailHtml, buildBookingEmailSubject, escapeHtml };
