/**
 * FIRDownload.jsx
 * FIXED: Uses static imports for docx + file-saver (Vite bundles them correctly).
 * Dynamic import("docx") fails in browser — must be static top-level import.
 */

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Download, Shield, CheckCircle, Navigation,
  Search, ChevronRight, Loader2, AlertTriangle, Building2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import {
  ALL_STATES, STATE_TEMPLATES,
  getNearbyStations, getStationsByState,
  detectStateFromGPS,
} from "@/utils/policeStations";

// FIX: Static imports — Vite bundles these at build time (no browser dynamic import error)
import {
  Document, Packer, Table, TableRow, TableCell,
  Paragraph, TextRun, WidthType, BorderStyle,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

// ── State flag/emblem emoji map ───────────────────────────────────────────────
const STATE_EMOJI = {
  "Tamil Nadu": "🏛️", "Maharashtra": "🦁", "Karnataka": "🌺",
  "Kerala": "🌴", "Andhra Pradesh": "🌊", "Telangana": "🏺",
  "Gujarat": "🦁", "Rajasthan": "🏜️", "Uttar Pradesh": "🕌",
  "West Bengal": "🐯", "Bihar": "🪔", "Madhya Pradesh": "🐆",
  "Odisha": "🛕", "Jharkhand": "⛰️", "Assam": "🍵",
  "Chhattisgarh": "🌾", "Punjab": "🌾", "Haryana": "🌾",
  "Uttarakhand": "🏔️", "Himachal Pradesh": "❄️", "Goa": "🏖️",
  "Sikkim": "🏔️", "Arunachal Pradesh": "🌿", "Manipur": "💃",
  "Meghalaya": "🌧️", "Mizoram": "🌿", "Nagaland": "🏔️",
  "Tripura": "🌳",
};

// ── Format date helper ────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    if (dateStr.includes("-")) {
      const [y, m, d] = dateStr.split("-");
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  } catch { return dateStr; }
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  try {
    if (timeStr.includes(":")) {
      const [h, m] = timeStr.split(":");
      const hr = parseInt(h);
      const period = hr >= 12 ? "PM" : "AM";
      return `${hr % 12 || 12}:${m} ${period}`;
    }
    return timeStr;
  } catch { return timeStr; }
}

function getDayName(dateStr) {
  if (!dateStr) return "";
  try {
    const d = dateStr.includes("-")
      ? new Date(dateStr)
      : new Date(dateStr.split("/").reverse().join("-"));
    return d.toLocaleDateString("en-IN", { weekday: "long" });
  } catch { return ""; }
}

// ── Generate and download DOCX using python-docx via Pyodide OR pure JS ──────
// Since we can't run Python in browser, we use the docx npm package
// to programmatically fill tables. We map fields to cell coordinates.
async function generateFIRDocx(fir, station, state) {
  // Uses statically imported docx + file-saver (fixed: no dynamic browser import)

  const now = new Date();
  const ipcSections = fir.ipcSections || [];
  const bnsSections = ipcSections.join(", §");
  const bnsStr = ipcSections.length ? `§${bnsSections}` : "";

  // Helper: create a label+value row
  const LVRow = (label, value, label2 = "", value2 = "") => new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: value || "", size: 18 })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label2, bold: true, size: 18 })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: value2 || "", size: 18 })] })],
      }),
    ],
  });

  // Helper: full-width row
  const FWRow = (label, value = "", bold = false) => new TableRow({
    children: [
      new TableCell({
        columnSpan: 4,
        width: { size: 100, type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          children: [
            new TextRun({ text: label, bold: true, size: bold ? 20 : 18 }),
            value ? new TextRun({ text: "  " + value, size: 18 }) : new TextRun(""),
          ],
        })],
      }),
    ],
  });

  const SectionHeader = (text) => new TableRow({
    children: [
      new TableCell({
        columnSpan: 4,
        shading: { fill: "1E3A5F" },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 20 })],
        })],
      }),
    ],
  });

  // State-specific language header
  const STATE_HEADERS = {
    "Tamil Nadu":        "தமிழ்நாடு காவல்துறை / TAMIL NADU POLICE",
    "Andhra Pradesh":    "ఆంధ్రప్రదేశ్ పోలీసు / ANDHRA PRADESH POLICE",
    "Telangana":         "తెలంగాణ పోలీసు / TELANGANA POLICE",
    "Karnataka":         "ಕರ್ನಾಟಕ ಪೋಲೀಸ್ / KARNATAKA POLICE",
    "Kerala":            "കേരള പോലീസ് / KERALA POLICE",
    "Maharashtra":       "महाराष्ट्र पोलीस / MAHARASHTRA POLICE",
    "Gujarat":           "ગુજરાત પોલીસ / GUJARAT POLICE",
    "Rajasthan":         "राजस्थान पुलिस / RAJASTHAN POLICE",
    "Uttar Pradesh":     "उत्तर प्रदेश पुलिस / UTTAR PRADESH POLICE",
    "West Bengal":       "পশ্চিমবঙ্গ পুলিশ / WEST BENGAL POLICE",
    "Bihar":             "बिहार पुलिस / BIHAR POLICE",
    "Madhya Pradesh":    "मध्यप्रदेश पुलिस / MADHYA PRADESH POLICE",
    "Punjab":            "ਪੰਜਾਬ ਪੁਲਿਸ / PUNJAB POLICE",
    "Odisha":            "ଓଡ଼ିଶା ପୋଲିସ / ODISHA POLICE",
    "Assam":             "অসম আৰক্ষী / ASSAM POLICE",
    "default":           `${state.toUpperCase()} POLICE`,
  };

  const stateHeader = STATE_HEADERS[state] || STATE_HEADERS.default;

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // === SECTION 1: POLICE STATION ===
      SectionHeader("N.C.R.B. I.I.F.-I  |  FIRST INFORMATION REPORT / முதல் தகவல் அறிக்கை"),
      FWRow(stateHeader, "", true),
      FWRow("U/s 173, Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023", "", false),
      SectionHeader("1. POLICE STATION DETAILS"),
      LVRow("District / மாவட்டம் :", station?.district || fir.locationDistrict || fir.locationCity || "", "P.S. / காவல் நிலையம் :", station?.name || fir.stationName || ""),
      LVRow("FIR No. / எண் :", fir.id || "", "Year / ஆண்டு :", String(now.getFullYear())),
      LVRow("Date / தேதி :", now.toLocaleDateString("en-IN"), "Time / நேரம் :", now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })),

      // === SECTION 2: ACT & SECTIONS ===
      SectionHeader("2. ACT(S) AND SECTION(S) / சட்டம் மற்றும் பிரிவுகள்"),
      LVRow("(i) Act :", "Bharatiya Nyaya Sanhita (BNS) 2023", "Sections :", bnsStr),
      LVRow("(ii) Act :", ipcSections.some(s => ["66C","66D","66E","67","67A"].includes(s)) ? "Information Technology Act, 2000" : "", "Sections :", ipcSections.filter(s => ["66C","66D","66E","67","67A"].includes(s)).map(s => `§${s}`).join(", ")),
      LVRow("(iii) Other Acts :", "", "Sections :", ""),

      // === SECTION 3: OCCURRENCE ===
      SectionHeader("3. OCCURRENCE OF OFFENCE / குற்றம் நடந்த நேரம்"),
      LVRow("(a) Day / நாள் :", getDayName(fir.incidentDate), "Date / தேதி :", formatDate(fir.incidentDate)),
      LVRow("Time From / நேரம் :", formatTime(fir.incidentTime), "Time To :", ""),
      LVRow("(b) Info Received Date :", now.toLocaleDateString("en-IN"), "Time :", now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })),
      LVRow("(c) GD Entry No. :", `GD/${fir.id || "AUTO"}`, "Time :", now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })),

      // === SECTION 4: TYPE OF INFORMATION ===
      SectionHeader("4. TYPE OF INFORMATION / தகவல் வகை"),
      LVRow("Written / எழுத்துப்பூர்வம் :", "✓", "Oral / வாய்மொழி :", ""),

      // === SECTION 5: PLACE OF OCCURRENCE ===
      SectionHeader("5. PLACE OF OCCURRENCE / குற்றம் நடந்த இடம்"),
      FWRow("(a) Direction & Distance from P.S. :", `Approx. ${station ? (haversineKm(station.lat, station.lng, fir.incidentLatitude || station.lat, fir.incidentLongitude || station.lng)).toFixed(1) + " km" : "N/A"}`),
      LVRow("Beat No. :", "", "Type of Place :", fir.crimeType || ""),
      FWRow("(b) Address / முகவரி :", fir.locationAddress || fir.incidentLocation || ""),
      FWRow("GPS Coordinates :", fir.incidentLatitude ? `${fir.incidentLatitude.toFixed(5)}°N, ${fir.incidentLongitude.toFixed(5)}°E` : ""),
      LVRow("(c) Outside P.S. :", "", "District :", ""),

      // === SECTION 6: COMPLAINANT ===
      SectionHeader("6. COMPLAINANT / INFORMANT DETAILS / புகார்தாரர் விவரங்கள்"),
      FWRow("(a) Name / பெயர் :", fir.complainantName || ""),
      FWRow("(b) Father's / Husband's Name :", fir.fatherHusbandName || ""),
      LVRow("(c) Date of Birth :", fir.complainantDOB || "", "(d) Nationality :", "Indian"),
      LVRow("(e) Passport No. :", "", "Date of Issue :", ""),
      FWRow("(f) Occupation / தொழில் :", fir.occupation || ""),
      FWRow("(g) Address / முகவரி :", fir.complainantAddress || ""),
      FWRow("Phone / தொலைபேசி :", fir.complainantPhone || ""),
      FWRow("Age / வயது :", fir.complainantAge ? `${fir.complainantAge} years` : "", ),
      FWRow("Gender / பாலினம் :", fir.complainantGender || ""),
      FWRow("Language :", fir.language || ""),

      // === SECTION 7: ACCUSED ===
      SectionHeader("7. ACCUSED DETAILS / குற்றவாளி விவரங்கள்"),
      FWRow("(1) Name / பெயர் :", "Unknown / தெரியாத நபர்"),
      LVRow("Gender / பாலினம் :", "", "Year of Birth :", ""),
      LVRow("Nationality :", "Indian", "Religion :", ""),
      LVRow("Caste / Tribe :", "", "SC/ST/OBC :", ""),
      LVRow("Occupation :", "", "Language :", ""),
      FWRow("Address :", ""),
      FWRow("Physical Features / உடல் அம்சங்கள் :", fir.suspectDescription || "Not identified"),

      // === SECTION 8: DELAY ===
      SectionHeader("8. REASON FOR DELAY IN REPORTING"),
      FWRow("", fir.delayReason || "Reported promptly / No delay"),

      // === SECTION 9: STOLEN PROPERTY ===
      SectionHeader("9. PARTICULARS OF PROPERTIES STOLEN / திருடப்பட்ட சொத்து விவரம்"),
      FWRow("", fir.stolenItems || "Nil"),
      SectionHeader("10. TOTAL VALUE / மொத்த மதிப்பு"),
      FWRow("", fir.stolenValue || "Not estimated"),

      // === SECTION 11: INQUEST ===
      SectionHeader("11. INQUEST REPORT / U.D. CASE NO."),
      FWRow("", "N/A"),

      // === SECTION 12: FIR CONTENTS ===
      SectionHeader("12. FIRST INFORMATION CONTENTS / முதல் தகவல் அறிக்கை உள்ளடக்கம்"),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 4,
            children: [
              new Paragraph({
                children: [new TextRun({
                  text: `Crime Type: ${fir.crimeType || ""}\n\n` +
                        `${fir.incidentDescription || fir.transcribedText || ""}\n\n` +
                        `Stolen Items: ${fir.stolenItems || "Nil"}\n` +
                        `Weapon Used: ${fir.weaponUsed || "Nil"}\n` +
                        `Vehicle: ${fir.vehicleNumber || "Nil"}\n` +
                        `Witnesses: ${fir.witnessNames || "Nil"}\n` +
                        `GPS: ${fir.incidentLatitude || ""}, ${fir.incidentLongitude || ""}`,
                  size: 18,
                })],
              }),
            ],
          }),
        ],
      }),

      // === SECTION 13: ACTION TAKEN ===
      SectionHeader("13. ACTION TAKEN / எடுக்கப்பட்ட நடவடிக்கை"),
      FWRow("(1)", "Registered case & took up investigation / வழக்கு பதிவு செய்து விசாரணை தொடங்கப்பட்டது"),
      LVRow("(2) IO Name :", fir.officerName || "Inspector (Auto-assigned)", "Rank & No. :", fir.officerRank || "Inspector"),
      FWRow("(3) Refused investigation due to :", "N/A"),
      LVRow("(4) Transferred to P.S. :", "", "District :", ""),

      // === SECTION 14 & 15: SIGNATURES ===
      SectionHeader("14. SIGNATURES / கையொப்பங்கள்"),
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            children: [
              new Paragraph({ children: [new TextRun({ text: "Complainant Signature / Thumb Impression:", bold: true, size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: `Name: ${fir.complainantName || ""}`, size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: `Date: ${now.toLocaleDateString("en-IN")}`, size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: "\n\n_______________________________", size: 18 })] }),
            ],
          }),
          new TableCell({
            columnSpan: 2,
            children: [
              new Paragraph({ children: [new TextRun({ text: "Officer in Charge Signature:", bold: true, size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: `Name: ${fir.officerName || "Inspector"}`, size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: `Rank: ${fir.officerRank || "Inspector"}`, size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: "Seal: ___________", size: 18 })] }),
              new Paragraph({ children: [new TextRun({ text: "\n\n_______________________________", size: 18 })] }),
            ],
          }),
        ],
      }),
      LVRow("15. Date & Time of Despatch to Court :", "", "", ""),
      FWRow(
        "FIR read over, admitted correctly recorded & copy given to complainant free of cost. R.O.A.C.",
        "", false
      ),
      FWRow(`CCTNS - Crime and Criminal Tracking Network & Systems  |  ${state} Police`, "", false),
    ],
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [table],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `FIR_${fir.id || "DRAFT"}_${state.replace(/ /g, "_")}_${now.toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
  return filename;
}

// Helper for distance calculation used inside generateFIRDocx
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═════════════════════════════════════════════════════════════════════════════
// FIRDownload Component
// ═════════════════════════════════════════════════════════════════════════════

export default function FIRDownload({ fir, location }) {
  const [step,           setStep]           = useState(1); // 1=state, 2=station, 3=download
  const [selectedState,  setSelectedState]  = useState("");
  const [stateSearch,    setStateSearch]    = useState("");
  const [selectedStation,setSelectedStation]= useState(null);
  const [nearbyStations, setNearbyStations] = useState([]);
  const [allStateStations,setAllStateStations]=useState([]);
  const [stationSearch,  setStationSearch]  = useState("");
  const [gpsDetecting,   setGpsDetecting]   = useState(false);
  const [generating,     setGenerating]     = useState(false);
  const [downloaded,     setDownloaded]     = useState(false);
  const [error,          setError]          = useState("");

  // Auto-detect state from FIR location
  useEffect(() => {
    const state = fir?.locationState || location?.state;
    if (state && ALL_STATES.includes(state)) {
      setSelectedState(state);
      setStep(2);
    }
  }, [fir, location]);

  // Load stations when state selected
  useEffect(() => {
    if (!selectedState) return;
    const stations = getStationsByState(selectedState);
    setAllStateStations(stations);

    // If we have GPS, load nearby too
    const lat = fir?.incidentLatitude || location?.latitude;
    const lng = fir?.incidentLongitude || location?.longitude;
    if (lat && lng) {
      const nearby = getNearbyStations(lat, lng, 100, 5).filter(
        (s) => s.state === selectedState
      );
      setNearbyStations(nearby);
    }
  }, [selectedState, fir, location]);

  // GPS detect state
  const detectFromGPS = () => {
    setGpsDetecting(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const nearby = getNearbyStations(latitude, longitude, 200, 5);
        setNearbyStations(nearby);
        if (nearby[0]) {
          setSelectedState(nearby[0].state);
          setStep(2);
        }
        setGpsDetecting(false);
      },
      () => setGpsDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Handle download
  const handleDownload = async () => {
    setGenerating(true);
    setError("");
    try {
      const filename = await generateFIRDocx(fir, selectedStation, selectedState);
      setDownloaded(true);
      setStep(3);
    } catch (e) {
      console.error(e);
      setError(`Download failed: ${e.message}. Make sure npm install docx file-saver is done.`);
    } finally {
      setGenerating(false);
    }
  };

  const filteredStates = ALL_STATES.filter((s) =>
    s.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const filteredStations = (stationSearch
    ? allStateStations.filter((s) =>
        s.name.toLowerCase().includes(stationSearch.toLowerCase()) ||
        s.district.toLowerCase().includes(stationSearch.toLowerCase())
      )
    : allStateStations
  ).slice(0, 20);

  return (
    <div className="space-y-4">

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {["Select State", "Choose Station", "Download FIR"].map((label, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              step > i + 1 ? "bg-green-500 text-white" :
              step === i + 1 ? "bg-blue-600 text-white" :
              "bg-gray-200 text-gray-500"
            }`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium truncate ${step === i + 1 ? "text-blue-700" : "text-gray-400"}`}>
              {label}
            </span>
            {i < 2 && <div className="flex-1 h-0.5 bg-gray-200 rounded-full ml-1" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: State Selection ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              Select Your State
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              FIR will be generated in your state's official bilingual format
            </p>
          </div>

          {/* GPS detect */}
          <button
            onClick={detectFromGPS}
            disabled={gpsDetecting}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-medium hover:bg-green-100 transition"
          >
            <Navigation className="h-4 w-4 shrink-0" />
            {gpsDetecting ? "Detecting your state…" : "📍 Auto-detect state from GPS"}
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={stateSearch}
              onChange={(e) => setStateSearch(e.target.value)}
              placeholder="Search state…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* State grid */}
          <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {filteredStates.map((state) => (
              <button
                key={state}
                onClick={() => { setSelectedState(state); setStep(2); }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all ${
                  selectedState === state
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-blue-300"
                }`}
              >
                <span className="text-lg shrink-0">{STATE_EMOJI[state] || "🏛️"}</span>
                <span className="text-xs font-semibold text-gray-800 leading-tight">{state}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Police Station Selection ───────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600" />
                Choose Police Station
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {STATE_EMOJI[selectedState]} {selectedState} — select your preferred PS
              </p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-blue-600 underline">
              Change State
            </button>
          </div>

          {/* Nearby stations (GPS-based) */}
          {nearbyStations.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1.5">
                📍 Nearest to you
              </p>
              <div className="space-y-1.5">
                {nearbyStations.map((ps) => (
                  <button
                    key={ps.id}
                    onClick={() => setSelectedStation(ps)}
                    className={`w-full text-left p-2.5 rounded-xl border-2 transition-all ${
                      selectedStation?.id === ps.id
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{ps.name}</p>
                        <p className="text-xs text-gray-500">{ps.district} · {ps.phone}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                          {ps.distanceKm?.toFixed(1)} km
                        </span>
                        {selectedStation?.id === ps.id && (
                          <CheckCircle className="h-4 w-4 text-blue-600 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All stations in state (searchable) */}
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              All stations in {selectedState}
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                placeholder="Search by name or district…"
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredStations.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No stations found. Try a different search.
                </p>
              )}
              {filteredStations.map((ps) => (
                <button
                  key={ps.id}
                  onClick={() => setSelectedStation(ps)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                    selectedStation?.id === ps.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-100 bg-gray-50 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{ps.name}</p>
                      <p className="text-[10px] text-gray-500">{ps.district}</p>
                    </div>
                    {selectedStation?.id === ps.id && (
                      <CheckCircle className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Proceed button */}
          <Button
            full
            onClick={() => setStep(3)}
            disabled={!selectedStation}
          >
            <ChevronRight className="h-4 w-4" />
            Proceed to Download
          </Button>

          {!selectedStation && (
            <p className="text-xs text-center text-gray-400">
              Select a police station to continue
            </p>
          )}
        </div>
      )}

      {/* ── STEP 3: Download ────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Download className="h-4 w-4 text-blue-600" />
            Download Official FIR
          </h3>

          {/* Summary card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1.5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">FIR Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-blue-800">
              <p>🆔 <strong>FIR ID:</strong> {fir?.id || "Auto"}</p>
              <p>🗺️ <strong>State:</strong> {selectedState}</p>
              <p>🏛️ <strong>Station:</strong> {selectedStation?.name}</p>
              <p>📍 <strong>District:</strong> {selectedStation?.district}</p>
              <p>⚖️ <strong>BNS:</strong> {fir?.ipcSections?.map(s => `§${s}`).join(", ") || "N/A"}</p>
              <p>🚨 <strong>Crime:</strong> {fir?.crimeType || "N/A"}</p>
            </div>
          </div>

          {/* Template info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <span>
              Template: <strong>{STATE_TEMPLATES[selectedState]}</strong> ·
              NCRB I.I.F.-I Format · Bilingual
            </span>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Download button */}
          {!downloaded ? (
            <Button full onClick={handleDownload} disabled={generating} variant="success">
              {generating
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating DOCX…</>
                : <><Download className="h-4 w-4" /> Download {selectedState} FIR (.docx)</>}
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 font-medium text-sm">
                <CheckCircle className="h-5 w-5" />
                ✅ FIR downloaded successfully!
              </div>
              <Button variant="outline" full onClick={handleDownload} disabled={generating}>
                <Download className="h-4 w-4" /> Download Again
              </Button>
            </div>
          )}

          <button
            onClick={() => { setStep(2); setDownloaded(false); }}
            className="text-xs text-gray-400 underline w-full text-center"
          >
            ← Change station
          </button>
        </div>
      )}
    </div>
  );
}