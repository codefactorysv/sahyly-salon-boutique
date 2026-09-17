/* ==========================================================
   Sahyly booking backend — request validation

   Re-validates everything server-side. The frontend's own validation
   is only a UX convenience; nothing here trusts it.
   ========================================================== */
"use strict";

const BookingData = require("../js/booking-data.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Solo dígitos, espacios y los separadores habituales: + ( ) - .
const PHONE_RE = /^[\d\s().+-]+$/;

// Longitudes máximas: cortan cargas absurdas antes de llegar a la BD o
// al correo. Coinciden con los maxlength del formulario (booking-drawer.js).
const MAX = {
  name: 60,
  phone: 25,
  email: 120,
  recipient: 80,
  notes: 1000
};

function tooLong(value, limit) {
  return String(value || "").length > limit;
}

function todayMidnightUTCFromLocalParts() {
  // The frontend sends appointment_date as a plain "YYYY-MM-DD" (no
  // timezone) representing a calendar date, so we compare it the same
  // way here: as a date-only string, not a timestamp.
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateStr(dateStr) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Validates a raw booking request body against the shared services/
 * stylists/business-hours config. Returns { ok:true, data } with a
 * clean, coerced payload, or { ok:false, message } with a message
 * that is safe to show the client (no internals).
 */
function validateBookingPayload(body) {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Solicitud inválida." };
  }

  // Honeypot: campo oculto que una persona nunca llena. Si viene con
  // contenido es un bot, y se rechaza sin más pistas sobre el motivo.
  if (String(body.company || "").trim() !== "") {
    return { ok: false, message: "Solicitud inválida.", spam: true };
  }

  const service = BookingData.serviceById(body.service_id);
  if (!body.service_id || !service) {
    return { ok: false, message: "Selecciona un servicio válido." };
  }

  const isAnyStylist = body.stylist_id === "any";
  const stylist = BookingData.stylistById(body.stylist_id);
  if (!body.stylist_id || !stylist) {
    return { ok: false, message: "Selecciona una estilista válida." };
  }
  if (!isAnyStylist && !BookingData.stylistOffersService(stylist, service.id)) {
    return { ok: false, message: "Esa estilista no ofrece el servicio seleccionado." };
  }

  const dateObj = parseDateStr(body.appointment_date);
  if (!dateObj) {
    return { ok: false, message: "Selecciona una fecha válida." };
  }
  const todayStr = todayMidnightUTCFromLocalParts();
  if (body.appointment_date < todayStr) {
    return { ok: false, message: "La fecha de la cita no puede estar en el pasado." };
  }

  const hours = BookingData.businessHours[dateObj.getDay()];
  if (!hours || hours.closed) {
    return { ok: false, message: "El salón está cerrado ese día. Elige otra fecha, por favor." };
  }

  const startTime = Number(body.start_time);
  if (!Number.isInteger(startTime) || startTime < 0 || startTime > 24 * 60) {
    return { ok: false, message: "Selecciona una hora válida." };
  }
  const duration = service.duration_minutes;
  const endTime = startTime + duration;
  if (startTime < hours.open || endTime > hours.close) {
    return { ok: false, message: "Esa hora está fuera del horario de atención del salón." };
  }
  if ((startTime - hours.open) % BookingData.SLOT_STEP_MINUTES !== 0) {
    return { ok: false, message: "Selecciona una hora válida." };
  }

  const firstName = String(body.customer_first_name || "").trim();
  const lastName = String(body.customer_last_name || "").trim();
  if (!firstName) return { ok: false, message: "Escribe tu nombre." };
  if (!lastName) return { ok: false, message: "Escribe tus apellidos." };
  if (tooLong(firstName, MAX.name) || tooLong(lastName, MAX.name)) {
    return { ok: false, message: "El nombre es demasiado largo." };
  }

  const phone = String(body.phone || "").trim();
  const phoneDigits = phone.replace(/\D/g, "");
  if (tooLong(phone, MAX.phone) || !PHONE_RE.test(phone) || phoneDigits.length < 10 || phoneDigits.length > 15) {
    return { ok: false, message: "Escribe un teléfono válido de 10 dígitos." };
  }

  const email = String(body.email || "").trim();
  if (tooLong(email, MAX.email) || !EMAIL_RE.test(email)) {
    return { ok: false, message: "Escribe un correo electrónico válido." };
  }

  const bookingForOther = Boolean(body.booking_for_someone_else);
  const recipientName = bookingForOther ? String(body.recipient_name || "").trim() : "";
  if (bookingForOther && !recipientName) {
    return { ok: false, message: "Escribe el nombre de la persona que recibirá el servicio." };
  }
  if (tooLong(recipientName, MAX.recipient)) {
    return { ok: false, message: "Ese nombre es demasiado largo." };
  }

  const notes = String(body.notes || "").trim().slice(0, MAX.notes);
  const clientRequestId = body.client_request_id ? String(body.client_request_id).slice(0, 100) : null;

  return {
    ok: true,
    data: {
      service,
      isAnyStylist,
      stylist,
      appointmentDate: body.appointment_date,
      startTime,
      endTime,
      firstName,
      lastName,
      phone,
      email,
      bookingForOther,
      recipientName,
      notes,
      clientRequestId
    }
  };
}

module.exports = { validateBookingPayload, MAX_LENGTHS: MAX };
