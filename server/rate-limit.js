/* ==========================================================
   Sahyly — rate limit simple por IP (en memoria, sin dependencias)

   Ventana deslizante en un Map. Es suficiente para un salón con un
   único proceso Node; si algún día el sitio corre en varias instancias
   habría que mover el contador a Redis o similar.
   ========================================================== */
"use strict";

const buckets = new Map(); // ip -> [timestamps]
const SWEEP_EVERY_MS = 10 * 60 * 1000;

/**
 * Devuelve un middleware Express que permite `max` peticiones por IP
 * cada `windowMs`. Al superarlo responde 429 con JSON.
 */
function rateLimit({ windowMs, max, message }) {
  const limiter = (req, res, next) => {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
    const now = Date.now();

    const hits = (buckets.get(ip) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      buckets.set(ip, hits);
      const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set("Retry-After", String(retryAfter));
      console.warn(`[rate-limit] ${ip} bloqueada: ${hits.length} peticiones en ${windowMs / 1000}s`);
      return res.status(429).json({ ok: false, error: message });
    }

    hits.push(now);
    buckets.set(ip, hits);
    next();
  };

  // Limpieza periódica para que el Map no crezca sin límite.
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, hits] of buckets) {
      const alive = hits.filter((t) => t > cutoff);
      if (alive.length) buckets.set(ip, alive);
      else buckets.delete(ip);
    }
  }, SWEEP_EVERY_MS);
  if (sweep.unref) sweep.unref(); // no mantiene vivo el proceso

  return limiter;
}

module.exports = { rateLimit };
