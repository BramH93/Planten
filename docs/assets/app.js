/* ============================================================
   APP STATE
   Persisted to localStorage so the user's edits (new plants,
   rooms, watering log) survive between visits.
   ============================================================ */

const STORAGE_KEY = "plantcare_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("Could not parse saved state, starting fresh.", e); }

  // First run: seed with the user's real rooms + plants
  const todayISO = new Date().toISOString().slice(0, 10);
  return {
    rooms: DEFAULT_ROOMS.map(r => ({ ...r })),
    plants: DEFAULT_PLANTS.map(p => ({
      ...p,
      lastWatered: todayISO,
      lastFed: todayISO
    }))
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let weatherData = null;

/* ============================================================
   RENDER: WEATHER STRIP
   ============================================================ */

async function renderWeather() {
  const el = document.getElementById("weather-strip");
  el.innerHTML = `<div class="wx-loading">Checking the sky over Utrecht…</div>`;

  try {
    weatherData = await fetchUtrechtWeather();
    const cur = weatherData.current;
    const [label, icon] = describeWeatherCode(cur.weathercode);
    const f = summarizeForecast(weatherData, 4);

    el.innerHTML = `
      <div class="wx-now">
        <span class="wx-icon">${icon}</span>
        <span class="wx-temp">${Math.round(cur.temperature_2m)}°C</span>
      </div>
      <div class="wx-place">${label} · Utrecht</div>
      <div class="wx-detail">
        <strong>${f.rainNext.toFixed(1)}mm</strong> rain expected in the next 4 days
        ${f.hotDays > 0 ? ` · <strong>${f.hotDays} hot day${f.hotDays > 1 ? "s" : ""}</strong> (25°C+) ahead` : ""}
        ${f.recentRain >= 5 ? ` · <strong>${f.recentRain.toFixed(0)}mm</strong> fell in the last 2 days` : ""}
      </div>
    `;
  } catch (err) {
    console.error(err);
    el.innerHTML = `<div class="wx-error">Couldn't reach the weather service — schedules below use general seasonal defaults instead. (${err.message})</div>`;
  }
  renderRooms(); // re-render now that weather-dependent schedules can be computed
}

/* ============================================================
   DROPLET ICON
   Fill level communicates urgency at a glance — the signature
   visual element of this app.
   ============================================================ */

function dropletSVG(urgency) {
  const fillByUrgency = { ok: 0.25, soon: 0.55, due: 0.85, overdue: 1, dormant: 0.1 };
  const colorByUrgency = {
    ok: "var(--sage)", soon: "#C99A3E", due: "var(--terracotta)",
    overdue: "var(--rust)", dormant: "var(--moss)"
  };
  const fill = fillByUrgency[urgency] ?? 0.3;
  const color = colorByUrgency[urgency] ?? "var(--sage)";

  return `
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2 C16 2 5 16 5 22.5 C5 28.5 10 31 16 31 C22 31 27 28.5 27 22.5 C27 16 16 2 16 2 Z"
            fill="none" stroke="${color}" stroke-width="1.6" opacity="0.45"/>
      <path d="M16 2 C16 2 5 16 5 22.5 C5 28.5 10 31 16 31 C22 31 27 28.5 27 22.5 C27 16 16 2 16 2 Z"
            fill="${color}" opacity="0.9"
            style="clip-path: polygon(0% ${100 - fill*100}%, 100% ${100 - fill*100}%, 100% 100%, 0% 100%);"/>
    </svg>
  `;
}

/* ============================================================
   RENDER: ROOMS + PLANTS
   ============================================================ */

function urgencyLabel(urgency, daysUntil) {
  if (urgency === "dormant") return "Resting";
  if (urgency === "overdue")
