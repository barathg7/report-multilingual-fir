# REPORT — Real-time Evidence Processing for Official Record Transcription

**Team WhiteCoders · Adhiparashakthi College of Engineering, Kalavai · HACKXELERATE**

An AI-powered, multilingual First Information Report (FIR) filing system with a dual portal — citizens file complaints by voice in their own language, and police officers triage, verify and download official state-specific FIR documents through a station-scoped dashboard.

---

## 🚀 Quick Start

```bash
# 1. Extract the ZIP
# 2. Open a terminal inside the REPORT_FRESH folder
npm install
npm run dev
# Open http://localhost:5173
```

For the FIR-document download to work from the **police** portal you also need the Python serverless function dependency:

```bash
# create api/requirements.txt with:
python-docx==1.1.2
```

(Vercel runs `api/generate-fir.py` automatically — no separate `npm install` needed for it.)

---

## 🔑 Environment Variables

Create a `.env` file in the project root (and add the same keys in **Vercel → Project Settings → Environment Variables** before deploying):

| Variable | Required | Used for |
|---|---|---|
| `VITE_GROQ_API_KEY` | ✅ Yes | Speech-correction + FIR field/BNS-section extraction (Groq LLaMA 3.3 70B) |
| `VITE_SUPABASE_URL` | ✅ Yes | Database — FIR storage, police-station lookup |
| `VITE_SUPABASE_ANON_KEY` | ✅ Yes | Database — public anon key |
| `VITE_MAPTILER_KEY` | ✅ Yes | Satellite / hybrid / street crime-scene map |
| `VITE_CF_AI_TOKEN` + `VITE_CF_ACCOUNT_ID` | Optional | Suspect sketch — primary provider (Cloudflare Workers AI) |
| `VITE_NGC_API_KEY` | Optional | Suspect sketch — backup provider (NVIDIA NIM SDXL) |
| `VITE_NGC_FLUX_API_KEY` | Optional | Suspect sketch — backup provider (NVIDIA NIM Flux) |

> Sketch generation always works even with **zero** keys set — it automatically falls through to **Pollinations AI** and then **Hugging Face**, both free and key-less.

The Supabase project also needs two tables (`firs`, `police_stations`) with Row Level Security policies — run the schema SQL in the Supabase SQL Editor before first use (see *Database Setup* below).

---

## 🏛️ Two Portals, One App

| | Citizen Portal | Police Portal |
|---|---|---|
| Entry | Landing page → "File a Complaint" | Landing page → "Police Login" |
| Auth | None | Station code + password (`verifyStation` / `verifyStationLogin`) |
| Core flow | 7-step guided FIR filing | Station-scoped FIR dashboard |
| Data scope | Own submissions (local + cloud) | **Only** FIRs whose `station_code` matches the logged-in station — Katpadi PS never sees Vellore PS cases, etc. |
| Document | Client-side `.docx` generation (`FIRDownload.jsx`, uses the `docx` + `file-saver` packages — no server call) | Server-side `.docx` generation (`POST /api/generate-fir`, Python + `python-docx`) |
| Extra actions | — | Update status (`submitted → investigating → resolved → closed`), flag **Fake FIR** (shows applicable BNS sections & punishment for false complaints) |

---

## 🧰 Tech Stack

| Capability | Technology |
|---|---|
| Frontend framework | React 18 + Vite + Tailwind CSS, routed with React Router v6 (`HashRouter`) |
| Voice capture | Browser **SpeechRecognition** Web API — no key, works in Chrome — supports **50 languages** (22 official Indian languages + 28 international/tourist languages) |
| Speech correction + extraction | **Groq** (`llama-3.3-70b-versatile`, with 3 automatic backup models) via `GroqManager.jsx` — fixes garbled transcription, resolves relative dates/times ("yesterday at 7pm" → exact date + 24h time), extracts complainant + incident fields, classifies the crime and assigns the correct legal sections |
| Legal code | **Bharatiya Nyaya Sanhita (BNS) 2023** — `bnsValidator.js` (current law; `ipcValidator.js` is kept in the repo only as legacy reference and is not used by the live flow) |
| Crime-scene map | **MapTiler SDK** (hybrid / satellite / streets / topo styles) with a triple-fallback geocoder — MapTiler → Nominatim (Tamil-Nadu-biased) → Photon — plus **Overpass API** for nearby-landmark labels, GPS auto-detect, and a draggable confirm-pin |
| AI suspect sketch | 5-provider cascade, fully automatic: **Cloudflare Workers AI** → **NVIDIA NIM (SDXL)** → **NVIDIA NIM (Flux)** → **Pollinations AI** (free) → **Hugging Face** (free) |
| Official FIR document | 28 state/UT NCRB-style `.docx` templates (`public/fir_templates/`), auto-selected by the GPS-detected state. Citizen side fills it client-side; police side fills it via `api/generate-fir.py` |
| Database / dual-portal sync | **Supabase** (Postgres) — FIRs are written with the filing station's `station_code`, so each station's dashboard query is pre-filtered to its own jurisdiction; duplicate-complaint guard by phone + incident date |
| Police station directory | `policeStations.js` — **3,447** pre-loaded stations across India with lat/lng, used for nearest-station lookup, GPS→state detection, and login verification |
| Digital signature | Canvas-based signature pad for complainant + investigating officer |
| Offline support | `useFIRStore` — FIRs save to `localStorage` first and sync to Supabase automatically when back online |
| Security / emergency module | `EmergencySecurity.jsx` — 4-digit PIN app-lock screen, panic SOS timer, scheduled alarms. Ships as a self-contained drop-in component (see *Enabling the Security Module* below) |

---

## 📁 Project Structure

```
REPORT_FRESH/
├── api/
│   └── generate-fir.py          ← Vercel serverless fn: fills the matching state .docx template
├── public/
│   └── fir_templates/            ← 28 official state/UT FIR .docx templates
├── src/
│   ├── App.jsx                   ← HashRouter — citizen + police routes
│   ├── Layout.jsx                ← Citizen-portal shell (sidebar / bottom nav, online badge)
│   ├── main.jsx
│   ├── index.css
│   │
│   ├── pages/
│   │   ├── LandingPage.jsx       ← Choose Citizen / Police
│   │   ├── Home.jsx              ← Citizen marketing/landing
│   │   ├── Dashboard.jsx         ← Citizen FIR summary
│   │   ├── RecordStatement.jsx   ← 7-step guided FIR filing (Language → Record → Details →
│   │   │                            Incident → Location → Evidence → FIR)
│   │   ├── FIRHistory.jsx        ← Citizen's past FIRs
│   │   ├── PoliceLogin.jsx       ← Station code + password login
│   │   ├── PoliceDashboard.jsx   ← Station-scoped FIR list, status updates, fake-FIR flag, download
│   │   └── Analytics.jsx         ← Station-scoped crime statistics
│   │
│   ├── components/
│   │   ├── ui/                   ← Button, Input, Select, Textarea, Card, Badge, StepBar
│   │   └── kavalan/
│   │       ├── VoiceRecorder.jsx     ← Mic capture + Groq correction/extraction + BNS mapping
│   │       ├── GroqManager.jsx       ← Groq API client with model-cascade + retry/backoff
│   │       ├── LocationCapture.jsx   ← MapTiler map, GPS, triple-source search, POI labels
│   │       ├── PhotoUpload.jsx       ← Evidence photo/video attach
│   │       ├── SuspectSketch.jsx     ← 5-provider AI sketch cascade
│   │       ├── DigitalSignature.jsx  ← Canvas signature pad
│   │       ├── FIRDocument.jsx       ← On-screen FIR preview
│   │       ├── FIRDownload.jsx       ← Client-side state-specific .docx generator
│   │       └── EmergencySecurity.jsx ← PIN lock + SOS timer + alarms (drop-in, see below)
│   │
│   ├── hooks/
│   │   └── useFIRStore.js        ← localStorage-first FIR state, auto-sync to Supabase, duplicate check
│   │
│   ├── lib/
│   │   └── supabaseClient.js     ← saveFIRToSupabase, getFIRsForStation, updateFIRStatus,
│   │                                verifyStationLogin, checkDuplicateFIR
│   │
│   └── utils/
│       ├── index.js              ← cn(), formatDate(), generateFIRId(), storage helpers
│       ├── bnsValidator.js       ← live BNS section suggestion/validation (in use)
│       ├── ipcValidator.js       ← legacy IPC reference (not used by the live flow)
│       └── policeStations.js     ← 3,447-station directory + state templates + GPS lookup helpers
│
├── vercel.json                   ← rewrites /api/* to the Python fn, everything else to index.html
└── package.json
```

---

## 🗄️ Database Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, create the `firs` and `police_stations` tables with Row Level Security policies that allow:
   - anyone to `insert`/`select` on `firs` (citizens file, police read only their station's rows, filtered client-side by `station_code`)
   - anyone to `select` on `police_stations`
3. Seed `police_stations` with the entries from `src/utils/policeStations.js` (or your own subset).
4. Copy the **Project URL** and **anon public key** into `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

---

## 🔐 Enabling the Security Module

`EmergencySecurity.jsx` is included in the project but is **not** wired into `App.jsx` by default. To use it as an app-wide PIN lock with a floating SOS button:

```jsx
import { useState } from "react";
import EmergencySecurity from "@/components/kavalan/EmergencySecurity";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);

  if (!authed) {
    return <EmergencySecurity onAuthenticated={() => setAuthed(true)} />;
  }

  return (
    <>
      {/* ...your existing routes... */}
      <button onClick={() => setShowEmergency(true)} className="es-fab">🚨</button>
      <EmergencySecurity embedded showPanel={showEmergency} onClosePanel={() => setShowEmergency(false)} />
    </>
  );
}
```

Default PIN: **`1947`** (change the `DEFAULT_PIN` constant at the top of the file, or let the user change it from the in-app "Change Security Code" panel).

---

## 👥 Team

| Name | Role |
|---|---|
| Nithyarajan N.C | Team Leader |
| Hemalatha M | Member |
| Barath G | Member |
| Bhagesri Ranjna V | Member |

**Keywords:** Multilingual FIR · Groq AI Extraction · Bharatiya Nyaya Sanhita Classification · AI Suspect Sketch · GPS Crime Mapping · Dual Citizen/Police Portal · Supabase · Offline-First| Reverse Geocoding | Nominatim API |
| Frontend | React 18 + Vite + Tailwind CSS |
| State / Storage | localStorage (offline-first) |
| Routing | React Router v6 |

---

## 📁 Project Structure

```
src/
├── pages/
│   ├── Home.jsx              ← Landing page
│   ├── Dashboard.jsx         ← Officer dashboard
│   ├── RecordStatement.jsx   ← 7-step FIR filing
│   ├── FIRHistory.jsx        ← All FIR records
│   └── Analytics.jsx         ← Crime statistics
├── components/
│   ├── ui/                   ← Button, Input, Select, etc.
│   └── kavalan/              ← VoiceRecorder, LocationCapture,
│                                PhotoUpload, SuspectSketch,
│                                DigitalSignature, FIRDocument
├── hooks/
│   └── useFIRStore.js        ← localStorage FIR state
└── utils/
    ├── index.js              ← cn(), formatDate(), generateFIRId()
    └── ipcValidator.js       ← IPC section validation (20+ sections)
```

---

## 🔌 Connecting Real AI APIs

To use real Whisper / GPT-4o-mini / DALL-E 3, create a backend server and set these endpoints:

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/transcribe` | `{ audio: File, language: string }` | `{ text, confidence, language }` |
| `POST /api/extract` | `{ text: string }` | `{ crimeType, ipcSections, suspects }` |
| `POST /api/sketch` | `{ prompt: string }` | `{ imageUrl: string }` |

---

## 👥 Team

| Name | Role |
|---|---|
| Nithyarajan N.C | Team Leader |
| Hemalatha M | Member |
| Barath G | Member |
| Bhagesri Ranjna V | Member |

**Keywords:** Multilingual FIR, AI Suspect Sketch, NLP Legal Docs, GPS Tagging, Police API
