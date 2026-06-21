/* ============================================================
   PLANT SPECIES PROFILES
   Baseline care intervals are for "normal" conditions —
   the weather engine (weather.js) adjusts these per day.
   Sources: horticultural extension services + grower guides
   (UMN Extension, USU Extension, RHS, Gardeners' World, etc.)
   ============================================================ */

const SPECIES = {
  croton_petra: {
    commonName: "Croton 'Petra'",
    latinName: "Codiaeum variegatum 'Petra'",
    kind: "houseplant",
    baseWaterDays: 6,            // moderate — top inch dries between waterings
    droughtTolerance: "low",      // does NOT like drying out fully
    sunLove: "bright-indirect",
    feedEveryDays: 60,            // every 2 months, growing season only
    feedSeasonOnly: true,
    dormantMonths: [11, 0, 1],    // Nov, Dec, Jan slows down
    notes: "Keep away from cold drafts and radiators. Likes humidity — mist occasionally."
  },
  basil: {
    commonName: "Basil",
    latinName: "Ocimum basilicum",
    kind: "herb",
    baseWaterDays: 3,             // shallow roots, frequent water, weekly minimum
    droughtTolerance: "low",
    sunLove: "full-sun",
    feedEveryDays: 21,            // every 2-3 weeks in containers
    feedSeasonOnly: true,
    dormantMonths: [10, 11, 0, 1, 2], // tender annual — dies at frost, no care needed
    notes: "Tender annual — will not survive frost. Water at soil level, not leaves."
  },
  eucalyptus: {
    commonName: "Eucalyptus",
    latinName: "Eucalyptus sp.",
    kind: "shrub/tree",
    baseWaterDays: 7,             // weekly, drought tolerant once established
    droughtTolerance: "high",
    sunLove: "full-sun",
    feedEveryDays: 28,            // every few weeks in growing season
    feedSeasonOnly: true,
    dormantMonths: [11, 0, 1],
    notes: "Drought-tolerant once established — better to underwater than overwater. Protect from frost below 0°C."
  },
  calendula: {
    commonName: "Calendula",
    latinName: "Calendula officinalis",
    kind: "flower",
    baseWaterDays: 5,             // 1-2x/week, tolerates low water once established
    droughtTolerance: "medium-high",
    sunLove: "full-sun",
    feedEveryDays: 30,            // light feeder, monthly if needed
    feedSeasonOnly: true,
    dormantMonths: [11, 0, 1],
    notes: "Easy to overwater. Let soil surface dry before watering again. Deadhead to keep blooming."
  },
  cherry_tomato: {
    commonName: "Cherry Tomato",
    latinName: "Solanum lycopersicum var. cerasiforme",
    kind: "vegetable",
    baseWaterDays: 2,             // containers need near-daily water once fruiting
    droughtTolerance: "low",
    sunLove: "full-sun",
    feedEveryDays: 14,            // every 1-2 weeks, heavier feeder once flowering
    feedSeasonOnly: true,
    dormantMonths: [10, 11, 0, 1, 2],
    notes: "Container plants dry out fast — check daily in hot weather. Reduce water slightly as fruit ripens to concentrate flavour."
  },
  dianthus: {
    commonName: "Dianthus 'Pink Kisses'",
    latinName: "Dianthus caryophyllus 'Pink Kisses'",
    kind: "flower",
    baseWaterDays: 6,             // moderate, drought tolerant once established
    droughtTolerance: "high",
    sunLove: "full-sun",
    feedEveryDays: 42,            // light feeder, every 4-6 weeks
    feedSeasonOnly: true,
    dormantMonths: [11, 0, 1],
    notes: "Sensitive to wet soil, especially in winter. Let the top inch dry between waterings."
  },
  lobelia: {
    commonName: "Lobelia",
    latinName: "Lobelia erinus",
    kind: "flower",
    baseWaterDays: 3,             // needs consistent moisture, not drought tolerant
    droughtTolerance: "low",
    sunLove: "full-sun-part-shade",
    feedEveryDays: 21,            // every 2-4 weeks, heavier feeder
    feedSeasonOnly: true,
    dormantMonths: [10, 11, 0, 1, 2],
    notes: "Tender annual, doesn't like drying out. Shear back by a third mid-season if it gets leggy."
  }
};

/* ============================================================
   USER'S PLANTS — initial seed data
   Each plant references a species + room/spot.
   lastWatered / lastFed default to today on first load;
   the user can edit these.
   ============================================================ */

const ORIENTATIONS = {
  N:  { label: "North",      sunHours: "low",    rainExposed: true },
  NE: { label: "Northeast",  sunHours: "low-med",rainExposed: true },
  E:  { label: "East",       sunHours: "medium", rainExposed: true },
  SE: { label: "Southeast",  sunHours: "med-high",rainExposed: true },
  S:  { label: "South",      sunHours: "high",   rainExposed: true },
  SW: { label: "Southwest",  sunHours: "high",   rainExposed: true },
  W:  { label: "West",       sunHours: "med-high",rainExposed: true },
  NW: { label: "Northwest",  sunHours: "low-med",rainExposed: true },
  // Dutch shorthand the user used (ZZE / ZZW = Zuidzuidoost / Zuidzuidwest)
  ZZO:{ label: "South-southeast", sunHours: "high", rainExposed: true },
  ZZW:{ label: "South-southwest", sunHours: "high", rainExposed: true }
};

const DEFAULT_ROOMS = [
  {
    id: "room_window",
    name: "Window sill",
    indoor: true,
    orientation: "ZZO", // user wrote "ZZE" — closest standard compass match is south-southeast; editable in-app
    orientationRaw: "ZZE"
  },
  {
    id: "room_balcony",
    name: "Balcony / outside",
    indoor: false,
    orientation: "ZZW",
    orientationRaw: "ZZW"
  }
];

const DEFAULT_PLANTS = [
  { id: "p1", speciesKey: "croton_petra", roomId: "room_window", nickname: null },
  { id: "p2", speciesKey: "basil",        roomId: "room_balcony", nickname: null },
  { id: "p3", speciesKey: "eucalyptus",   roomId: "room_balcony", nickname: null },
  { id: "p4", speciesKey: "calendula",    roomId: "room_balcony", nickname: null },
  { id: "p5", speciesKey: "cherry_tomato",roomId: "room_balcony", nickname: null },
  { id: "p6", speciesKey: "dianthus",     roomId: "room_balcony", nickname: null },
  { id: "p7", speciesKey: "lobelia",      roomId: "room_balcony", nickname: null }
];
