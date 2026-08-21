/* ==========================================================
   Sahyly booking backend — SQLite persistence

   Single-file embedded database (no separate DB server to run/
   configure). All writes go through db.transaction(), which
   better-sqlite3 executes synchronously and exclusively — combined
   with the UNIQUE constraint on booking_code, this is what actually
   makes the per-date sequence and the "no double booking" checks
   safe under concurrent requests, not just a JS-level convention.
   ========================================================== */
"use strict";

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "sahyly.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id                          TEXT PRIMARY KEY,
    booking_code                TEXT NOT NULL UNIQUE,
    client_request_id           TEXT UNIQUE,

    service_id                  TEXT NOT NULL,
    service_name_snapshot       TEXT NOT NULL,
    price_from_snapshot         INTEGER,

    stylist_id                  TEXT NOT NULL,
    stylist_name_snapshot       TEXT NOT NULL,
    assignment_mode             TEXT NOT NULL,

    customer_first_name         TEXT NOT NULL,
    customer_last_name          TEXT NOT NULL,
    phone                       TEXT NOT NULL,
    email                       TEXT NOT NULL,

    appointment_date            TEXT NOT NULL,
    start_time                  INTEGER NOT NULL,
    end_time                    INTEGER NOT NULL,

    booking_for_someone_else    INTEGER NOT NULL DEFAULT 0,
    recipient_name              TEXT,

    notes                       TEXT,
    status                      TEXT NOT NULL DEFAULT 'pending',

    notification_email_status   TEXT NOT NULL DEFAULT 'pending',
    notification_email_sent_at  TEXT,
    notification_email_error    TEXT,

    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_stylist_date ON bookings(stylist_id, appointment_date);
  CREATE INDEX IF NOT EXISTS idx_bookings_code_prefix ON bookings(booking_code);
`);

const ACTIVE_STATUSES = ["pending", "confirmed"];

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function findByClientRequestId(clientRequestId) {
  if (!clientRequestId) return null;
  return db.prepare("SELECT * FROM bookings WHERE client_request_id = ?").get(clientRequestId) || null;
}

function isSlotAvailableForStylist(stylistId, dateStr, startMin, endMin) {
  const rows = db.prepare(
    `SELECT start_time, end_time FROM bookings
     WHERE stylist_id = ? AND appointment_date = ? AND status IN ('pending','confirmed')`
  ).all(stylistId, dateStr);
  return !rows.some((b) => overlaps(startMin, endMin, b.start_time, b.end_time));
}

function findAvailableStylistIds(candidateStylistIds, dateStr, startMin, endMin) {
  return candidateStylistIds.filter((id) => isSlotAvailableForStylist(id, dateStr, startMin, endMin));
}

function pad2(n) { return n < 10 ? "0" + n : String(n); }

function codePrefixForDate(dateStr) {
  const [yyyy, mm, dd] = dateStr.split("-");
  return "SAH-" + dd + mm + yyyy.slice(2);
}

function nextSequenceForPrefix(prefix) {
  const rows = db.prepare("SELECT booking_code FROM bookings WHERE booking_code LIKE ?").all(prefix + "-%");
  const re = new RegExp("^" + prefix + "-(\\d+)$");
  let max = 0;
  for (const row of rows) {
    const m = row.booking_code.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return max + 1;
}

const insertStmt = db.prepare(`
  INSERT INTO bookings (
    id, booking_code, client_request_id,
    service_id, service_name_snapshot, price_from_snapshot,
    stylist_id, stylist_name_snapshot, assignment_mode,
    customer_first_name, customer_last_name, phone, email,
    appointment_date, start_time, end_time,
    booking_for_someone_else, recipient_name,
    notes, status,
    notification_email_status, notification_email_sent_at, notification_email_error,
    created_at, updated_at
  ) VALUES (
    @id, @booking_code, @client_request_id,
    @service_id, @service_name_snapshot, @price_from_snapshot,
    @stylist_id, @stylist_name_snapshot, @assignment_mode,
    @customer_first_name, @customer_last_name, @phone, @email,
    @appointment_date, @start_time, @end_time,
    @booking_for_someone_else, @recipient_name,
    @notes, @status,
    @notification_email_status, @notification_email_sent_at, @notification_email_error,
    @created_at, @updated_at
  )
`);

/**
 * Atomically compute the next per-date sequence, build the booking_code,
 * and insert — all inside one SQLite transaction. If a UNIQUE collision
 * ever happens anyway (only plausible if two processes wrote to the same
 * file at the exact same instant), recompute the sequence and retry
 * instead of overwriting anything.
 */
function insertBookingAtomic(id, appointmentDate, row) {
  const prefix = codePrefixForDate(appointmentDate);
  const maxAttempts = 25;

  const attempt = db.transaction(() => {
    const seq = nextSequenceForPrefix(prefix);
    const code = prefix + "-" + (seq < 100 ? pad2(seq) : String(seq));
    insertStmt.run(Object.assign({}, row, { id, booking_code: code }));
    return db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
  });

  for (let i = 0; i < maxAttempts; i++) {
    try {
      return attempt();
    } catch (err) {
      const isCodeCollision = err && err.code === "SQLITE_CONSTRAINT_UNIQUE" && /booking_code/.test(err.message || "");
      if (isCodeCollision && i < maxAttempts - 1) continue;
      throw err;
    }
  }
}

function markEmailStatus(id, status, sentAt, error) {
  db.prepare(
    `UPDATE bookings SET notification_email_status = ?, notification_email_sent_at = ?, notification_email_error = ?, updated_at = ? WHERE id = ?`
  ).run(status, sentAt, error, new Date().toISOString(), id);
}

module.exports = {
  db,
  isSlotAvailableForStylist,
  findAvailableStylistIds,
  findByClientRequestId,
  insertBookingAtomic,
  markEmailStatus
};
