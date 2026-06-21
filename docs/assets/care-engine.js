/* ============================================================
   WEATHER ENGINE
   Pulls live forecast for Utrecht from Open-Meteo (free, no
   API key required, CORS-enabled — safe to call directly from
   a static GitHub Pages site).
   ============================================================ */

const UTRECHT = { lat: 52.0907, lon: 5.1214, tz: "Europe/Amsterdam" };

const WEATHER_CACHE_KEY = "plantcare_weather_cache_v1";
const WEATHER_CACHE_TTL_MS = 1000 * 60 * 60 * 3; // refresh every 3 hours

async function fetchUtrechtWeather() {
  // Try cache first to avoid hammering the API on every page load
  try {
    const cached = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || "null");
    if (cached && (Date.now() - cached.fetchedAt) < WEATHER_CACHE_TTL_MS) {
      return cached.data;
    }
  } catch (e) { /* corrupt cache, ignore */ }

  const params = new URLSearchParams({
    latitude: UTRECHT.lat,
    longitude: UTRECHT.lon,
    timezone: UTRECHT.tz,
    forecast_days: 10,
    past_days: 3,
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "et0_fao_evapotranspiration",
      "weathercode"
    ].join(","),
    current: [
      "temperature_2m",
      "precipitation",
      "weathercode",
      "is_day"
    ].join(",")
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();

  localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data }));
  return data;
}

/* Weather code -> short label + emoji (WMO codes, per Open-Meteo docs) */
function describeWeatherCode(code) {
  const map = {
    0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
    45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Dense drizzle", "🌧️"],
    61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
    71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
    80: ["Light showers", "🌦️"], 81: ["Showers", "🌧️"], 82: ["Violent showers", "⛈️"],
    95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm + hail", "⛈️"], 99: ["Thunderstorm + hail", "⛈️"]
  };
  return map[code] || ["Unknown", "🌡️"];
}

/* ============================================================
   CARE SCHEDULE ENGINE
   Combines a plant's species baseline with room context
   (indoor/outdoor, orientation) and the live weather forecast
   to produce: next water date, next feed date, and a
   human-readable reason.
   ============================================================ */

function getRoomSunMultiplier(room) {
  // South-facing / SW-facing spots dry out faster; north-facing slower.
  const o = ORIENTATIONS[room.orientation];
  if (!o) return 1;
  if (o.sunHours === "high") return 1.15;
  if (o.sunHours === "med-high") return 1.05;
  if (o.sunHours === "medium") return 1;
  if (o.sunHours === "low-med") return 0.9;
  if (o.sunHours === "low") return 0.8;
  return 1;
}

function isDormant(species, date) {
  if (!species.dormantMonths) return false;
  return species.dormantMonths.includes(date.getMonth());
}

/**
 * Calculates upcoming rain total (mm) over the next N days for outdoor plants,
 * and recent heat stress (consecutive hot/dry days) to speed up watering.
 */
function summarizeForecast(weather, daysAhead = 4) {
  const daily = weather.daily;
  const todayIdx = daily.time.findIndex(t => t === new Date().toISOString().slice(0, 10));
  const startIdx = todayIdx >= 0 ? todayIdx : 0;

  let rainNext = 0;
  let hotDays = 0;
  let highEvapotranspiration = 0;

  for (let i = startIdx; i < Math.min(startIdx + daysAhead, daily.time.length); i++) {
    rainNext += daily.precipitation_sum[i] || 0;
    if ((daily.temperature_2m_max[i] || 0) >= 25) hotDays++;
    highEvapotranspiration += daily.et0_fao_evapotranspiration?.[i] || 0;
  }

  // Rain that already fell in the last 2 days (past_days=3 includes yesterday/today)
  let recentRain = 0;
  for (let i = Math.max(0, startIdx - 2); i < startIdx; i++) {
    recentRain += daily.precipitation_sum[i] || 0;
  }

  return { rainNext, hotDays, highEvapotranspiration, recentRain, startIdx };
}

/**
 * Returns { nextWaterDate, intervalDays, reason, urgency }
 * urgency: "ok" | "soon" | "due" | "overdue"
 */
function calculateWaterSchedule(plant, species, room, lastWateredISO, weather) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastWatered = lastWateredISO ? new Date(lastWateredISO) : today;

  let intervalDays = species.baseWaterDays;
  let reasons = [];

  // Dormancy slows everything down regardless of location
  if (isDormant(species, today)) {
    intervalDays = Math.round(intervalDays * 1.6);
    reasons.push("dormant season — watering less often");
  }

  // Indoor plants: only weather-adjusted by general heat (central heating dries air in winter)
  if (room.indoor) {
    const sunMult = getRoomSunMultiplier(room);
    intervalDays = Math.round(intervalDays / sunMult);
    if (today.getMonth() === 11 || today.getMonth() === 0 || today.getMonth() === 1) {
      intervalDays = Math.max(2, intervalDays - 1);
      reasons.push("indoor heating dries soil faster in winter");
    }
  } else {
    // Outdoor: factor in rain forecast + heat
    if (weather) {
      const f = summarizeForecast(weather, 4);
      const sunMult = getRoomSunMultiplier(room);
      intervalDays = Math.round(intervalDays / sunMult);

      if (f.recentRain >= 5) {
        intervalDays += 2;
        reasons.push(`${f.recentRain.toFixed(0)}mm of rain fell recently`);
      }
      if (f.rainNext >= 8 && species.droughtTolerance !== "low") {
        intervalDays += 1;
        reasons.push(`rain expected (${f.rainNext.toFixed(0)}mm over next few days)`);
      }
      if (f.hotDays >= 2) {
        intervalDays = Math.max(1, intervalDays - 1);
        reasons.push(`${f.hotDays} hot day(s) (25°C+) ahead`);
      }
      if (species.droughtTolerance === "low" && f.hotDays >= 1 && f.rainNext < 3) {
        intervalDays = Math.max(1, intervalDays - 1);
        reasons.push("low drought tolerance + dry heat ahead");
      }
    }
  }

  intervalDays = Math.max(1, intervalDays);

  const nextWaterDate = new Date(lastWatered);
  nextWaterDate.setDate(nextWaterDate.getDate() + intervalDays);

  const daysUntil = Math.round((nextWaterDate - today) / (1000 * 60 * 60 * 24));
  let urgency = "ok";
  if (daysUntil <= -1) urgency = "overdue";
  else if (daysUntil === 0) urgency = "due";
  else if (daysUntil <= 1) urgency = "soon";

  return {
    nextWaterDate,
    intervalDays,
    daysUntil,
    urgency,
    reasons
  };
}

function calculateFeedSchedule(species, lastFedISO) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastFed = lastFedISO ? new Date(lastFedISO) : today;

  if (species.feedSeasonOnly && isDormant(species, today)) {
    return { nextFeedDate: null, daysUntil: null, urgency: "dormant", paused: true };
  }

  const nextFeedDate = new Date(lastFed);
  nextFeedDate.setDate(nextFeedDate.getDate() + species.feedEveryDays);
  const daysUntil = Math.round((nextFeedDate - today) / (1000 * 60 * 60 * 24));

  let urgency = "ok";
  if (daysUntil <= -1) urgency = "overdue";
  else if (daysUntil === 0) urgency = "due";
  else if (daysUntil <= 2) urgency = "soon";

  return { nextFeedDate, daysUntil, urgency, paused: false };
}
