/* ==========================================================
   Genera email-preview.html con datos de ejemplo para revisar el
   diseño del correo en el navegador, sin enviar nada.

   Uso:  npm run email:preview   (luego abrir email-preview.html)
   ========================================================== */
"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  buildBookingEmailHtml,
  buildBookingEmailText,
  buildBookingEmailSubject
} = require("../server/email-template.js");

const sample = {
  id: "bk_preview",
  booking_code: "SHY-20260412-014",
  service_id: "balayage-completo",
  service_name_snapshot: "Full Balayage",
  price_from_snapshot: 285,
  stylist_id: "sahyly-pedraza",
  stylist_name_snapshot: "Sahyly Pedraza",
  assignment_mode: "manual",
  customer_first_name: "María José",
  customer_last_name: "Hernández",
  phone: "(713) 555-0142",
  email: "maria.hernandez@example.com",
  appointment_date: "2026-04-12",
  start_time: 14 * 60 + 30,
  end_time: 15 * 60 + 30,
  booking_for_someone_else: 1,
  recipient_name: "Andrea Hernández",
  notes: "Quisiera un tono un poco más claro que la última vez.\nSi hay espacio, también me gustaría un corte de puntas.",
  status: "pending",
  created_at: new Date().toISOString()
};

const outHtml = path.join(__dirname, "..", "email-preview.html");
const outText = path.join(__dirname, "..", "email-preview.txt");

fs.writeFileSync(outHtml, buildBookingEmailHtml(sample), "utf8");
fs.writeFileSync(outText, buildBookingEmailText(sample), "utf8");

console.log("Asunto:", buildBookingEmailSubject(sample));
console.log("HTML  ->", outHtml);
console.log("Texto ->", outText);
