/* ==========================================================
   Sahyly — Booking system: central configuration
   Edit this file to update services, stylists, hours, or salon info.
   ========================================================== */
(function () {
  "use strict";
  // Isomorphic: runs as a plain <script> in the browser (attaches to
  // window) and as a CommonJS module on the server (same file, same
  // data — the backend requires this directly so services/stylists/
  // hours can never drift between frontend and backend).
  var global = typeof window !== "undefined" ? window : globalThis;

  /* ---------------------------------------------------------
     Services
     priceFrom: number in USD, or null to show "Contact for pricing".
     duration_minutes: placeholder default (60) used only to compute
     appointment slots/overlaps — never shown to the client. Replace
     per service once real durations are available.
  --------------------------------------------------------- */
  var services = [
    { id: "corte-mujer",            name: "Women's Haircut",               priceFrom: 35,  duration_minutes: 60 },
    { id: "corte-hombre",           name: "Men's Haircut",                 priceFrom: 25,  duration_minutes: 60 },
    { id: "corte-nino",             name: "Children's Haircut",            priceFrom: 20,  duration_minutes: 60 },
    { id: "lavado-peinado",         name: "Wash & Blowout",                priceFrom: 55,  duration_minutes: 60 },
    { id: "peinado-updo",           name: "Styling / Updo",                priceFrom: 85,  duration_minutes: 60 },
    { id: "color-one-process",      name: "One Process Color",             priceFrom: 100, duration_minutes: 60 },
    { id: "retoque-raices",         name: "Root Touch-Up",                 priceFrom: 80,  duration_minutes: 60 },
    { id: "toner-gloss",            name: "Toner or Gloss",                priceFrom: 65,  duration_minutes: 60 },
    { id: "iluminaciones-parciales",name: "Partial Highlights",            priceFrom: 185, duration_minutes: 60 },
    { id: "iluminaciones-completas",name: "Full Highlights",               priceFrom: 250, duration_minutes: 60 },
    { id: "balayage-parcial",       name: "Partial Balayage",              priceFrom: 220, duration_minutes: 60 },
    { id: "balayage-completo",      name: "Full Balayage",                 priceFrom: 285, duration_minutes: 60 },
    { id: "ombre",                  name: "Ombré",                         priceFrom: 300, duration_minutes: 60 },
    { id: "keratina",               name: "Keratin Treatment",             priceFrom: 250, duration_minutes: 60 },
    { id: "clip-in-extensions",     name: "Clip-In Extensions",            priceFrom: null, duration_minutes: 60 },
    { id: "hair-extensions",        name: "Hair Extensions",               priceFrom: null, duration_minutes: 60 },
    { id: "corrective-color",       name: "Corrective Color",              priceFrom: null, duration_minutes: 60 },
    { id: "consulta",               name: "Consultation",                  priceFrom: null, duration_minutes: 60 }
  ];

  /* ---------------------------------------------------------
     Stylists — TEMPORARY placeholder names.
     Replace `name` (and set placeholder:false) once real staff
     are confirmed. `service_ids: null` means "offers every service";
     set an array of service ids to restrict a stylist to specific
     services once that's needed.
  --------------------------------------------------------- */
  var stylists = [
    { id: "any",       name: "Any available stylist", placeholder: false, isAny: true, service_ids: null },
    { id: "stylist-1", name: "Sofía Martínez",  placeholder: true, isAny: false, service_ids: null },
    { id: "stylist-2", name: "Isabella Reyes",  placeholder: true, isAny: false, service_ids: null },
    { id: "stylist-3", name: "Camila Torres",   placeholder: true, isAny: false, service_ids: null },
    { id: "stylist-4", name: "Valentina Cruz",  placeholder: true, isAny: false, service_ids: null }
  ];

  /* ---------------------------------------------------------
     Business hours — minutes from midnight. `closed:true` for
     days with no service. Sunday = 0 ... Saturday = 6 (JS Date#getDay).
  --------------------------------------------------------- */
  var businessHours = {
    0: { closed: true },                    // Sunday
    1: { closed: true },                    // Monday
    2: { open: 10 * 60, close: 18 * 60 },   // Tuesday    10:00–18:00
    3: { open: 10 * 60, close: 18 * 60 },   // Wednesday  10:00–18:00
    4: { open: 10 * 60, close: 18 * 60 },   // Thursday   10:00–18:00
    5: { open: 10 * 60, close: 18 * 60 },   // Friday     10:00–18:00
    6: { open: 10 * 60, close: 17 * 60 }    // Saturday   10:00–17:00
  };

  var SLOT_STEP_MINUTES = 60;

  var salon = {
    name: "Sahyly Salon & Boutique",
    address1: "3604 Fairmont Pkwy, Suite A-2",
    address2: "Pasadena, TX 77504",
    phone: "713-505-4551",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=3604+Fairmont+Pkwy+Suite+A-2+Pasadena+TX+77504"
  };

  function serviceById(id) {
    for (var i = 0; i < services.length; i++) if (services[i].id === id) return services[i];
    return null;
  }
  function stylistById(id) {
    for (var i = 0; i < stylists.length; i++) if (stylists[i].id === id) return stylists[i];
    return null;
  }
  function realStylists() {
    return stylists.filter(function (s) { return !s.isAny; });
  }
  function stylistOffersService(stylist, serviceId) {
    return stylist.service_ids === null || stylist.service_ids.indexOf(serviceId) !== -1;
  }
  function formatPrice(priceFrom) {
    return priceFrom == null ? "Contact for pricing" : "From $" + priceFrom;
  }

  var api = {
    services: services,
    stylists: stylists,
    businessHours: businessHours,
    SLOT_STEP_MINUTES: SLOT_STEP_MINUTES,
    salon: salon,
    serviceById: serviceById,
    stylistById: stylistById,
    realStylists: realStylists,
    stylistOffersService: stylistOffersService,
    formatPrice: formatPrice
  };

  global.SahylyBookingData = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
