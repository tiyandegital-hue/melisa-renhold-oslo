/* Melisa Renholdsservice AS — site logic.
   ONE swappable business constant: every name/phone/email/address on the
   site comes from this object (HTML carries the same values statically). */
const BUSINESS = {
  name: "Melisa Renholdsservice AS",
  shortName: "Melisa Renholdsservice",
  phone: "450 21 429",
  phoneHref: "tel:+4745021429",
  email: "post@melisarenhold.no",
  address: "Københavngata 14A, 0566 Oslo",
  hours: "Man–fre 08:00–17:00",
  founded: 2008
};

/* Illustrative estimate model — VEILEDENDE only, never a fixed price.
   rate = veiledende kroner per m² (månedlig basis for faste avtaler).
   freqFactor scales the monthly basis by cleaning frequency.
   Range = centre × 0.85 … centre × 1.20, rounded to nearest 100 kr. */
const SERVICE_RATES = {
  daglig:        { name: "Daglig renhold",      rate: 22 },
  hoved:         { name: "Hovedrengjøring",     rate: 46 },
  bygg:          { name: "Byggvask",            rate: 38 },
  skuring:       { name: "Skuring og boning",   rate: 55 },
  flytte:        { name: "Flyttevask",          rate: 48 },
  vindus:        { name: "Vindusvask",          rate: 30 },
  fasade:        { name: "Fasadevask",          rate: 36 }
};
const FREQ_FACTORS = { daglig: 1.0, ukentlig: 0.5, manedlig: 0.22, engangs: 0.9 };
const FREQ_LABELS = { daglig: "Daglig", ukentlig: "Ukentlig", manedlig: "Månedlig", engangs: "Engangsoppdrag" };

function formatNOK(n) {
  return "kr " + Math.round(n).toLocaleString("nb-NO").replace(/,/g, "\u00a0");
}
function round100(n) { return Math.round(n / 100) * 100; }

function estimateRange(serviceId, area, freqId, toilets, kitchens) {
  const svc = SERVICE_RATES[serviceId];
  if (!svc || !area || area <= 0) return null;
  const freq = FREQ_FACTORS[freqId] ?? 1.0;
  let centre = area * svc.rate * freq;
  centre += (toilets || 0) * 120 + (kitchens || 0) * 200;
  return { low: round100(centre * 0.85), high: round100(centre * 1.2), centre: Math.round(centre) };
}

/* ---------- mobile nav ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));
  }

  /* ---------- reveal on scroll ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add("in"));
  }

  initTeaser();
  initCalculator();
  initContactForm();
});

/* ---------- Hjem: quote teaser ---------- */
function initTeaser() {
  const form = document.getElementById("teaserForm");
  if (!form) return;
  const serviceSel = document.getElementById("teaserService");
  const areaSlider = document.getElementById("teaserArea");
  const areaOut = document.getElementById("teaserAreaOut");
  const estOut = document.getElementById("teaserEstimate");
  if (!serviceSel || !areaSlider || !estOut) return;

  function update() {
    const area = parseInt(areaSlider.value, 10) || 0;
    if (areaOut) areaOut.textContent = area.toLocaleString("nb-NO") + " m²";
    const r = estimateRange(serviceSel.value, area, "daglig", 0, 0);
    estOut.textContent = r ? formatNOK(r.low) + " – " + formatNOK(r.high) : "—";
  }
  serviceSel.addEventListener("change", update);
  areaSlider.addEventListener("input", update);
  update();
}

/* ---------- Prisberegner: 3-step assistant ---------- */
function initCalculator() {
  const calc = document.getElementById("calculator");
  if (!calc) return;

  const state = {
    service: null,
    area: 250,
    freq: "ukentlig",
    toilets: 0,
    kitchens: 0,
    name: "", email: "", phone: "", callback: "Så fort som mulig"
  };

  const steps = Array.from(calc.querySelectorAll(".calc-step"));
  const progressFill = document.getElementById("progressFill");
  const stepCount = document.getElementById("stepCount");
  const stepperItems = Array.from(calc.querySelectorAll(".stepper span"));
  const calcError = document.getElementById("calcError");
  const stepLabel = document.getElementById("stepLabel");
  const stepTitles = { 1: "Trinn 01 · Velg tjeneste", 2: "Trinn 02 · Om bygget", 3: "Trinn 03 · Dine opplysninger" };
  const progressTrack = calc.querySelector(".progress-track");
  const resultPanel = document.getElementById("resultPanel");
  const successPanel = document.getElementById("successPanel");
  let current = 1;

  // Pre-select service from ?tjeneste=… (links from Tjenester page)
  const params = new URLSearchParams(window.location.search);
  const pre = params.get("tjeneste");
  if (pre && SERVICE_RATES[pre]) selectService(pre);

  function showError(msg) {
    if (!calcError) return;
    calcError.textContent = msg;
    calcError.hidden = false;
    calcError.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function clearError() { if (calcError) { calcError.hidden = true; calcError.textContent = ""; } }

  function goTo(n, scroll = true) {
    current = n;
    steps.forEach(s => s.classList.toggle("active", Number(s.dataset.step) === n));
    if (progressFill) progressFill.style.width = (n / 3 * 100) + "%";
    if (stepLabel) stepLabel.textContent = stepTitles[n] || stepTitles[1];
    if (progressTrack) progressTrack.setAttribute("aria-valuenow", String(n));
    if (stepCount) stepCount.textContent = "Steg " + n + " av 3";
    stepperItems.forEach((item, i) => {
      item.classList.toggle("active", i + 1 === n);
      item.classList.toggle("done", i + 1 < n);
    });
    clearError();
    if (scroll) calc.scrollIntoView({ behavior: "smooth", block: "start" });
    if (n === 3) renderResult();
  }

  function selectService(id) {
    state.service = id;
    calc.querySelectorAll(".service-pick").forEach(btn => {
      btn.setAttribute("aria-pressed", String(btn.dataset.service === id));
    });
  }

  calc.querySelectorAll(".service-pick").forEach(btn => {
    btn.addEventListener("click", () => { selectService(btn.dataset.service); clearError(); });
  });

  // Step 2 inputs
  const areaSlider = document.getElementById("calcArea");
  const areaNumber = document.getElementById("calcAreaNumber");
  const areaOut = document.getElementById("calcAreaOut");
  function setArea(v) {
    v = Math.max(30, Math.min(2500, Math.round(Number(v) || 0)));
    state.area = v;
    if (areaSlider) areaSlider.value = String(v);
    if (areaNumber) areaNumber.value = String(v);
    if (areaOut) areaOut.textContent = v.toLocaleString("nb-NO") + " m²";
  }
  if (areaSlider) areaSlider.addEventListener("input", () => setArea(areaSlider.value));
  // Number input: store the raw value without clamping, so out-of-range
  // entries are caught by the step-2 validation on "Neste steg" instead
  // of being silently corrected.
  if (areaNumber) areaNumber.addEventListener("change", () => {
    const v = Math.round(Number(areaNumber.value) || 0);
    state.area = v;
    if (areaOut) areaOut.textContent = v.toLocaleString("nb-NO") + " m²";
  });

  calc.querySelectorAll('input[name="freq"]').forEach(r => {
    r.addEventListener("change", () => { state.freq = r.value; });
  });
  const toiletsInput = document.getElementById("calcToilets");
  const kitchensInput = document.getElementById("calcKitchens");
  if (toiletsInput) toiletsInput.addEventListener("change", () => { state.toilets = Math.max(0, parseInt(toiletsInput.value, 10) || 0); });
  if (kitchensInput) kitchensInput.addEventListener("change", () => { state.kitchens = Math.max(0, parseInt(kitchensInput.value, 10) || 0); });

  // Step 3 inputs
  const nameInput = document.getElementById("calcName");
  const emailInput = document.getElementById("calcEmail");
  const phoneInput = document.getElementById("calcPhone");
  const callbackSel = document.getElementById("calcCallback");
  const callbackTimeWrap = document.getElementById("callbackTimeWrap");
  const callbackTimeInput = document.getElementById("calcCallbackTime");

  function setFieldInvalid(input, bad) {
    const field = input.closest(".field");
    if (field) field.classList.toggle("invalid", bad);
    return !bad;
  }
  if (callbackSel) callbackSel.addEventListener("change", () => {
    state.callback = callbackSel.value;
    if (callbackTimeWrap) callbackTimeWrap.hidden = callbackSel.value !== "Velg tidspunkt";
  });

  function renderResult() {
    if (!resultPanel) return;
    const r = estimateRange(state.service, state.area, state.freq, state.toilets, state.kitchens);
    const val = document.getElementById("resultValue");
    const basisService = document.getElementById("basisService");
    const basisArea = document.getElementById("basisArea");
    const basisFreq = document.getElementById("basisFreq");
    if (r && val) val.textContent = formatNOK(r.low) + " – " + formatNOK(r.high);
    if (basisService) basisService.textContent = state.service ? SERVICE_RATES[state.service].name : "—";
    if (basisArea) basisArea.textContent = state.area.toLocaleString("nb-NO") + " m²";
    if (basisFreq) basisFreq.textContent = FREQ_LABELS[state.freq] || "—";
    resultPanel.hidden = false;
  }

  // Navigation buttons
  calc.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = Number(btn.dataset.goto);
      if (target > current) {
        if (current === 1 && !state.service) { showError("Velg en tjeneste for å fortsette."); return; }
        if (current === 2) {
          const area = parseInt(areaNumber ? areaNumber.value : state.area, 10);
          if (!area || area < 30 || area > 2500) { showError("Areal må være mellom 30 og 2500 m²."); return; }
          setArea(area);
        }
      }
      goTo(target);
    });
  });

  // Secondary CTA: focus the callback-time selector
  const bookBtn = document.getElementById("bookCallbackBtn");
  if (bookBtn && callbackSel) {
    bookBtn.addEventListener("click", () => { callbackSel.focus(); callbackSel.scrollIntoView({ behavior: "smooth", block: "center" }); });
  }

  // Submit (primary CTA in the result panel)
  const form = document.getElementById("calcForm");
  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      clearError();
      let ok = true;
      state.name = nameInput ? nameInput.value.trim() : "";
      state.email = emailInput ? emailInput.value.trim() : "";
      state.phone = phoneInput ? phoneInput.value.trim() : "";
      if (nameInput) ok = setFieldInvalid(nameInput, state.name.length < 2) && ok;
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(state.email);
      if (emailInput) ok = setFieldInvalid(emailInput, !emailOk) && ok;
      const digits = state.phone.replace(/\D/g, "");
      if (phoneInput) ok = setFieldInvalid(phoneInput, digits.length < 8) && ok;
      if (callbackSel && callbackSel.value === "Velg tidspunkt" && callbackTimeInput) {
        ok = setFieldInvalid(callbackTimeInput, !callbackTimeInput.value) && ok;
      }
      if (!ok) { showError("Sjekk feltene som er markert, og prøv igjen."); return; }
      renderResult();
      form.hidden = true;
      if (successPanel) {
        successPanel.classList.add("show");
        successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }

  const againBtn = document.getElementById("calcAgain");
  if (againBtn) againBtn.addEventListener("click", () => {
    if (form) { form.hidden = false; form.reset(); }
    if (successPanel) successPanel.classList.remove("show");
    state.service = null;
    calc.querySelectorAll(".service-pick").forEach(b => b.setAttribute("aria-pressed", "false"));
    setArea(250);
    goTo(1);
  });

  goTo(1, false);
}

/* ---------- Kontakt: contact form ---------- */
function initContactForm() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const success = document.getElementById("contactSuccess");
  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    const required = [
      { el: document.getElementById("ctName"), test: v => v.trim().length >= 2, msg: "Skriv inn navnet ditt." },
      { el: document.getElementById("ctEmail"), test: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()), msg: "Skriv inn en gyldig e-postadresse." },
      { el: document.getElementById("ctPhone"), test: v => v.replace(/\D/g, "").length >= 8, msg: "Skriv inn et gyldig telefonnummer (minst 8 siffer)." },
      { el: document.getElementById("ctMessage"), test: v => v.trim().length >= 5, msg: "Fortell oss kort om ditt behov." }
    ];
    required.forEach(({ el, test }) => {
      if (!el) return;
      const bad = !test(el.value);
      const field = el.closest(".field");
      if (field) field.classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    const consent = document.getElementById("ctConsent");
    const consentError = document.getElementById("consentError");
    if (consent && !consent.checked) {
      ok = false;
      if (consentError) consentError.style.display = "block";
    } else if (consentError) {
      consentError.style.display = "none";
    }
    if (!ok) return;
    form.hidden = true;
    if (success) {
      success.classList.add("show");
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}
