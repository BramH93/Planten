# The Greenhouse Ledger 🌿

A weather-aware plant care tracker, built for your collection in Utrecht, the Netherlands.

It tracks watering and feeding schedules per plant, adjusted automatically by:
- Indoor vs. outdoor placement
- Which compass direction the spot faces (more sun = dries out faster)
- The **live weather forecast for Utrecht** (rain coming = wait a bit longer; hot days ahead = water sooner)

No backend, no database, no API key required — it's a single static site that talks directly to the free [Open-Meteo](https://open-meteo.com) weather API from your browser.

---

## Your starting plants

| Plant | Location | Facing |
|---|---|---|
| Codiaeum 'Petra' | Indoor, at a window | ZZE (south-southeast-ish) |
| Basil (Ocimum basilicum) | Outdoor | ZZW |
| Eucalyptus | Outdoor | ZZW |
| Calendula | Outdoor | ZZW |
| Cherry tomato | Outdoor | ZZW |
| Dianthus 'Pink Kisses' | Outdoor | ZZW |
| Lobelia | Outdoor | ZZW |

These are pre-loaded the first time you open the app. You can edit, add, or remove rooms and plants freely from there on — your changes are saved in your browser's local storage.

---

## How to put this on GitHub Pages (free hosting)

**1. Create a new repository on GitHub**
   - Go to [github.com/new](https://github.com/new)
   - Name it whatever you like, e.g. `plant-tracker`
   - Keep it Public (GitHub Pages on a free account requires public repos)
   - Don't initialize with a README (you already have one)

**2. Add these files**

   Use **Add file → Create new file** for each one, typing the full path (e.g. `docs/index.html`) into the filename box — GitHub creates the folders automatically.

**3. Turn on GitHub Pages**
   - In your repo, go to **Settings → Pages** (left sidebar)
   - Under "Build and deployment" → "Source", choose **Deploy from a branch**
   - Under "Branch", choose **main** (or `master`) and folder **`/docs`**
   - Click **Save**

**4. Wait ~1 minute, then visit your site**
   - GitHub will show you a URL like `https://yourusername.github.io/plant-tracker/`
   - Bookmark it — that's your plant tracker, live on the internet

---

## Using the app

- **Watered today / Fed today** buttons log the action and reset that plant's countdown.
- Each plant shows a droplet icon that fills up as watering becomes more urgent (empty = just watered, full = overdue).
- The weather strip at the top shows current conditions in Utrecht and the rain/heat outlook driving the schedule adjustments below.
- **Add a room**: give it a name, mark indoor/outdoor, and pick the compass direction it faces.
- **Add a plant**: pick a species, assign it to a room, optionally give it a nickname (handy if you have two of the same plant).

## A note on your data

Everything is stored in your browser's local storage — nothing is sent to a server except the read-only weather request to Open-Meteo. This means:
- Your plant list won't appear on a different device or browser unless you open the same URL there *and* it's the same browser profile.
- Clearing your browser data will reset the app back to the 7 starting plants.
- If you'd like cross-device sync down the line, that's a bigger project (would need a backend) — happy to help with that later if useful.

## Adding new plant species

If you pick up new kinds of plants later, just let me know what they are and I can add proper researched care profiles for them, or you can open `docs/assets/plant-data.js` and add a new entry to the `SPECIES` object following the same pattern as the existing ones.
