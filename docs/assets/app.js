/* ============================================================
   PHOTO HANDLING
   Photos are compressed client-side (resized + re-encoded as
   JPEG) before being stored as a data URL in localStorage —
   keeps each photo small enough that 7+ plants with photos
   still fit comfortably under the localStorage size limit.
   ============================================================ */

const PHOTO_MAX_DIMENSION = 480; // px, longest side
const PHOTO_JPEG_QUALITY = 0.75;

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load that image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > PHOTO_MAX_DIMENSION) {
          height = Math.round(height * (PHOTO_MAX_DIMENSION / width));
          width = PHOTO_MAX_DIMENSION;
        } else if (height > PHOTO_MAX_DIMENSION) {
          width = Math.round(width * (PHOTO_MAX_DIMENSION / height));
          height = PHOTO_MAX_DIMENSION;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
  if (urgency === "overdue") return `${Math.abs(daysUntil)}d overdue`;
  if (urgency === "due") return "Due today";
  if (urgency === "soon") return daysUntil === 1 ? "Tomorrow" : `In ${daysUntil}d`;
  return `In ${daysUntil}d`;
}

function renderRooms() {
  const container = document.getElementById("rooms-container");
  container.innerHTML = "";

  const countEl = document.getElementById("plant-count");
  if (countEl) {
    const n = state.plants.length;
    countEl.textContent = `${n} plant${n === 1 ? "" : "s"} across ${state.rooms.length} room${state.rooms.length === 1 ? "" : "s"}`;
  }

  if (state.rooms.length === 0) {
    container.innerHTML = `<div class="empty-state">No rooms yet — add one below to get started.</div>`;
    return;
  }

  state.rooms.forEach(room => {
    const plantsInRoom = state.plants.filter(p => p.roomId === room.id);
    const orientationInfo = ORIENTATIONS[room.orientation];
    const orientationDisplay = room.orientationRaw || orientationInfo?.label || room.orientation;

    const roomEl = document.createElement("div");
    roomEl.className = "room";
    roomEl.innerHTML = `
      <div class="room-head">
        <div class="room-head-left">
          <div class="room-icon">${room.indoor ? "🏠" : "🌤️"}</div>
          <div>
            <div class="room-name">${room.name}</div>
            <div class="room-meta">${room.indoor ? "Indoor" : "Outdoor"} · facing ${orientationDisplay}</div>
          </div>
        </div>
        <button class="room-edit-btn" data-room-edit="${room.id}">Edit room</button>
      </div>
      <div class="room-plants" data-room-plants="${room.id}"></div>
    `;
    container.appendChild(roomEl);

    const plantsContainer = roomEl.querySelector(`[data-room-plants="${room.id}"]`);
    if (plantsInRoom.length === 0) {
      plantsContainer.innerHTML = `<div class="empty-state" style="padding:24px;">No plants in this room yet.</div>`;
    } else {
      plantsInRoom.forEach(plant => {
        plantsContainer.appendChild(renderPlantRow(plant, room));
      });
    }
  });
}

function renderPlantRow(plant, room) {
  const species = SPECIES[plant.speciesKey];
  const water = calculateWaterSchedule(plant, species, room, plant.lastWatered, weatherData);
  const feed = calculateFeedSchedule(species, plant.lastFed);

  const row = document.createElement("div");
  row.className = "plant-row";

  const reasonText = water.reasons.length ? `Why: ${water.reasons.join(", ")}` : "";

  const cameraIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"/><circle cx="12" cy="13" r="3.2"/></svg>`;
  const photoEl = plant.photo
    ? `<button type="button" class="plant-photo has-photo" data-photo-upload="${plant.id}" title="Change photo" style="background-image:url('${plant.photo}')"></button>`
    : `<button type="button" class="plant-photo" data-photo-upload="${plant.id}" title="Add a photo">${cameraIcon}</button>`;

  row.innerHTML = `
    ${photoEl}
    <div class="droplet" title="Water urgency">${dropletSVG(water.urgency)}</div>
    <div class="plant-info">
      <h3>${plant.nickname || species.commonName}</h3>
      <p class="latin">${species.latinName}</p>
      <div class="plant-status">
        <span class="status-pill ${water.urgency}">💧 ${urgencyLabel(water.urgency, water.daysUntil)}</span>
        <span class="status-pill ${feed.paused ? 'dormant' : feed.urgency}">🌱 ${feed.paused ? "Resting" : urgencyLabel(feed.urgency, feed.daysUntil)}</span>
      </div>
      ${reasonText ? `<span class="reason-line">${reasonText}</span>` : ""}
    </div>
    <div class="plant-actions">
      <button class="btn btn-water btn-small" data-water="${plant.id}">Watered today</button>
      <button class="btn btn-feed btn-small" data-feed="${plant.id}">Fed today</button>
    </div>
  `;
  return row;
}

/* ============================================================
   PHOTO UPLOAD (shared hidden file input)
   ============================================================ */

let pendingPhotoTarget = null; // plant id, or "__new__" for the add-plant form

function ensurePhotoInput() {
  let input = document.getElementById("photo-file-input");
  if (input) return input;
  input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.id = "photo-file-input";
  input.style.display = "none";
  document.body.appendChild(input);
  input.addEventListener("change", handlePhotoFileChosen);
  return input;
}

async function handlePhotoFileChosen(e) {
  const file = e.target.files[0];
  e.target.value = ""; // allow re-choosing the same file later
  if (!file || !pendingPhotoTarget) return;

  try {
    const dataUrl = await compressImageFile(file);
    if (pendingPhotoTarget === "__new__") {
      newPlantPhoto = dataUrl;
      renderNewPlantPhotoPreview();
    } else {
      const plant = state.plants.find(p => p.id === pendingPhotoTarget);
      if (plant) {
        plant.photo = dataUrl;
        saveState();
        renderRooms();
      }
    }
  } catch (err) {
    alert(err.message || "Could not use that photo.");
  } finally {
    pendingPhotoTarget = null;
  }
}

function openPhotoPicker(targetId) {
  pendingPhotoTarget = targetId;
  ensurePhotoInput().click();
}

/* ============================================================
   ACTIONS
   ============================================================ */

function markWatered(plantId) {
  const plant = state.plants.find(p => p.id === plantId);
  if (!plant) return;
  plant.lastWatered = new Date().toISOString().slice(0, 10);
  saveState();
  renderRooms();
}

function markFed(plantId) {
  const plant = state.plants.find(p => p.id === plantId);
  if (!plant) return;
  plant.lastFed = new Date().toISOString().slice(0, 10);
  saveState();
  renderRooms();
}

function deleteRoom(roomId) {
  if (state.plants.some(p => p.roomId === roomId)) {
    alert("Move or remove the plants in this room first.");
    return;
  }
  state.rooms = state.rooms.filter(r => r.id !== roomId);
  saveState();
  renderRooms();
  populateRoomSelect();
}

/* ============================================================
   ADD PLANT FORM
   ============================================================ */

let newPlantPhoto = null;

function renderNewPlantPhotoPreview() {
  const wrap = document.getElementById("new-plant-photo-preview");
  if (!wrap) return;
  const cameraIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"/><circle cx="12" cy="13" r="3.2"/></svg>`;
  wrap.style.backgroundImage = newPlantPhoto ? `url('${newPlantPhoto}')` : "none";
  wrap.classList.toggle("has-photo", !!newPlantPhoto);
  wrap.innerHTML = newPlantPhoto ? "" : cameraIcon;
}

function populateSpeciesSelect() {
  const sel = document.getElementById("new-plant-species");
  sel.innerHTML = Object.entries(SPECIES).map(([key, s]) =>
    `<option value="${key}">${s.commonName}</option>`
  ).join("");
}

function populateRoomSelect() {
  const sel = document.getElementById("new-plant-room");
  sel.innerHTML = state.rooms.map(r =>
    `<option value="${r.id}">${r.name}</option>`
  ).join("");
}

function handleAddPlant(e) {
  e.preventDefault();
  const speciesKey = document.getElementById("new-plant-species").value;
  const roomId = document.getElementById("new-plant-room").value;
  const nickname = document.getElementById("new-plant-nickname").value.trim();

  if (!roomId) {
    alert("Add a room first, then add plants to it.");
    return;
  }

  const todayISO = new Date().toISOString().slice(0, 10);
  state.plants.push({
    id: "p_" + Date.now(),
    speciesKey,
    roomId,
    nickname: nickname || null,
    lastWatered: todayISO,
    lastFed: todayISO,
    photo: newPlantPhoto || null
  });
  saveState();
  renderRooms();
  document.getElementById("new-plant-nickname").value = "";
  newPlantPhoto = null;
  renderNewPlantPhotoPreview();
}

/* ============================================================
   ADD ROOM FORM
   ============================================================ */

let selectedIndoor = true;
let selectedOrientation = "S";

function setupCompassPicker() {
  const grid = document.getElementById("compass-grid");
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  grid.innerHTML = dirs.map(d =>
    `<button type="button" class="compass-btn ${d === selectedOrientation ? "active" : ""}" data-dir="${d}">${d}</button>`
  ).join("");

  grid.querySelectorAll(".compass-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedOrientation = btn.dataset.dir;
      grid.querySelectorAll(".compass-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function setupIndoorToggle() {
  const wrap = document.getElementById("indoor-toggle");
  wrap.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedIndoor = btn.dataset.value === "indoor";
      wrap.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });
}

function handleAddRoom(e) {
  e.preventDefault();
  const name = document.getElementById("new-room-name").value.trim();
  if (!name) return;

  state.rooms.push({
    id: "room_" + Date.now(),
    name,
    indoor: selectedIndoor,
    orientation: selectedOrientation,
    orientationRaw: null
  });
  saveState();
  renderRooms();
  populateRoomSelect();
  document.getElementById("new-room-name").value = "";
}

/* ============================================================
   EVENT DELEGATION (for dynamically rendered buttons)
   ============================================================ */

document.addEventListener("click", (e) => {
  const waterBtn = e.target.closest("[data-water]");
  if (waterBtn) { markWatered(waterBtn.dataset.water); return; }

  const feedBtn = e.target.closest("[data-feed]");
  if (feedBtn) { markFed(feedBtn.dataset.feed); return; }

  const photoBtn = e.target.closest("[data-photo-upload]");
  if (photoBtn) { openPhotoPicker(photoBtn.dataset.photoUpload); return; }

  const newPhotoBtn = e.target.closest("#new-plant-photo-preview");
  if (newPhotoBtn) { openPhotoPicker("__new__"); return; }

  const editRoomBtn = e.target.closest("[data-room-edit]");
  if (editRoomBtn) {
    const roomId = editRoomBtn.dataset.roomEdit;
    const room = state.rooms.find(r => r.id === roomId);
    if (!room) return;
    const doDelete = confirm(`Remove "${room.name}"? (Only works if it has no plants left in it.)\n\nPress Cancel to keep it.`);
    if (doDelete) deleteRoom(roomId);
    return;
  }
});

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  populateSpeciesSelect();
  populateRoomSelect();
  setupCompassPicker();
  setupIndoorToggle();
  renderNewPlantPhotoPreview();

  document.getElementById("add-plant-form").addEventListener("submit", handleAddPlant);
  document.getElementById("add-room-form").addEventListener("submit", handleAddRoom);

  renderRooms();
  renderWeather();
});
