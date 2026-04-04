# TrackPressure

A React Native (Expo) app for logging, analysing, and optimising tire pressures at track events.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Add environment variables
# Create a .env file at the project root:
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 3. Start the dev server
npx expo start

# 4. Scan the QR code with Expo Go (iOS/Android)
```

The app runs fully on static mock data with no Supabase connection needed for development.
Supabase is only required for real user auth and persistent storage.

---

## Project structure

```
App.js                        Root navigator (5 screens)

src/
  data/
    staticData.js             OEM vehicle pressures, tire targets,
                              track coordinates, mock session history

  lib/
    services.js               Supabase client, GPS detection (expo-location),
                              NOAA + Open-Meteo weather fetch,
                              data queries, recommendation engine
    theme.js                  Colors, spacing, shared StyleSheet

  components/
    index.js                  Shared UI: NumPad, PressureBox, AutoPill,
                              SelectRow, InRangeBadge, etc.

  screens/
    HomeScreen.js             Landing: last session + event start CTA
    EventSetupScreen.js       Once-per-day: track (GPS), car, tires, session type
    QuickLogScreen.js         Per-session: large numpad pressure entry
    ConfirmationScreen.js     Post-submit: comparison + community range + insight
    HistoryScreen.js          Temp correlation chart + session list + recommendations
```

---

## GPS track detection

On `EventSetupScreen` mount, the app requests foreground location permission
and runs a Haversine distance check against every track in `staticData.js`.
A match within 5 km auto-selects the track. The user can always override.

To add tracks: add an entry to `TRACKS` in `src/data/staticData.js` with
`lat`, `lng`, and `configurations`.

---

## Weather auto-capture

Two-stage fetch, no API key required:

1. **NOAA** (`api.weather.gov`) — US tracks, highest accuracy
2. **Open-Meteo** (`api.open-meteo.com`) — global fallback

Ambient temperature is attached to every session entry automatically
and used by the recommendation engine to adjust cold set suggestions.

---

## Supabase integration

The app is wired to Supabase but degrades gracefully without it:

| Feature | Without Supabase | With Supabase |
|---|---|---|
| Event setup | Static vehicle/tire/track data | Same + user profile |
| Log session | Local object (not persisted) | Written to `pressure_entries` |
| History | MOCK_SESSIONS from staticData | Real user sessions |
| Community data | MOCK_COMMUNITY averages | `consensus_pressures` view |
| Recommendations | From mock sessions | From real personal history |

Run the SQL schema from `track_pressure_schema.sql` (provided separately)
against your Supabase project before enabling live data.

---

## Recommendation engine

Located in `src/lib/services.js → computeRecommendation()`.

Uses simple linear regression of `cold_front_psi` vs `ambient_temp_c`
across personal sessions. Requires at least 3 sessions to activate.
Below 3 sessions, the app falls back to community averages.

The personal/community blend ratio:
- < 5 sessions:  10% personal / 90% community
- 5–20 sessions: 60% personal / 40% community
- 20+ sessions:  85% personal / 15% community

---

## Adding tire targets

Edit `TIRE_TARGETS` in `src/data/staticData.js`:

```js
't_new': {
  min: 33.0,        // minimum hot PSI for target operating range
  max: 37.0,        // maximum hot PSI
  temp_min_c: 80,   // tire operating temperature range (optional)
  temp_max_c: 100,
  source: 'official' // or 'community'
},
```

The `id` key must match a tire entry in `TIRES`.

---

## Extending the app

**Pyrometer data** — add `temp_fl`, `temp_fr`, `temp_rl`, `temp_rr` columns
to `pressure_entries` and a new input section on `QuickLogScreen`.

**Lap timer integration** — add `best_lap_seconds` to entries; correlate
with setup on `HistoryScreen` to surface "fastest lap" setups.

**Push notifications** — use Supabase Edge Functions + Expo Push to alert
users when a new community session is logged for their exact car/tire/track
combo, nudging them back into the app between events.
