/* ==========================================================
   Sahyly booking backend — request validation

   Re-validates everything server-side. The frontend's own validation
   is only a UX convenience; nothing here trusts it.
   ========================================================== */
"use strict";

const BookingData = require("../js/booking-data.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    return { ok: false, message: "Invalid request." };
  }

  const service = BookingData.serviceById(body.service_id);
  if (!body.service_id || !service) {
    return { ok: false, message: "Select a valid service." };
  }

  const isAnyStylist = body.stylist_id === "any";
  const stylist = BookingData.stylistById(body.stylist_id);
  if (!body.stylist_id || !stylist) {
    return { ok: false, message: "Select a valid stylist." };
  }
  if (!isAnyStylist && !BookingData.stylistOffersService(stylist, service.id)) {
    return { ok: false, message: "That stylist doesn't offer the selected service." };
  }

  const dateObj = parseDateStr(body.appointment_date);
  if (!dateObj) {
    return { ok: false, message: "Select a valid date." };
  }
  const todayStr = todayMidnightUTCFromLocalParts();
  if (body.appointment_date < todayStr) {
    return { ok: false, message: "The appointment date can't be in the past." };
  }

  const hours = BookingData.businessHours[dateObj.getDay()];
  if (!hours || hours.closed) {
    return { ok: false, message: "The salon is closed that day. Please choose another date." };
  }

  const startTime = Number(body.start_time);
  if (!Number.isInteger(startTime) || startTime < 0 || startTime > 24 * 60) {
    return { ok: false, message: "Select a valid time." };
  }
  const duration = service.duration_minutes;
  const endTime = startTime + duration;
  if (startTime < hours.open || endTime > hours.close) {
    return { ok: false, message: "That time is outside the salon's business hours." };
  }
  if ((startTime - hours.open) % BookingData.SLOT_STEP_MINUTES !== 0) {
    return { ok: false, message: "Select a valid time." };
  }

  const firstName = String(body.customer_first_name || "").trim();
  const lastName = String(body.customer_last_name || "").trim();
  if (!firstName) return { ok: false, message: "First name is required." };
  if (!lastName) return { ok: false, message: "Last name is required." };

  const phoneDigits = String(body.phone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10) return { ok: false, message: "Enter a valid phone number." };

  const email = String(body.email || "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter a valid email address." };

  const bookingForOther = Boolean(body.booking_for_someone_else);
  const recipientName = bookingForOther ? String(body.recipient_name || "").trim() : "";
  if (bookingForOther && !recipientName) {
    return { ok: false, message: "Enter the name of the person receiving the service." };
  }

  const notes = String(body.notes || "").trim().slice(0, 1000);
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
      phone: String(body.phone || "").trim(),
      email,
      bookingForOther,
      recipientName,
      notes,
      clientRequestId
    }
  };
}

module.exports = { validateBookingPayload };
