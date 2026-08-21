/* ==========================================================
   Sahyly — Booking system: drawer UI controller
   Talks only to SahylyBookingData (config) and SahylyBookingStore
   (persistence/availability). Renders each step's markup into
   #apptStepContent and re-binds interactions after every render.
   ========================================================== */
(function () {
  "use strict";

  var DATA = window.SahylyBookingData;
  var STORE = window.SahylyBookingStore;

  var MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var DOW_LONG_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  var STEP_LABELS = ["Service", "Stylist", "Date", "Details", "Confirm"];

  // Maps the legacy 6-category buttons already on the page (Services
  // section) to a sensible default in the new detailed service list.
  // "Haircuts" is intentionally left unmapped (3 possible matches).
  var LEGACY_SERVICE_MAP = {
    Color: "color-one-process",
    Highlights: "iluminaciones-completas",
    Balayage: "balayage-completo",
    Keratin: "keratina",
    Extensions: "hair-extensions"
  };

  var drawer = document.getElementById("apptDrawer");
  var backdrop = document.getElementById("apptBackdrop");
  var closeBtn = document.getElementById("apptClose");
  var progressEl = document.getElementById("apptProgress");
  var contentEl = document.getElementById("apptStepContent");
  var viewportEl = document.querySelector(".appt-step-viewport");

  var todayMidnight = (function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; })();

  function freshState() {
    return {
      step: 1,
      service: null,
      stylist: null,
      calendarMonth: new Date(todayMidnight.getFullYear(), todayMidnight.getMonth(), 1),
      date: null,
      time: null,
      availableStylistIdsForSlot: [],
      customer: { firstName: "", lastName: "", phone: "", email: "", notes: "", recipientName: "" },
      bookingForOther: false,
      submitting: false,
      lastBooking: null,
      clientRequestId: null
    };
  }
  var state = freshState();

  /* ---------------------------------------------------------
     helpers
  --------------------------------------------------------- */
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function minutesToLabel(min) {
    var h = Math.floor(min / 60), m = min % 60;
    var period = h >= 12 ? "PM" : "AM";
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + (m ? ":" + String(m).padStart(2, "0") : ":00") + " " + period;
  }
  function formatDateLong(d) {
    return DOW_LONG_EN[d.getDay()] + ", " + MONTHS_EN[d.getMonth()] + " " + d.getDate();
  }
  function initials(name) {
    var parts = name.trim().split(/\s+/);
    return ((parts[0] || "")[0] || "") + ((parts[1] || "")[0] || "");
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function genRequestId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "req_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ---------------------------------------------------------
     progress indicator
  --------------------------------------------------------- */
  function renderProgress() {
    if (state.step > 5) { progressEl.hidden = true; return; }
    progressEl.hidden = false;
    var html = "";
    for (var i = 1; i <= 5; i++) {
      var cls = i === state.step ? "is-active" : i < state.step ? "is-done" : "";
      html += '<li class="' + cls + '"' + (i < state.step ? ' data-action="jump" data-step="' + i + '"' : "") + '>' +
        '<span class="appt-progress-dot"></span>' + STEP_LABELS[i - 1] + "</li>";
    }
    progressEl.innerHTML = html;
  }

  /* ---------------------------------------------------------
     step renderers
  --------------------------------------------------------- */
  function renderStep1() {
    var rows = DATA.services.map(function (s) {
      var selected = state.service && state.service.id === s.id;
      return '<button type="button" class="bk-service-row' + (selected ? " is-selected" : "") + '" data-service-id="' + s.id + '">' +
        '<span class="bk-service-name">' + escapeHtml(s.name) + "</span>" +
        '<span class="bk-service-price">' + DATA.formatPrice(s.priceFrom) + "</span>" +
        "</button>";
    }).join("");
    return '<div class="bk-step-body">' +
      '<h4 class="bk-step-title">Which service would you like?</h4>' +
      '<div class="bk-service-list">' + rows + "</div>" +
      "</div>";
  }

  function renderStep2() {
    var any = DATA.stylistById("any");
    var anyCard = '<button type="button" class="bk-stylist-card bk-stylist-any' + (state.stylist && state.stylist.id === "any" ? " is-selected" : "") + '" data-stylist-id="any">' +
      '<span class="bk-stylist-avatar bk-stylist-avatar-any" aria-hidden="true">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c.6-3 3-5 6-5s5.4 2 6 5M14 14c2.8 0 5.2 2 5.8 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '<span class="bk-stylist-info">' +
      '<span class="bk-stylist-name">⭐ ' + escapeHtml(any.name) + "</span>" +
      '<span class="bk-stylist-sub">More available time slots. We\'ll assign the first available stylist for your selected time.</span>' +
      "</span>" +
      '<span class="bk-stylist-arrow" aria-hidden="true">&rarr;</span>' +
      "</button>";

    var cards = DATA.realStylists().map(function (s) {
      var selected = state.stylist && state.stylist.id === s.id;
      return '<button type="button" class="bk-stylist-card' + (selected ? " is-selected" : "") + '" data-stylist-id="' + s.id + '">' +
        '<span class="bk-stylist-avatar">' + initials(s.name) + "</span>" +
        '<span class="bk-stylist-info">' +
        '<span class="bk-stylist-name">' + escapeHtml(s.name) + "</span>" +
        '<span class="bk-stylist-sub">Select &rarr;</span>' +
        "</span>" +
        "</button>";
    }).join("");

    return '<div class="bk-step-body">' +
      '<button type="button" class="bk-back" data-action="back">&larr; Back</button>' +
      '<h4 class="bk-step-title">Who would you like your appointment with?</h4>' +
      '<div class="bk-stylist-list">' + anyCard + cards + "</div>" +
      "</div>";
  }

  function renderCalendar() {
    var m = state.calendarMonth;
    var firstOfMonth = new Date(m.getFullYear(), m.getMonth(), 1);
    var startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
    var daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var isCurrentMonth = m.getFullYear() === todayMidnight.getFullYear() && m.getMonth() === todayMidnight.getMonth();

    var maxMonth = new Date(todayMidnight.getFullYear(), todayMidnight.getMonth() + 3, 1);
    var atMaxMonth = m.getFullYear() === maxMonth.getFullYear() && m.getMonth() === maxMonth.getMonth();

    var cells = "";
    for (var i = 0; i < startOffset; i++) cells += '<span class="bk-cal-day is-empty"></span>';
    for (var day = 1; day <= daysInMonth; day++) {
      var d = new Date(m.getFullYear(), m.getMonth(), day);
      var hours = DATA.businessHours[d.getDay()];
      var isPast = d < todayMidnight;
      var isClosed = !hours || hours.closed;
      var disabled = isPast || isClosed;
      var selected = state.date && isoDate(state.date) === isoDate(d);
      cells += '<button type="button" class="bk-cal-day' + (disabled ? " is-disabled" : "") + (selected ? " is-selected" : "") +
        '"' + (disabled ? " disabled" : ' data-date="' + isoDate(d) + '"') + ">" + day + "</button>";
    }

    return '<div class="bk-calendar">' +
      '<div class="bk-calendar-head">' +
      '<button type="button" class="bk-cal-nav" data-action="prev-month"' + (isCurrentMonth ? " disabled" : "") + ' aria-label="Previous month">&lsaquo;</button>' +
      '<span class="bk-cal-month">' + MONTHS_EN[m.getMonth()] + " " + m.getFullYear() + "</span>" +
      '<button type="button" class="bk-cal-nav" data-action="next-month"' + (atMaxMonth ? " disabled" : "") + ' aria-label="Next month">&rsaquo;</button>' +
      "</div>" +
      '<div class="bk-calendar-weekdays"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>' +
      '<div class="bk-calendar-grid">' + cells + "</div>" +
      "</div>";
  }

  function timeGroupHtml(label, list) {
    if (!list.length) return "";
    var btns = list.map(function (s) {
      var selected = state.time === s.start;
      return '<button type="button" class="bk-time-slot' + (selected ? " is-selected" : "") + '" data-time="' + s.start + '">' + minutesToLabel(s.start) + "</button>";
    }).join("");
    return '<p class="bk-time-group-label">' + label + '</p><div class="bk-time-grid">' + btns + "</div>";
  }

  function timeSectionHtml(bodyHtml) {
    return '<div class="bk-time-section" id="bkTimeSection">' +
      '<h5 class="bk-time-heading">Available times &mdash; ' + formatDateLong(state.date) + "</h5>" +
      bodyHtml +
      "</div>";
  }

  // Rendered synchronously (server round-trip can't happen inline in a
  // render function); refreshTimeSection() below fills in the real,
  // backend-computed slots right after this paints.
  function renderTimeSection() {
    if (!state.date) return '<div class="bk-time-section" id="bkTimeSection" hidden></div>';
    return timeSectionHtml('<p class="bk-empty-note">Loading available times...</p>');
  }

  var timeSectionRequestToken = 0;
  function refreshTimeSection() {
    var container = document.getElementById("bkTimeSection");
    if (!container || !state.date) return;
    var dateStr = isoDate(state.date);
    var stylistParam = state.stylist.isAny ? "any" : state.stylist.id;
    var thisToken = ++timeSectionRequestToken;

    STORE.fetchSlotsForDate(state.service.id, stylistParam, dateStr).then(function (slots) {
      if (thisToken !== timeSectionRequestToken) return; // superseded by a newer date click
      var current = document.getElementById("bkTimeSection");
      if (!current) return;
      var morning = slots.filter(function (s) { return s.start < 12 * 60; });
      var afternoon = slots.filter(function (s) { return s.start >= 12 * 60; });
      var body = slots.length
        ? timeGroupHtml("MORNING", morning) + timeGroupHtml("AFTERNOON", afternoon)
        : '<p class="bk-empty-note">No available times for this date. Try another date or stylist.</p>';
      current.outerHTML = timeSectionHtml(body);
    }).catch(function () {
      if (thisToken !== timeSectionRequestToken) return;
      var current = document.getElementById("bkTimeSection");
      if (current) current.outerHTML = timeSectionHtml('<p class="bk-empty-note">We couldn\'t load available times. Please try again.</p>');
    });
  }

  function renderStep3() {
    return '<div class="bk-step-body">' +
      '<button type="button" class="bk-back" data-action="back">&larr; Back</button>' +
      '<h4 class="bk-step-title">Select a date</h4>' +
      renderCalendar() +
      renderTimeSection() +
      "</div>";
  }

  function renderStep4() {
    var c = state.customer;
    return '<div class="bk-step-body">' +
      '<button type="button" class="bk-back" data-action="back">&larr; Back</button>' +
      '<h4 class="bk-step-title">Your details</h4>' +
      '<p class="bk-recap">' + escapeHtml(state.service.name) + " &middot; " + formatDateLong(state.date) + " &middot; " + minutesToLabel(state.time) + "</p>" +
      '<form id="bkCustomerForm" class="bk-form" novalidate>' +
      '<div class="bk-form-row">' +
      '<label>First Name *<input type="text" name="firstName" required value="' + escapeHtml(c.firstName) + '"></label>' +
      '<label>Last Name *<input type="text" name="lastName" required value="' + escapeHtml(c.lastName) + '"></label>' +
      "</div>" +
      '<label>Phone *<input type="tel" name="phone" id="bkPhoneInput" required placeholder="(713) 555-1234" value="' + escapeHtml(c.phone) + '"></label>' +
      '<label>Email *<input type="email" name="email" required value="' + escapeHtml(c.email) + '"></label>' +

      '<label class="bk-switch-row">' +
      '<input type="checkbox" id="bkForOther"' + (state.bookingForOther ? " checked" : "") + '>' +
      '<span class="bk-switch-track"><span class="bk-switch-thumb"></span></span>' +
      '<span class="bk-switch-label">I\'m booking for someone else</span>' +
      "</label>" +

      '<label class="bk-recipient-field"' + (state.bookingForOther ? "" : " hidden") + ' id="bkRecipientField">' +
      "Name of the person receiving the service" +
      '<input type="text" name="recipientName" value="' + escapeHtml(c.recipientName) + '"></label>' +

      '<label>Notes (optional)<textarea name="notes" rows="3">' + escapeHtml(c.notes) + "</textarea></label>" +

      '<button type="submit" class="btn btn-primary btn-block">Continue</button>' +
      "</form>" +
      "</div>";
  }

  function summaryRows(isSuccess) {
    var priceLabel = DATA.formatPrice(state.service.priceFrom);
    var stylistLabel = state.stylist.isAny
      ? (isSuccess ? DATA.stylistById(state.lastBooking.stylist_id).name : "First available stylist")
      : state.stylist.name;

    function row(label, value, changeStep) {
      return '<div class="bk-summary-row">' +
        '<div><span class="bk-summary-label">' + label + '</span><span class="bk-summary-value">' + value + "</span></div>" +
        (changeStep && !isSuccess ? '<button type="button" class="bk-change-link" data-action="jump" data-step="' + changeStep + '">Change</button>' : "") +
        "</div>";
    }

    var html = row("Service", escapeHtml(state.service.name), 1) +
      row("Stylist", escapeHtml(stylistLabel), 2) +
      row("Price", priceLabel, null) +
      row("Date", formatDateLong(state.date), 3) +
      row("Time", minutesToLabel(state.time), 3) +
      row("Location", DATA.salon.address1 + "<br>" + DATA.salon.address2, null);

    if (state.bookingForOther && state.customer.recipientName) {
      html += row("Booking for", escapeHtml(state.customer.recipientName), 4);
    }
    if (isSuccess) {
      html += row("Salon phone", DATA.salon.phone, null);
    }
    return html;
  }

  function renderStep5() {
    return '<div class="bk-step-body">' +
      '<button type="button" class="bk-back" data-action="back">&larr; Back</button>' +
      '<h4 class="bk-step-title">Confirm your appointment</h4>' +
      '<div class="bk-summary-card">' + summaryRows(false) + "</div>" +
      '<div class="bk-error-banner" id="bkErrorBanner" hidden></div>' +
      '<button type="button" class="btn btn-primary btn-block bk-confirm-btn" id="bkConfirmBtn">' +
      '<span class="bk-confirm-label">Confirm Appointment</span>' +
      '<span class="bk-spinner" hidden></span>' +
      "</button>" +
      "</div>";
  }

  function googleCalendarUrl(booking) {
    var start = new Date(booking.appointment_date + "T00:00:00");
    start.setMinutes(booking.start_time);
    var end = new Date(booking.appointment_date + "T00:00:00");
    end.setMinutes(booking.end_time);
    function fmt(d) {
      return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") +
        "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00";
    }
    var params = new URLSearchParams({
      action: "TEMPLATE",
      text: booking.service_name_snapshot + " — Sahyly Salon & Boutique",
      dates: fmt(start) + "/" + fmt(end),
      details: "Booking " + booking.booking_code + " at Sahyly Salon & Boutique.",
      location: DATA.salon.address1 + ", " + DATA.salon.address2
    });
    return "https://calendar.google.com/calendar/render?" + params.toString();
  }

  function renderStep6() {
    var b = state.lastBooking;
    return '<div class="bk-step-body bk-success">' +
      '<div class="bk-success-check" aria-hidden="true">&#10003;</div>' +
      '<h4 class="bk-step-title">Your appointment has been booked!</h4>' +
      '<div class="bk-success-code"><span class="bk-summary-label">Booking code</span><span class="bk-code">' + b.booking_code + "</span></div>" +
      '<div class="bk-summary-card">' + summaryRows(true) + "</div>" +
      '<div class="bk-success-actions">' +
      '<a class="btn btn-outline-dark" href="' + googleCalendarUrl(b) + '" target="_blank" rel="noopener">Add to Calendar</a>' +
      '<a class="btn btn-outline-dark" href="' + DATA.salon.directionsUrl + '" target="_blank" rel="noopener">Get Directions</a>' +
      '<button type="button" class="btn btn-primary" data-action="close-and-reset">Close</button>' +
      "</div></div>";
  }

  var STEP_RENDERERS = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4, 5: renderStep5, 6: renderStep6 };

  /* ---------------------------------------------------------
     step transition + main render
  --------------------------------------------------------- */
  // Inline-style-driven fade + slight horizontal slide between steps.
  // Using inline styles (rather than CSS classes) avoids the timing trap
  // of coordinating a "leave" transition and an "enter" transition through
  // a single class list — here each phase is explicit and sequential.
  function paintStep(direction) {
    renderProgress();
    var outX = direction === "back" ? 12 : -12;
    var inX = direction === "back" ? -12 : 12;

    contentEl.style.transition = "opacity .16s ease, transform .16s ease";
    contentEl.style.opacity = "0";
    contentEl.style.transform = "translateX(" + outX + "px)";

    setTimeout(function () {
      contentEl.innerHTML = STEP_RENDERERS[state.step]();
      viewportEl.scrollTop = 0;
      if (state.step === 3 && state.date) refreshTimeSection();

      contentEl.style.transition = "none";
      contentEl.style.transform = "translateX(" + inX + "px)";
      contentEl.style.opacity = "0";

      void contentEl.offsetWidth; // force reflow before re-enabling the transition

      contentEl.style.transition = "opacity .26s ease, transform .26s ease";
      contentEl.style.opacity = "1";
      contentEl.style.transform = "translateX(0)";
    }, 160);
  }

  function goToStep(n, direction) {
    var dir = direction || (n < state.step ? "back" : "fwd");
    state.step = n;
    paintStep(dir);
  }

  /* ---------------------------------------------------------
     open / close
  --------------------------------------------------------- */
  function openDrawer(legacyServiceHint) {
    if (state.step === 1 && !state.service && legacyServiceHint && LEGACY_SERVICE_MAP[legacyServiceHint]) {
      var mapped = DATA.serviceById(LEGACY_SERVICE_MAP[legacyServiceHint]);
      if (mapped) { state.service = mapped; state.step = 2; }
    }
    drawer.classList.add("is-open");
    backdrop.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    renderProgress();
    contentEl.innerHTML = STEP_RENDERERS[state.step]();
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    backdrop.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (state.step === 6) { state = freshState(); }
  }

  /* ---------------------------------------------------------
     confirm + persistence
  --------------------------------------------------------- */
  function showError(msg) {
    var el = document.getElementById("bkErrorBanner");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }
  function setConfirmLoading(loading) {
    var btn = document.getElementById("bkConfirmBtn");
    if (!btn) return;
    btn.disabled = loading;
    btn.querySelector(".bk-confirm-label").textContent = loading ? "Booking your appointment..." : "Confirm Appointment";
    btn.querySelector(".bk-spinner").hidden = !loading;
  }

  async function confirmBooking() {
    if (state.submitting) return; // guards against double-click / double-submit
    state.submitting = true;
    setConfirmLoading(true);

    if (!state.clientRequestId) state.clientRequestId = genRequestId();

    var payload = {
      client_request_id: state.clientRequestId,
      service_id: state.service.id,
      stylist_id: state.stylist.isAny ? "any" : state.stylist.id,
      appointment_date: isoDate(state.date),
      start_time: state.time,
      customer_first_name: state.customer.firstName,
      customer_last_name: state.customer.lastName,
      phone: state.customer.phone,
      email: state.customer.email,
      booking_for_someone_else: state.bookingForOther,
      recipient_name: state.bookingForOther ? state.customer.recipientName : null,
      notes: state.customer.notes || ""
    };

    var result = await STORE.submitBooking(payload);

    state.submitting = false;
    setConfirmLoading(false);

    if (result.ok) {
      state.lastBooking = result.booking;
      return goToStep(6, "fwd");
    }

    if (result.status === 409) return handleSlotGone(result.message);
    showError(result.message || "We couldn't book your appointment. Please try again.");
  }

  function handleSlotGone(message) {
    showError(message || "That time slot was just booked. Please select another one.");
    state.time = null;
    setTimeout(function () { goToStep(3, "back"); }, 1500);
  }

  /* ---------------------------------------------------------
     event wiring (delegated on the step container + progress)
  --------------------------------------------------------- */
  document.querySelectorAll(".js-open-appt").forEach(function (btn) {
    btn.addEventListener("click", function () { openDrawer(btn.getAttribute("data-service")); });
  });
  closeBtn.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer.classList.contains("is-open")) closeDrawer(); });

  progressEl.addEventListener("click", function (e) {
    var li = e.target.closest("[data-action='jump']");
    if (!li) return;
    goToStep(parseInt(li.getAttribute("data-step"), 10), "back");
  });

  contentEl.addEventListener("click", function (e) {
    var el = e.target;

    var back = el.closest("[data-action='back']");
    if (back) return goToStep(Math.max(1, state.step - 1), "back");

    var jump = el.closest("[data-action='jump']");
    if (jump) return goToStep(parseInt(jump.getAttribute("data-step"), 10), "back");

    var svcRow = el.closest("[data-service-id]");
    if (svcRow) {
      state.service = DATA.serviceById(svcRow.getAttribute("data-service-id"));
      state.date = null; state.time = null;
      return goToStep(2, "fwd");
    }

    var stylistCard = el.closest("[data-stylist-id]");
    if (stylistCard) {
      state.stylist = DATA.stylistById(stylistCard.getAttribute("data-stylist-id"));
      state.time = null;
      return goToStep(3, "fwd");
    }

    var prevMonth = el.closest("[data-action='prev-month']");
    if (prevMonth && !prevMonth.disabled) {
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
      return paintStep("back");
    }
    var nextMonth = el.closest("[data-action='next-month']");
    if (nextMonth && !nextMonth.disabled) {
      state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
      return paintStep("fwd");
    }

    var dayBtn = el.closest(".bk-cal-day[data-date]");
    if (dayBtn) {
      var parts = dayBtn.getAttribute("data-date").split("-").map(Number);
      state.date = new Date(parts[0], parts[1] - 1, parts[2]);
      state.time = null;
      return paintStep("fwd");
    }

    var timeBtn = el.closest(".bk-time-slot");
    if (timeBtn) {
      state.time = parseInt(timeBtn.getAttribute("data-time"), 10);
      return goToStep(4, "fwd");
    }

    var confirmBtn = el.closest("#bkConfirmBtn");
    if (confirmBtn) return confirmBooking();

    var closeAndReset = el.closest("[data-action='close-and-reset']");
    if (closeAndReset) { closeDrawer(); return; }
  });

  contentEl.addEventListener("change", function (e) {
    if (e.target.id === "bkForOther") {
      state.bookingForOther = e.target.checked;
      var field = document.getElementById("bkRecipientField");
      if (field) field.hidden = !state.bookingForOther;
    }
  });

  contentEl.addEventListener("input", function (e) {
    if (e.target.id === "bkPhoneInput") {
      var digits = e.target.value.replace(/\D/g, "").slice(0, 10);
      var out = digits;
      if (digits.length > 6) out = "(" + digits.slice(0, 3) + ") " + digits.slice(3, 6) + "-" + digits.slice(6);
      else if (digits.length > 3) out = "(" + digits.slice(0, 3) + ") " + digits.slice(3);
      else if (digits.length > 0) out = "(" + digits;
      e.target.value = out;
    }
  });

  contentEl.addEventListener("submit", function (e) {
    if (e.target.id !== "bkCustomerForm") return;
    e.preventDefault();
    var f = e.target;
    var phoneDigits = f.phone.value.replace(/\D/g, "");
    if (phoneDigits.length < 10) { f.phone.setCustomValidity("Enter a valid 10-digit phone number."); f.reportValidity(); return; }
    f.phone.setCustomValidity("");
    if (!f.checkValidity()) { f.reportValidity(); return; }

    state.customer.firstName = f.firstName.value.trim();
    state.customer.lastName = f.lastName.value.trim();
    state.customer.phone = f.phone.value.trim();
    state.customer.email = f.email.value.trim();
    state.customer.notes = f.notes.value.trim();
    state.customer.recipientName = state.bookingForOther ? (f.recipientName.value || "").trim() : "";

    goToStep(5, "fwd");
  });
})();
