# REPORT — Real-time Evidence Processing for Official Record Transcription

🚀 **Live Demo:** https://report-fresh-five.vercel.app
📂 **GitHub:** https://github.com/barathg7/report-multilingual-fir
🏆 **HACKXELERATE Project** — Team WhiteCoders · Adhiparashakthi College of Engineering, Kalavai

---

An AI-powered, multilingual First Information Report (FIR) filing system with a dual portal — citizens file complaints by voice in their own language, and police officers triage, verify and download official state-specific FIR documents through a station-scoped dashboard.

---

## 📸 Screenshots

### Citizen Portal — Voice FIR Filing
| Landing Page | Voice Recording | FIR Preview |
|---|---|---|
| ![Landing](screenshots/landing-page.png) | ![Voice](screenshots/voice-recording.png) | ![FIR](screenshots/fir-preview.png) |

### Police Portal
| Police Dashboard | Crime Analytics |
|---|---|
| ![Dashboard](screenshots/police-dashboard.png) | ![Analytics](screenshots/crime-analytics.png) |

> 📁 Add your screenshots to a `screenshots/` folder in the root of the repo.

---

## 👥 Team WhiteCoders

| Name | Role | GitHub |
|---|---|---|
| Nithyarajan N.C | Team Leader | [@Nithyarajan-ctrl](https://github.com/Nithyarajan-ctrl) |
| Hemalatha M | Member | — |
| Barath G | Member | [@barathg7](https://github.com/barathg7) |
| Bhagesri Ranjana V | Member | [@Bhagesri01](https://github.com/Bhagesri01) |

---

## 🤝 Individual Contributions

### Barath G — [@barathg7](https://github.com/barathg7)
- Frontend development (React 18 + Vite + Tailwind CSS)
- Voice recording & Groq AI extraction pipeline
- MapTiler satellite map with GPS, landmark search and POI detection
- AI suspect sketch cascade (5-provider system)
- GitHub repository setup and management
- Vercel deployment, CI/CD and environment configuration

### Nithyarajan N.C — [@Nithyarajan-ctrl](https://github.com/Nithyarajan-ctrl)
- Project architecture and system design
- Dual-portal routing (citizen + police)
- BNS 2023 legal section classification logic
- Emergency SOS module and Twilio / Fast2SMS integration

### Bhagesri Ranjana V — [@Bhagesri01](https://github.com/Bhagesri01)
- Documentation and README
- UI validation and accessibility testing
- 28-state FIR template validation
- Offline-first storage and sync logic

### Hemalatha M
- Supabase database schema design
- Police-station directory (3,447 stations)
- Station isolation and jurisdiction logic
- QA testing and bug reporting

---

## 🔑 Environment Variables

Create a `.env` file in the project root and add the same keys in **Vercel → Project Settings → Environment Variables**:

| Variable | Required | Used for |
|---|---|---|
| `VITE_GROQ_API_KEY` | ✅ Yes | Speech-correction + FIR field/BNS-section extraction (Groq LLaMA 3.3 70B) |
| `VITE_SUPABASE_URL` | ✅ Yes | Database — FIR storage, police-station lookup |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Database — public anon key |
| `VITE_MAPTILER_KEY` | ✅ Yes | Satellite / hybrid / street crime-scene map |
| `FAST2SMS_API_KEY` | ✅ Yes | Emergency SOS SMS to Indian police numbers (+91) |
| `TWILIO_ACCOUNT_SID` | Optional | Emergency SOS SMS fallback (international numbers) |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio authentication |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio sender number |
| `VITE_CF_AI_TOKEN` + `VITE_CF_ACCOUNT_ID` | Optional | Suspect sketch — primary provider (Cloudflare Workers AI) |
| `VITE_NGC_API_KEY` | Optional | Suspect sketch — backup provider (NVIDIA NIM SDXL) |
| `VITE_NGC_FLUX_API_KEY` | Optional | Suspect sketch — backup provider (NVIDIA NIM Flux) |

> **Sketch** always works with zero keys — falls through to free **Pollinations AI** then **Hugging Face** automatically.
> **Fast2SMS** is the recommended SMS provider for Indian numbers. Get a free API key at [fast2sms.com](https://fast2sms.com).

---

## 🏛️ Two Portals, One App

| | Citizen Portal | Police Portal |
|---|---|---|
| Entry | Landing page → "File a Complaint" | Landing page → "Police Login" |
| Auth | None (session-scoped) | Station code + password |
| Core flow | 7-step guided FIR filing | Station-scoped FIR dashboard |
| Data scope | Own session's FIRs only (privacy-scoped by `sessionId`) | Only FIRs whose `station_code` matches the logged-in station |
| Document | Client-side `.docx` generation (no server call) | Server-side `.docx` via `POST /api/generate-fir` |
| Extra actions | Emergency SOS button | Update status, flag Fake FIR, download official document |

---

## 🧰 Tech Stack

| Capability | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS, React Router v6 (`HashRouter`) |
| Voice capture | Browser **SpeechRecognition** API — 50 languages (22 Indian + 28 international) |
| Speech correction + extraction | **Groq** `llama-3.3-70b-versatile` via `GroqManager.jsx` — fixes garbled speech, resolves "yesterday at 7pm" → exact date/time, extracts all FIR fields |
| Legal sections | **Bharatiya Nyaya Sanhita (BNS) 2023** — `bnsValidator.js` |
| Crime-scene map | **MapTiler SDK** (satellite/hybrid/streets/topo) + triple-geocoder (MapTiler → Nominatim → Photon) + Overpass API POI labels |
| AI suspect sketch | 5-provider cascade: **Cloudflare Workers AI** → **NVIDIA NIM SDXL** → **NVIDIA NIM Flux** → **Pollinations AI** → **Hugging Face** |
| FIR documents | 28 state/UT NCRB `.docx` templates, auto-selected by GPS state |
| Emergency SOS | `EmergencySecurity.jsx` — GPS → nearest station lookup → **Fast2SMS** (Indian) / Twilio (international) |
| Database | **Supabase** Postgres — station-isolated FIR storage, RLS policies, duplicate check |
| Station directory | `policeStations.js` — **3,447 stations** across India with lat/lng |
| Privacy | Session-scoped FIR display (`sessionStorage` ID) — each citizen sees only their own FIRs |
| Offline | `useFIRStore` — `localStorage`-first, auto-syncs to Supabase when back online |
| Deployment | **Vercel** (frontend SPA + Python serverless fn for FIR docs) |

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/barathg7/report-multilingual-fir.git
cd report-multilingual-fir

# 2. Install dependencies
npm install

# 3. Create .env file with your API keys (see Environment Variables above)

# 4. Start development server
npm run dev
# Open http://localhost:5173
```

For the FIR-document download to work from the police portal, add:
```
api/requirements.txt  →  python-docx==1.1.2
```

---

## 📁 Project Structure

```
REPORT_FRESH/
├── api/
│   ├── generate-fir.py        ← Vercel serverless: fills matching state .docx
│   └── send-sos.js            ← Vercel serverless: SMS via Fast2SMS / Twilio
├── public/
│   └── fir_templates/         ← 28 official state/UT FIR .docx templates
├── screenshots/               ← App screenshots (add yours here)
├── src/
│   ├── App.jsx                ← HashRouter routing, SOS FAB (hidden during filing)
│   ├── Layout.jsx             ← Citizen-portal shell
│   │
│   ├── pages/
│   │   ├── LandingPage.jsx    ← Choose Citizen / Police
│   │   ├── Home.jsx
│   │   ├── Dashboard.jsx      ← Session-scoped citizen FIR summary
│   │   ├── RecordStatement.jsx← 7-step guided FIR filing
│   │   ├── FIRHistory.jsx
│   │   ├── PoliceLogin.jsx    ← Station code + password login
│   │   ├── PoliceDashboard.jsx← Station-scoped FIR list + download + fake FIR flag
│   │   └── Analytics.jsx      ← Station-scoped crime statistics
│   │
│   ├── components/kavalan/
│   │   ├── VoiceRecorder.jsx     ← Mic + Groq correction + BNS mapping
│   │   ├── GroqManager.jsx       ← Groq API client, model cascade, retry
│   │   ├── LocationCapture.jsx   ← MapTiler map, GPS, search, POI labels
│   │   ├── PhotoUpload.jsx       ← Evidence attach
│   │   ├── SuspectSketch.jsx     ← 5-provider AI sketch cascade
│   │   ├── DigitalSignature.jsx  ← Canvas signature pad
│   │   ├── FIRDocument.jsx       ← On-screen FIR preview
│   │   ├── FIRDownload.jsx       ← Client-side state .docx generator
│   │   └── EmergencySecurity.jsx ← SOS panel (GPS → nearest station → SMS)
│   │
│   ├── hooks/
│   │   └── useFIRStore.js     ← Session-scoped localStorage + Supabase sync
│   ├── lib/
│   │   ├── supabaseClient.js  ← DB functions
│   │   └── findNearestStation.js ← Haversine nearest-station lookup
│   └── utils/
│       ├── bnsValidator.js    ← BNS 2023 section validation (live)
│       ├── ipcValidator.js    ← Legacy IPC reference (unused)
│       └── policeStations.js  ← 3,447-station directory
│
├── vercel.json                ← SPA rewrite + /api/* routing
└── package.json
```

---

## 🗄️ Database Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, create `firs` and `police_stations` tables with RLS policies:
   - anyone can `insert`/`select` on `firs`
   - anyone can `select` on `police_stations`
3. Seed `police_stations` from `src/utils/policeStations.js`
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your env

---

## 🔐 Emergency SOS Module

The SOS button appears on all citizen pages except during FIR filing (to avoid covering the Next button). When tapped:

1. Gets victim's GPS coordinates
2. Queries Supabase for the **3 nearest police stations** (Haversine distance)
3. Sends SMS via **Fast2SMS** (Indian numbers) or **Twilio** (fallback)
4. Displays station name, distance and delivery status

The floating button is hidden on `/record-statement` and `/police-dashboard` via `useLocation()`.

---

## 🔐 Police Portal Access

Station login credentials are managed by your district's nodal officer and stored securely in the `police_officers` table via Supabase.  
The default insecure password (`police123`) has been **disabled**. Contact your administrative nodal officer to obtain valid credentials.

---

**Keywords:** Multilingual FIR · Groq AI Extraction · BNS 2023 · AI Suspect Sketch · GPS Crime Mapping · Dual Portal · Supabase · Offline-First · Fast2SMS · Emergency SOS
