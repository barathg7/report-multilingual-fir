# REPORT — Real-time Evidence Processing for Official Record Transcription

**Team WhiteCoders · Adhiparashakthi College of Engineering, Kalavai · HACKXELERATE**

---

## 🚀 Quick Start (Fresh Install)

```bash
# 1. Extract the ZIP
# 2. Open terminal in the REPORT_project folder
npm install
npm run dev
# Open http://localhost:5173
```

That's it. No extra config needed.

---

## 🧰 Tech Stack

| Feature | Technology |
|---|---|
| Voice Recording | Browser MediaRecorder API |
| Speech-to-Text | OpenAI Whisper (via /api/transcribe) |
| NLP Extraction | GPT-4o-mini (via /api/extract) |
| Suspect Sketch | DALL-E 3 (via /api/sketch) |
| GPS Mapping | Browser Geolocation API |
| Map Rendering | OpenStreetMap iframe embed |
| Reverse Geocoding | Nominatim API |
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
