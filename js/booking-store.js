/* ==========================================================
   Sahyly — Booking system: backend API client

   Talks to the real server (server.js + server/db.js) over fetch.
   All availability checks, sequence/code generation, and persistence
   now happen server-side — this module never touches localStorage.
   booking-drawer.js only ever calls these functions, never fetch()
   directly.
   ========================================================== */
(function (global) {
  "use strict";

  /** GET /api/availability — returns [{start, availableStylistIds}]. */
  async function fetchSlotsForDate(serviceId, stylistId, dateStr) {
    const params = new URLSearchParams({ service_id: serviceId, stylist_id: stylistId, date: dateStr });
    const res = await fetch("/api/availability?" + params.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return data.slots || [];
  }

  /**
   * POST /api/bookings. Returns { ok:true, booking } on success or
   * { ok:false, message, status } on a handled error (validation
   * failure, slot no longer available, or network/server error) —
   * `message` is always safe to show the client directly.
   */
  async function submitBooking(payload) {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, status: res.status, message: data.error || "We couldn't book your appointment. Please try again." };
      }
      return { ok: true, booking: data.booking };
    } catch (err) {
      return { ok: false, status: 0, message: "We couldn't connect to the server. Check your connection and try again." };
    }
  }

  global.SahylyBookingStore = {
    fetchSlotsForDate: fetchSlotsForDate,
    submitBooking: submitBooking
  };
})(window);
