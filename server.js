/* ==========================================================
   Sahyly Salon & Boutique — server
   Serves the existing static frontend (index.html, css/, js/, img/)
   and the booking API on one Express app/port. Only those specific
   folders are exposed — server/, data/, package.json, node_modules
   and .env are never reachable over HTTP.
   ========================================================== */
"use strict";

require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");

const BookingData = require("./js/booking-data.js");
const Store = require("./server/db.js");
const { validateBookingPayload } = require("./server/validate.js");
const { sendBookingNotification } = require("./server/mailer.js");
const { rateLimit } = require("./server/rate-limit.js");

const app = express();
app.use(express.json({ limit: "50kb" }));
// Detrás de un proxy (Netlify/Render/Nginx) req.ip debe salir de
// X-Forwarded-For, o el rate limit vería una sola IP para todo el mundo.
app.set("trust proxy", 1);

// Anti-spam: máximo 10 peticiones de reserva por IP cada 10 minutos.
const bookingRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos desde esta conexión. Espera unos minutos e inténtalo de nuevo."
});

// ---- static frontend (explicit allow-list, not a root-level static mount) ----
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/img", express.static(path.join(__dirname, "img")));

// ---- availability ----
app.get("/api/availability", (req, res) => {
  const { service_id, stylist_id, date } = req.query;

  const service = BookingData.serviceById(service_id);
  if (!service) return res.status(400).json({ ok: false, error: "Invalid service." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return res.status(400).json({ ok: false, error: "Invalid date." });

  const [y, m, d] = date.split("-").map(Number);
  const dateObj = new Date(y, m - 1, d);
  const hours = BookingData.businessHours[dateObj.getDay()];
  if (!hours || hours.closed) return res.json({ slots: [] });

  const isAny = stylist_id === "any";
  const stylist = BookingData.stylistById(stylist_id);
  if (!stylist) return res.status(400).json({ ok: false, error: "Invalid stylist." });

  const candidateIds = isAny
    ? BookingData.realStylists().filter((s) => BookingData.stylistOffersService(s, service.id)).map((s) => s.id)
    : [stylist.id];

  const duration = service.duration_minutes;
  const slots = [];
  for (let t = hours.open; t + duration <= hours.close; t += BookingData.SLOT_STEP_MINUTES) {
    const available = Store.findAvailableStylistIds(candidateIds, date, t, t + duration);
    if (available.length > 0) slots.push({ start: t, availableStylistIds: available });
  }
  res.json({ ok: true, slots });
});

// ---- create booking ----
app.post("/api/bookings", bookingRateLimit, async (req, res) => {
  const validation = validateBookingPayload(req.body);
  if (!validation.ok) {
    if (validation.spam) {
      console.warn(`[api/bookings] descartada por honeypot (IP ${req.ip})`);
    }
    return res.status(400).json({ ok: false, error: validation.message });
  }
  const v = validation.data;

  // Idempotent retry: if this exact client request already produced a
  // booking, return it again instead of creating a duplicate.
  if (v.clientRequestId) {
    const existing = Store.findByClientRequestId(v.clientRequestId);
    if (existing) return res.status(200).json({ ok: true, booking: existing });
  }

  // Resolve the final stylist + re-check availability right before writing
  // — this is the authoritative check; nothing about the frontend's earlier
  // slot list is trusted here.
  let finalStylistId, assignmentMode;
  if (v.isAnyStylist) {
    const candidates = BookingData.realStylists()
      .filter((s) => BookingData.stylistOffersService(s, v.service.id))
      .map((s) => s.id);
    const available = Store.findAvailableStylistIds(candidates, v.appointmentDate, v.startTime, v.endTime);
    if (available.length === 0) {
      return res.status(409).json({ ok: false, error: "Ese horario acaba de ser reservado. Elige otro, por favor." });
    }
    finalStylistId = available[0];
    assignmentMode = "automatic";
  } else {
    if (!Store.isSlotAvailableForStylist(v.stylist.id, v.appointmentDate, v.startTime, v.endTime)) {
      return res.status(409).json({ ok: false, error: "Ese horario acaba de ser reservado. Elige otro, por favor." });
    }
    finalStylistId = v.stylist.id;
    assignmentMode = "manual";
  }
  const finalStylist = BookingData.stylistById(finalStylistId);

  const now = new Date().toISOString();
  const id = "bk_" + crypto.randomUUID();
  let booking;
  try {
    booking = Store.insertBookingAtomic(id, v.appointmentDate, {
      client_request_id: v.clientRequestId,
      service_id: v.service.id,
      service_name_snapshot: v.service.name,
      price_from_snapshot: v.service.priceFrom,
      stylist_id: finalStylist.id,
      stylist_name_snapshot: finalStylist.name,
      assignment_mode: assignmentMode,
      customer_first_name: v.firstName,
      customer_last_name: v.lastName,
      phone: v.phone,
      email: v.email,
      appointment_date: v.appointmentDate,
      start_time: v.startTime,
      end_time: v.endTime,
      booking_for_someone_else: v.bookingForOther ? 1 : 0,
      recipient_name: v.bookingForOther ? v.recipientName : null,
      notes: v.notes,
      status: "pending",
      notification_email_status: "pending",
      notification_email_sent_at: null,
      notification_email_error: null,
      created_at: now,
      updated_at: now
    });
  } catch (err) {
    console.error("[api/bookings] failed to persist booking:", err);
    return res.status(500).json({ ok: false, error: "No pudimos registrar tu cita. Inténtalo de nuevo en unos minutos." });
  }

  // The booking is safely persisted at this point — everything past here
  // (email) is secondary and must never undo or fail the booking itself.
  const emailResult = await sendBookingNotification(booking);
  Store.markEmailStatus(booking.id, emailResult.status, emailResult.status === "sent" ? new Date().toISOString() : null, emailResult.error || null);
  booking.notification_email_status = emailResult.status;

  res.status(201).json({ ok: true, booking });
});

// ---- fallback error handler: never leak internals to the client ----
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error("[unhandled]", err);
  res.status(500).json({ ok: false, error: "Algo salió mal. Inténtalo de nuevo, por favor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sahyly server running on http://localhost:${PORT}`);
  const missing = ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn(`[startup] falta(n) ${missing.join(", ")} — los correos de cita se omitirán y quedarán como 'failed'. Ver .env.example.`);
  }
});
