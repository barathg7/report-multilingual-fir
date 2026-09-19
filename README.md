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
- Emergency SOS module and httpSMS Android Gateway integration

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
| `GROQ_API_KEY` | ✅ Yes (Server-side only) | Speech-correction + FIR field/BNS-section extraction via `/api/ai/groq` proxy (NEVER expose with `VITE_` prefix) |
| `VITE_SUPABASE_URL` | ✅ Yes | Database — FIR storage, police-station lookup |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Database — public anon key |
| `VITE_MAPTILER_KEY` | ✅ Yes | Satellite / hybrid / street crime-scene map |
| `HTTPSMS_API_KEY` | ✅ Yes (Edge Function secret) | httpSMS API key for Android gateway SMS dispatch |
| `HTTPSMS_FROM_NUMBER` | ✅ Yes (Edge Function secret) | Sender phone number matching physical SIM in Android phone (+91...) |
| `HTTPSMS_WEBHOOK_SIGNING_KEY` | Optional (Edge Function secret) | Webhook signing key for verifying delivery callbacks |
| `TWILIO_ACCOUNT_SID` | Optional | Emergency SOS SMS fallback (international numbers) |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio authentication |
| `TWILIO_PHONE_NUMBER` | Optional | Twilio sender number |
| `VITE_CF_AI_TOKEN` + `VITE_CF_ACCOUNT_ID` | Optional | Suspect sketch — primary provider (Cloudflare Workers AI) |
| `VITE_NGC_API_KEY` | Optional | Suspect sketch — backup provider (NVIDIA NIM SDXL) |
| `VITE_NGC_FLUX_API_KEY` | Optional | Suspect sketch — backup provider (NVIDIA NIM Flux) |

> **Sketch** always works with zero keys — falls through to free **Pollinations AI** then **Hugging Face** automatically.
> **httpSMS Android Gateway** is the automated SMS provider for emergency contacts. See setup guide in [`docs/HTTPSMS_GATEWAY_SETUP.md`](docs/HTTPSMS_GATEWAY_SETUP.md).

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

## 🛡️ REPORT Universal Emergency System

REPORT has been upgraded from a simple SOS panic ping into a full-scale, omni-channel crisis intelligence system:

### 1. REPORT QuickShield
- **Instant Activation**: Single-touch emergency trigger with zero screen navigation.
- **Global Keyboard Shortcut**: `Ctrl + Shift + E` triggers emergency mode from any citizen page.
- **Web Speech Activation**: Hands-free voice trigger ("Help", "Emergency", "Kavalan", "Police") via browser Web Speech API.
- **Universal Emergency Mode**: 5 high-contrast macro buttons (`ATTACK/THREAT`, `HOSTAGE/INTRUSION`, `MEDICAL`, `FIRE/DISASTER`, `CAN'T EXPLAIN`).
- **No-Communication Mode**: Complete silent mode with audio suppression and tactile vibration feedback.

### 2. REPORT Crisis Intelligence Engine (CIE)
- **Living Incidents**: Incidents evolve over time instead of expiring as static pings.
- **Append-Only Timeline**: Every event (activation, facts update, threat escalation, police acknowledgement) is permanently recorded with actor and timestamp.
- **Structured Facts Aggregation**: Captures weapons present, suspect count, and safe shelter status via the **Adaptive Emergency Interview**.
- **Deterministic Priority Engine**: Priority is computed algorithmically from verified facts (weapons, threats, entrapment) without speculative AI labeling.
- **Strict Anti-Downgrade Governance**: Threats can escalate dynamically from citizen updates; de-escalation requires authenticated police command action.

### 3. SafeTag BLE Hardware Architecture
- **ESP32 BLE GATT Specification**: 128-bit service and characteristic UUIDs for emergency trigger uplink and police acknowledgement downlink.
- **Tactile Inputs & Debounce**: 50ms debounce, 3000ms continuous hold for General SOS, 400ms double-press for Physical Threat, 10s cancellation grace window.
- **Downstream 2-Pulse Acknowledgement**: When police claim an incident, the citizen's device / SafeTag simulator responds with a 2-pulse vibration pattern (`[300ms, 150ms, 300ms]`).
- **Hardware Simulator**: An interactive browser-based hardware simulator labeled `"SAFE TAG SIMULATOR — DEMO HARDWARE"` for live testing without physical hardware.

### 📚 Detailed Technical Architecture Documentation
- 📘 [Universal Emergency System Architecture](docs/UNIVERSAL_EMERGENCY_SYSTEM.md)
- 📗 [Crisis Intelligence Engine (CIE) Specification](docs/CRISIS_INTELLIGENCE_ENGINE.md)
- 📙 [SafeTag Hardware Integration Architecture](docs/SAFETAG_HARDWARE_ARCHITECTURE.md)
- 📕 [Accessibility & Non-Verbal Interaction Design](docs/ACCESSIBILITY_EMERGENCY_DESIGN.md)

---

## ⚠️ ISL (Indian Sign Language) Subsystem — Technical Disclosure

> **IMPORTANT: Read before evaluating the sign language feature.**

The REPORT application includes an experimental browser-based gesture input aid to help citizens with hearing or speech impairments provide incident descriptions. The following facts must be clearly understood:

### What it IS:
- **A rule-based geometric gesture recognizer** implemented in `src/lib/signLanguage/islGeometryClassifier.js`
- Runs entirely in the browser using **MediaPipe Vision HandLandmarker** for 21 3D hand keypoint detection
- Produces **geometric fit scores** (`matchScore`) based on hand landmark geometry — finger extension, spread, and orientation
- Conservative threshold: **`matchScore >= 0.90`** required before any gesture is registered as a candidate
- Emergency tokens (`HELP`, `POLICE`, `ACCIDENT`, `THEFT`, `STOP`) require **explicit citizen dialog confirmation** before entering the draft statement

### What it is NOT:
- ❌ **NOT** a trained, validated Indian Sign Language (ISL) recognition model
- ❌ **NOT** a continuous ISL sentence translation system
- ❌ **NOT** a system with validated clinical, forensic, or legal accuracy
- ❌ **NOT** using any machine-learned weights for sign classification
- ❌ **NOT** able to produce legal determinations, BNS section suggestions, or official FIR classifications

### AI4Bharat INCLUDE-263 Evaluation (Phase 4 Audit):
AI4Bharat's INCLUDE-263 isolated-sign classifier was evaluated for potential integration. It was **not integrated** because:
- Required emergency vocabulary (`HELP`, `ACCIDENT`) is missing from its 263-class vocabulary
- It has no background/`NONE` class — would produce false positives on idle or non-signing input
- The pretrained PyTorch `.pth` checkpoint (~75MB) is too heavy for in-browser inference at MVP scale
- It is a **discrete isolated-sign classifier**, not continuous ISL sentence translation
- Critical sign language terms for police reporting context remain absent

### Provenance:
All text produced by the gesture recognizer is tagged with:
```json
{ "source": "sign_language_experimental", "verified": false }
```
It goes only to `incidentDescription` and **never touches** `legalSuggestions`, `ipcSections`, or BNS legal fields.

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
| Emergency SOS | `EmergencySecurity.jsx` — GPS → nearest station lookup → **httpSMS Android Gateway** (automatic SIM dispatch) |
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
│   └── send-sos.js            ← Legacy fallback endpoint
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

## 🛡️ REPORT Universal Emergency System

The Universal Emergency System upgrades conventional static SOS panic alerts into an omni-channel crisis intelligence ecosystem:

1. **REPORT QuickShield**: Instantaneous emergency triggering without app navigation:
   - **Global Hotkey**: `Ctrl+Shift+E` opens emergency terminal instantly.
   - **Direct Deep Link**: `#quickshield` or `?sos=quickshield`.
   - **Web Speech API**: Listens for emergency keywords ("help", "emergency", "police", "kavalan").
   - **Universal Emergency Mode**: 5 rapid direct touch targets (`ATTACK / THREAT`, `HOSTAGE / INTRUSION`, `MEDICAL`, `FIRE / DISASTER`, `CAN'T EXPLAIN — IMMEDIATE HELP`).
   - **No-Communication Mode**: Silent emergency mode with audio suppression and single-tap binary updates (`[ NEED HELP ]` / `[ I'M SAFE ]`).
   - **Adaptive Emergency Interview**: Collects 4 non-blocking structured facts (threat proximity, weapons visible, suspects count, safe shelter) without delaying the initial SOS.

2. **REPORT Crisis Intelligence Engine (CIE)**:
   - Transforms alerts into living, evolving incident records stored in Supabase with append-only timelines.
   - Non-downgrading threat evolution: `UNKNOWN` → `SUSPICIOUS_ACTIVITY` → `ACTIVE_THREAT` → `CRITICAL_THREAT` → `ACKNOWLEDGED` → `RESOLVED`.
   - Strict provenance tracking (`source`, `confidence`, `user_confirmed`, `timestamp`, `location`, `accuracy`).
   - Categorical emergency taxonomy with zero AI speculation on criminal identities.

3. **REPORT SafeTag Hardware Integration Architecture**:
   - ESP32 BLE GATT protocol (`0000ffe0` service, `0000ffe1` trigger, `0000ffe2` ack, `0000ffe3` telemetry).
   - Accidental trigger protection: 50ms debounce, 3s long-press for General SOS, double-press for Physical Threat, secondary button for Medical, 5s cancel hold.
   - Interactive browser hardware simulator with explicit `"SAFE TAG SIMULATOR — DEMO HARDWARE"` branding.
   - Real-time command center acknowledgement with 2-pulse haptic vibration pattern (`[300, 150, 300]ms`).

4. **httpSMS Android Gateway Dispatch**:
   - Automated server-side SMS via physical SIM card on dedicated Android gateway phone.
   - Strict authorized recipient whitelist (3 primary, 3 reserve).
   - Truthful state transitions (`SMS_SUBMITTED` → `SMS_DELIVERY_CONFIRMED`). Demo simulation is unmistakably tagged with `[DEMO SIMULATION]`.

---

## 🔐 Police Portal Access

Station login credentials are managed by your district's nodal officer and stored securely in the `police_officers` table via Supabase.  
The default insecure password (`police123`) has been **disabled**. Contact your administrative nodal officer to obtain valid credentials.

---

**Keywords:** Multilingual FIR · Groq AI Extraction · BNS 2023 · AI Suspect Sketch · GPS Crime Mapping · Dual Portal · Supabase · Offline-First · httpSMS Android Gateway · Universal Emergency System · QuickShield · Crisis Intelligence Engine · SafeTag ESP32 BLE
