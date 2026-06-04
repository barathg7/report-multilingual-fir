import { useState, useRef, useCallback } from "react";
import { Mic, User, Shield, MapPin, Camera, CheckCircle, FileText } from "lucide-react";
import StepBar from "@/components/ui/StepBar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import VoiceRecorder from "@/components/kavalan/VoiceRecorder";
import LocationCapture from "@/components/kavalan/LocationCapture";
import PhotoUpload from "@/components/kavalan/PhotoUpload";
import SuspectSketch from "@/components/kavalan/SuspectSketch";
import FIRDocument from "@/components/kavalan/FIRDocument";
import FIRDownload from "@/components/kavalan/FIRDownload";
import { useFIRStore } from "@/hooks/useFIRStore";
import { getNearbyStations } from "@/utils/policeStations";
import { suggestIPCSections, validateIPCSections } from "@/utils/bnsValidator";
import { generateFIRId } from "@/utils";

const STEPS = [
  { label: "Language", icon: Mic      },
  { label: "Record",   icon: Mic      },
  { label: "Details",  icon: User     },
  { label: "Incident", icon: Shield   },
  { label: "Location", icon: MapPin   },
  { label: "Evidence", icon: Camera   },
  { label: "FIR",      icon: FileText },
];

const LANGUAGES = [
  { code: "ta",  name: "Tamil",      native: "தமிழ்",           flag: "🇮🇳", group: "Indian" },
  { code: "hi",  name: "Hindi",      native: "हिन्दी",           flag: "🇮🇳", group: "Indian" },
  { code: "en",  name: "English",    native: "English",           flag: "🇬🇧", group: "Indian" },   // English is widely used in India
  { code: "te",  name: "Telugu",     native: "తెలుగు",           flag: "🇮🇳", group: "Indian" },
  { code: "kn",  name: "Kannada",    native: "ಕನ್ನಡ",            flag: "🇮🇳", group: "Indian" },
  { code: "ml",  name: "Malayalam",  native: "മലയാളം",           flag: "🇮🇳", group: "Indian" },
  { code: "mr",  name: "Marathi",    native: "मराठी",            flag: "🇮🇳", group: "Indian" },
  { code: "bn",  name: "Bengali",    native: "বাংলা",            flag: "🇮🇳", group: "Indian" },
  { code: "gu",  name: "Gujarati",   native: "ગુજરાતી",          flag: "🇮🇳", group: "Indian" },
  { code: "pa",  name: "Punjabi",    native: "ਪੰਜਾਬੀ",          flag: "🇮🇳", group: "Indian" },
  { code: "ur",  name: "Urdu",       native: "اردو",             flag: "🇮🇳", group: "Indian" },
  { code: "or",  name: "Odia",       native: "ଓଡ଼ିଆ",           flag: "🇮🇳", group: "Indian" },
  { code: "as",  name: "Assamese",   native: "অসমীয়া",          flag: "🇮🇳", group: "Indian" },
  { code: "mai", name: "Maithili",   native: "मैथिली",           flag: "🇮🇳", group: "Indian" },
  { code: "ks",  name: "Kashmiri",   native: "کٲشُر",            flag: "🇮🇳", group: "Indian" },
  { code: "sd",  name: "Sindhi",     native: "سنڌي",             flag: "🇮🇳", group: "Indian" },
  { code: "sat", name: "Santali",    native: "ᱥᱟᱱᱛᱟᱲᱤ",         flag: "🇮🇳", group: "Indian" },
  { code: "ne",  name: "Nepali",     native: "नेपाली",           flag: "🇮🇳", group: "Indian" },
  { code: "kok", name: "Konkani",    native: "कोंकणी",           flag: "🇮🇳", group: "Indian" },
  { code: "mni", name: "Manipuri",   native: "মৈতৈলোন্",        flag: "🇮🇳", group: "Indian" },
  { code: "doi", name: "Dogri",      native: "डोगरी",            flag: "🇮🇳", group: "Indian" },
  { code: "sa",  name: "Sanskrit",   native: "संस्कृतम्",        flag: "🇮🇳", group: "Indian" },

  // Tourist / Foreign Languages — Focused on languages most used by people visiting India
  { code: "zh",  name: "Mandarin",   native: "中文",              flag: "🇨🇳", group: "Tourist" },
  { code: "yue", name: "Cantonese",  native: "粵語",              flag: "🇭🇰", group: "Tourist" },
  { code: "ar",  name: "Arabic",     native: "العربية",          flag: "🇸🇦", group: "Tourist" },
  { code: "fr",  name: "French",     native: "Français",          flag: "🇫🇷", group: "Tourist" },
  { code: "de",  name: "German",     native: "Deutsch",           flag: "🇩🇪", group: "Tourist" },
  { code: "es",  name: "Spanish",    native: "Español",           flag: "🇪🇸", group: "Tourist" },
  { code: "pt",  name: "Portuguese", native: "Português",         flag: "🇵🇹", group: "Tourist" },
  { code: "it",  name: "Italian",    native: "Italiano",          flag: "🇮🇹", group: "Tourist" },
  { code: "ru",  name: "Russian",    native: "Русский",           flag: "🇷🇺", group: "Tourist" },
  { code: "ja",  name: "Japanese",   native: "日本語",            flag: "🇯🇵", group: "Tourist" },
  { code: "ko",  name: "Korean",     native: "한국어",            flag: "🇰🇷", group: "Tourist" },
  { code: "th",  name: "Thai",       native: "ภาษาไทย",          flag: "🇹🇭", group: "Tourist" },
  { code: "vi",  name: "Vietnamese", native: "Tiếng Việt",        flag: "🇻🇳", group: "Tourist" },
  { code: "id",  name: "Indonesian", native: "Bahasa Indonesia",  flag: "🇮🇩", group: "Tourist" },
  { code: "tr",  name: "Turkish",    native: "Türkçe",            flag: "🇹🇷", group: "Tourist" },
  { code: "fa",  name: "Persian",    native: "فارسی",             flag: "🇮🇷", group: "Tourist" },
];

const CRIME_TYPES = [
  "Theft","Robbery","Chain Snatching","Burglary","House Breaking",
  "Assault","Grievous Hurt","Acid Attack","Murder","Attempt to Murder",
  "Rape","Sexual Assault","Molestation","Stalking","Eve Teasing",
  "Kidnapping","Abduction","Fraud","Cheating","Online Fraud","Cybercrime",
  "Domestic Violence","Dowry Harassment","Dowry Death",
  "Vandalism","Mischief","Trespass","Dacoity","Rioting",
  "Criminal Intimidation","Defamation","Other",
];

const EMPTY_FORM = {
  complainantName:"", complainantAge:"", complainantGender:"",
  complainantPhone:"", complainantAddress:"",
  incidentDate:"", incidentTime:"", incidentLocation:"",
  incidentDescription:"", crimeType:"", ipcSections:[],
  suspectDescription:"", stolenItems:"", weaponUsed:"",
  vehicleNumber:"", witnessNames:"",
  locationLandmarks:"", locationArea:"", locationCity:"",
  locationState:"", locationSearchQuery:"", nearestLandmark:"",
  fullLocationDescription:"",
};

// ── ADDED: Convert YYYY-MM-DD → readable "DD MMM YYYY" for previews ──
// form.incidentDate is stored as "YYYY-MM-DD" (HTML input format).
// Showing it raw in the preview looks like "2026-04-01" which is ugly.
// This helper converts it to "01 Apr 2026" for display only.
function formatDateForDisplay(yyyymmdd) {
  if (!yyyymmdd || typeof yyyymmdd !== "string") return yyyymmdd;
  const parts = yyyymmdd.split("-");
  if (parts.length !== 3) return yyyymmdd;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [yyyy, mm, dd] = parts;
  const monthIdx = parseInt(mm, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return yyyymmdd;
  return `${dd} ${months[monthIdx]} ${yyyy}`;
}

// ── ADDED: Convert "HH:MM" → "H:MM AM/PM" for previews ──────────────
// form.incidentTime is stored as "19:00" (HTML input format).
// This helper converts it to "7:00 PM" for display only.
function formatTimeForDisplay(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return hhmm;
  const parts = hhmm.split(":");
  if (parts.length < 2) return hhmm;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const period = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

export default function RecordStatement() {
  const [step, setStep]             = useState(0);
  const [lang, setLang]             = useState(null);
  const [langSearch, setLangSearch] = useState("");
  const [transcript, setTranscript] = useState("");
  const [location, setLocation]     = useState(null);
  const [photos, setPhotos]         = useState([]);
  const [sketch, setSketch]         = useState(null);
  const [submitted, setSubmitted]       = useState(false);
  const [firData, setFirData]           = useState(null);
  const [duplicateWarning, setDupWarn]  = useState(null);
  const [submitting, setSubmitting]     = useState(false);
  const [ipcInput, setIpcInput]     = useState("");
  const [ipcValidation, setIpcValidation] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);

  // Ref stores the latest extracted data synchronously — avoids stale closure issues
  const extractedRef = useRef(null);

  const { saveFIR, isOnline, checkDuplicate } = useFIRStore();

  // Load citizen email from session (set during CitizenLogin OTP verification)
  const citizenEmail = (() => {
    try { return JSON.parse(sessionStorage.getItem("citizen_user") || "{}").email || ""; }
    catch { return ""; }
  })();

  const upd = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const addIPC = (s) => {
    const sec = [...new Set([...form.ipcSections, s.trim()])];
    upd("ipcSections", sec);
    setIpcValidation(validateIPCSections(sec));
    setIpcInput("");
  };

  const removeIPC = (s) => {
    const sec = form.ipcSections.filter(x => x !== s);
    upd("ipcSections", sec);
    setIpcValidation(sec.length ? validateIPCSections(sec) : null);
  };

  const autoSuggest = (text) => {
    upd("incidentDescription", text);
    if (text.length > 30) {
      const suggestions = suggestIPCSections(text).slice(0, 5).map(s => s.section);
      upd("ipcSections", suggestions);
      setIpcValidation(validateIPCSections(suggestions));
    }
  };

  // ── KEY FIX: handleVoiceComplete ─────────────────────────────────
  // The extracted data arrives here synchronously from VoiceRecorder.
  // We store it in a ref immediately, then apply to form in one atomic setState.
  const handleVoiceComplete = useCallback(({ text, extracted }) => {
    // 1. Capture in ref immediately (bypasses React batching)
    if (extracted && Object.keys(extracted).length > 0) {
      extractedRef.current = extracted;
    }

    // 2. Update transcript text
    setTranscript(text || "");

    // 3. Apply ALL extracted fields atomically in a single setState
    setForm(prev => {
      const e = extractedRef.current || {};

      // Helper: use extracted value only if it's a non-empty string
      const pick = (extracted, fallback) =>
        extracted && String(extracted).trim() ? String(extracted).trim() : fallback;

      return {
        ...prev,
        // Complainant
        complainantName:         pick(e.complainantName,         prev.complainantName),
        complainantPhone:        pick(e.complainantPhone,        prev.complainantPhone),
        complainantAge:          pick(e.complainantAge,          prev.complainantAge),
        complainantGender:       pick(e.complainantGender,       prev.complainantGender),
        complainantAddress:      pick(e.complainantAddress,      prev.complainantAddress),
        // Incident — date/time already in HTML format (YYYY-MM-DD / HH:MM)
        // because VoiceRecorder.normalizeExtracted() converted them
        incidentDate:            pick(e.incidentDate,            prev.incidentDate),
        incidentTime:            pick(e.incidentTime,            prev.incidentTime),
        incidentLocation:        pick(e.incidentLocation,        prev.incidentLocation),
        crimeType:               pick(e.crimeType,               prev.crimeType),
        incidentDescription:     text && text.trim() ? text.trim() : prev.incidentDescription,
        suspectDescription:      pick(e.suspectDescription,      prev.suspectDescription),
        stolenItems:             pick(e.stolenItems,             prev.stolenItems),
        weaponUsed:              pick(e.weaponUsed,              prev.weaponUsed),
        vehicleNumber:           pick(e.vehicleNumber,           prev.vehicleNumber),
        witnessNames:            pick(e.witnessNames,            prev.witnessNames),
        // Location
        locationLandmarks:       pick(e.locationLandmarks,       prev.locationLandmarks),
        nearestLandmark:         pick(e.nearestLandmark,         prev.nearestLandmark),
        locationArea:            pick(e.locationArea,            prev.locationArea),
        locationCity:            pick(e.locationCity,            prev.locationCity),
        locationState:           pick(e.locationState,           prev.locationState),
        locationSearchQuery:     pick(e.locationSearchQuery,     prev.locationSearchQuery),
        fullLocationDescription: pick(e.fullLocationDescription, prev.fullLocationDescription),
        // IPC sections — only replace if we got new ones
        ipcSections: (e.ipcSections?.length > 0) ? e.ipcSections : prev.ipcSections,
      };
    });

    // 4. Update IPC validation
    if (extracted?.ipcSections?.length) {
      setIpcValidation(validateIPCSections(extracted.ipcSections));
    }
  }, []); // No dependencies — uses ref for extracted, setters are stable

  const canProceed = () => {
    if (step === 0) return !!lang;
    if (step === 1) return !!(transcript || form.incidentDescription);
    if (step === 2) return !!(form.complainantName && form.complainantPhone);
    if (step === 3) return !!(form.incidentDate && form.incidentDescription);
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // ✅ Duplicate check — prevent re-filing same complaint
      if (form.complainantPhone && form.incidentDate) {
        const { isDuplicate, existingId } = await checkDuplicate(form.complainantPhone, form.incidentDate);
        if (isDuplicate) {
          setDupWarn(existingId);
          setSubmitting(false);
          return;
        }
      }

      // ✅ Find nearest police station from GPS (for station isolation)
      const incLat  = location?.latitude  || null;
      const incLng  = location?.longitude || null;
      const incState = location?.state || form.locationState || "";
      let stationCode = "", stationName = "", stationId = "";
      if (incLat && incLng) {
        const nearby = getNearbyStations(incLat, incLng, 50, 1);
        if (nearby.length > 0) {
          stationCode = nearby[0].code || nearby[0].id || "";
          stationName = nearby[0].name || "";
          stationId   = nearby[0].id   || "";
        }
      }

      const fir = {
        ...form,
        id:                generateFIRId(),
        language:          lang?.name,
        transcribedText:   transcript,
        incidentLatitude:  incLat,
        incidentLongitude: incLng,
        locationAddress:   location?.displayName || location?.address,
        locationRoad:      location?.road,
        locationSuburb:    location?.suburb,
        locationCity:      location?.city || form.locationCity,
        locationState:     incState,
        locationPostcode:  location?.postcode,
        evidencePhotos:    photos.map(p => p.url || p),
        suspectSketchUrl:  sketch?.url || "",          // ✅ sketch URL
        ipcValidated:      ipcValidation?.isValid || false,
        // ✅ Station assignment — enables station isolation in police dashboard
        stationCode,
        stationName,
        stationId,
        selectedState:     incState,
        status:            "submitted",
        createdAt:         new Date().toISOString(),
        complainantEmail:  citizenEmail,   // from CitizenLogin session
      };
      const saved = await saveFIR(fir);
      setFirData(saved || fir);
      setSubmitted(true);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setStep(0); setSubmitted(false); setTranscript("");
    setLang(null); setLangSearch(""); setLocation(null);
    setPhotos([]); setSketch(null); setFirData(null);
    setForm(EMPTY_FORM); setIpcValidation(null);
    extractedRef.current = null;
  };

  const filteredLangs = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.native.includes(langSearch)
  );
  const indianLangs  = filteredLangs.filter(l => l.group === "Indian");
  const touristLangs = filteredLangs.filter(l => l.group === "Tourist");

  // ── Step renderers ────────────────────────────────────────────────
  const renderStep = () => {

    /* STEP 0 — Language */
    if (step === 0) return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Select Your Language</h2>
          <p className="text-sm text-gray-500 mt-1">மொழியை தேர்ந்தெடுக்கவும் · Choose your language · अपनी भाषा चुनें</p>
        </div>
        <input
          type="text"
          value={langSearch}
          onChange={e => setLangSearch(e.target.value)}
          placeholder="🔍 Search language... (Tamil, French, Korean, Arabic...)"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {indianLangs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🇮🇳 22 Official Indian Languages</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {indianLangs.map(l => (
                <button key={l.code} onClick={() => setLang(l)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    lang?.code === l.code
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}>
                  <p className="text-sm font-bold text-gray-800">{l.native}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {touristLangs.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">🌍 Tourist / Foreign Languages (28)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {touristLangs.map(l => (
                <button key={l.code} onClick={() => setLang(l)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    lang?.code === l.code
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-300"
                  }`}>
                  <p className="text-sm font-bold text-gray-800">{l.flag} {l.native}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {lang && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-sm text-blue-700">✅ Selected: <strong>{lang.native}</strong> ({lang.name})</p>
          </div>
        )}
      </div>
    );

    /* STEP 1 — Voice Recording */
    if (step === 1) return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Record Your Statement</h2>
          <p className="text-sm text-gray-500 mt-1">
            Speak in <strong>{lang?.native}</strong> — AI extracts all details automatically
          </p>
        </div>

        <VoiceRecorder language={lang} onComplete={handleVoiceComplete} />

        {/* Live preview of extracted data
            CHANGED: use formatDateForDisplay / formatTimeForDisplay so the
            preview shows "01 Apr 2026 · 7:00 PM" instead of "2026-04-01 · 19:00" */}
        {form.complainantName && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
            <p className="text-xs font-bold text-green-700 uppercase">✅ Form auto-filled — tap Next to verify</p>
            {form.complainantName  && <p className="text-sm text-green-800">👤 <strong>Name:</strong> {form.complainantName}</p>}
            {form.complainantPhone && <p className="text-sm text-green-800">📞 <strong>Phone:</strong> {form.complainantPhone}</p>}
            {form.complainantAge   && <p className="text-sm text-green-800">🎂 <strong>Age:</strong> {form.complainantAge}</p>}
            {form.crimeType        && <p className="text-sm text-green-800">🚨 <strong>Crime:</strong> {form.crimeType}</p>}
            {form.incidentDate     && (
              <p className="text-sm text-green-800">
                📅 <strong>Date:</strong> {formatDateForDisplay(form.incidentDate)}
                {form.incidentTime ? ` · ${formatTimeForDisplay(form.incidentTime)}` : ""}
              </p>
            )}
            {form.incidentLocation && <p className="text-sm text-green-800">📍 <strong>Location:</strong> {form.incidentLocation}</p>}
            {form.ipcSections?.length > 0 && (
              <p className="text-sm text-green-800">⚖️ <strong>BNS:</strong> {form.ipcSections.map(s => `§${s}`).join(", ")}</p>
            )}
          </div>
        )}
      </div>
    );

    /* STEP 2 — Complainant Details */
    if (step === 2) return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Complainant Details</h2>
        <p className="text-sm text-gray-500">Auto-filled from voice — verify and correct if needed</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name *"
            value={form.complainantName}
            onChange={e => upd("complainantName", e.target.value)}
            placeholder="Your full name"
          />
          <Input
            label="Phone Number *"
            value={form.complainantPhone}
            onChange={e => upd("complainantPhone", e.target.value)}
            placeholder="10-digit mobile number"
          />
          <Input
            label="Age"
            value={form.complainantAge}
            onChange={e => upd("complainantAge", e.target.value)}
            placeholder="Your age"
          />
          <Select
            label="Gender"
            value={form.complainantGender}
            onChange={e => upd("complainantGender", e.target.value)}
            options={["Male", "Female", "Transgender", "Prefer not to say"]}
            placeholder="Select gender"
          />
          <div className="sm:col-span-2">
            <Input
              label="Home Address"
              value={form.complainantAddress}
              onChange={e => upd("complainantAddress", e.target.value)}
              placeholder="Your residential address"
            />
          </div>
        </div>
      </div>
    );

    /* STEP 3 — Incident & IPC */
    if (step === 3) return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Incident Details & BNS Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Date of Incident *" type="date" value={form.incidentDate} onChange={e => upd("incidentDate", e.target.value)} />
          <Input label="Time of Incident"   type="time" value={form.incidentTime} onChange={e => upd("incidentTime", e.target.value)} />
          <Select
            label="Crime Type"
            value={form.crimeType}
            onChange={e => upd("crimeType", e.target.value)}
            options={CRIME_TYPES}
            placeholder="Select crime type"
          />
          <Input label="Location / Area"      value={form.incidentLocation}  onChange={e => upd("incidentLocation", e.target.value)}  placeholder="Street, area, city" />
          <Input label="Stolen / Damaged Items" value={form.stolenItems}     onChange={e => upd("stolenItems", e.target.value)}        placeholder="Items stolen or damaged" />
          <Input label="Weapon Used (if any)" value={form.weaponUsed}        onChange={e => upd("weaponUsed", e.target.value)}         placeholder="Knife, rod, gun, etc." />
          <Input label="Vehicle Number"       value={form.vehicleNumber}     onChange={e => upd("vehicleNumber", e.target.value)}      placeholder="TN01AB1234" />
          <Input label="Witness Names"        value={form.witnessNames}      onChange={e => upd("witnessNames", e.target.value)}       placeholder="Names of witnesses" />
          <div className="sm:col-span-2">
            <Textarea
              label="Incident Description *"
              value={form.incidentDescription}
              onChange={e => autoSuggest(e.target.value)}
              rows={5}
              placeholder="Describe the incident in detail…"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Suspect Description"
              value={form.suspectDescription}
              onChange={e => upd("suspectDescription", e.target.value)}
              rows={3}
              placeholder="Physical appearance, clothing, age, height…"
            />
          </div>
        </div>

        {/* IPC Sections panel */}
        {form.ipcSections.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-700 flex items-center gap-1">
              <Shield className="h-4 w-4" /> BNS Sections — Auto-assigned by Groq AI
            </p>
            <div className="flex flex-wrap gap-2">
              {form.ipcSections.map(s => (
                <span key={s} className="inline-flex items-center gap-1 bg-white border border-blue-300 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                  BNS §{s}
                  <button onClick={() => removeIPC(s)} className="ml-1 text-blue-300 hover:text-red-500 font-bold">×</button>
                </span>
              ))}
            </div>
            {ipcValidation && (
              <p className={`text-xs font-medium ${ipcValidation.isValid ? "text-green-600" : "text-amber-600"}`}>
                {ipcValidation.isValid ? "✅ All sections verified" : `⚠️ ${ipcValidation.summary}`}
              </p>
            )}
          </div>
        )}

        {/* Manual IPC entry */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add BNS Section Manually</label>
          <div className="flex gap-2">
            <Input
              value={ipcInput}
              onChange={e => setIpcInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ipcInput && addIPC(ipcInput)}
              placeholder="e.g. 302, 376, 420, 498A"
            />
            <Button variant="outline" onClick={() => ipcInput && addIPC(ipcInput)}>Add</Button>
          </div>
        </div>
      </div>
    );

    /* STEP 4 — Location */
    if (step === 4) return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Crime Scene Location</h2>
        {(form.nearestLandmark || form.locationLandmarks || form.locationCity) && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-1">
            <p className="text-xs font-semibold text-blue-700">🎙️ Voice-described location — map will auto-search:</p>
            {form.nearestLandmark   && <p className="text-sm text-blue-800">🏛️ Nearest: {form.nearestLandmark}</p>}
            {form.locationLandmarks && <p className="text-sm text-blue-800">📌 Landmarks: {form.locationLandmarks}</p>}
            {form.locationArea      && <p className="text-sm text-blue-800">🗺️ Area: {form.locationArea}</p>}
            {form.locationCity      && <p className="text-sm text-blue-800">🏙️ City: {form.locationCity}</p>}
          </div>
        )}
        <LocationCapture
          onLocationCaptured={setLocation}
          initialLandmarks={
            form.locationSearchQuery ||
            form.nearestLandmark     ||
            form.locationLandmarks   ||
            form.incidentLocation
          }
        />
      </div>
    );

    /* STEP 5 — Evidence */
    if (step === 5) return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">Evidence & Suspect Sketch</h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <PhotoUpload onPhotosUpdated={setPhotos} />
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <SuspectSketch onSketchGenerated={setSketch} initialDescription={form.suspectDescription} />
        </div>
      </div>
    );

    /* STEP 6 — Review & Submit */
    if (step === 6) return submitted ? (
      <div className="text-center space-y-6 py-8">
        <div className="flex justify-center">
          <div className="bg-green-100 rounded-full p-6">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">FIR Submitted!</h2>
          <p className="text-gray-500 mt-1">உங்கள் புகார் பதிவு செய்யப்பட்டது</p>
          <div className="inline-block mt-3 bg-blue-50 border border-blue-200 rounded-xl px-6 py-2">
            <p className="text-sm font-mono font-bold text-blue-700">{firData?.id}</p>
          </div>
          {!isOnline && <p className="text-xs text-amber-600 mt-2">⚠️ Saved locally — syncs when online</p>}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-left">
          <FIRDocument fir={firData} />
        </div>

        {/* DOCX Download — state-specific template */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-left">
          <p className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            📄 Download Official State FIR (DOCX)
          </p>
          <FIRDownload fir={firData} location={location} />
        </div>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button onClick={() => window.location.href = "/#/fir-history"}>View FIR History</Button>
          <Button variant="outline" onClick={resetAll}>File Another FIR</Button>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Review & Submit FIR</h2>
        <p className="text-sm text-gray-500">Verify all details before submitting</p>
        <div className="bg-white border border-gray-200 rounded-2xl divide-y text-sm">
          {[
            ["Language",    lang?.name],
            ["Name",        form.complainantName],
            ["Phone",       form.complainantPhone],
            ["Age/Gender",  [form.complainantAge, form.complainantGender].filter(Boolean).join(" / ")],
            ["Address",     form.complainantAddress],
            ["Crime Type",  form.crimeType],
            // CHANGED: show readable date/time in the review panel too
            ["Date",        formatDateForDisplay(form.incidentDate)],
            ["Time",        formatTimeForDisplay(form.incidentTime)],
            ["Location",    form.incidentLocation],
            ["Landmarks",   form.locationLandmarks],
            ["City",        [form.locationArea, form.locationCity].filter(Boolean).join(", ")],
            ["GPS",         location ? `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}` : "Not captured"],
            ["Address",     location?.displayName],
            ["Stolen",      form.stolenItems],
            ["Weapon",      form.weaponUsed],
            ["Vehicle",     form.vehicleNumber],
            ["Witnesses",   form.witnessNames],
            ["BNS",         form.ipcSections.map(s => `§${s}`).join(", ") || "None"],
            ["Photos",      `${photos.length} attached`],
            ["Sketch",      sketch ? "✅ Generated" : "Not generated"],
          ].map(([label, value]) => value ? (
            <div key={label} className="flex px-4 py-2.5 gap-3">
              <span className="text-gray-500 font-medium w-28 shrink-0 text-xs">{label}</span>
              <span className="text-gray-800 text-xs break-words">{value}</span>
            </div>
          ) : null)}
        </div>
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            ⚠️ Offline — FIR saved locally, syncs when connected.
          </div>
        )}
        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-2">
            <p className="text-amber-800 font-semibold text-sm">⚠️ Duplicate FIR Detected</p>
            <p className="text-amber-700 text-xs">
              A complaint from this phone number for the same incident date already exists
              (ID: <strong>{duplicateWarning}</strong>). Filing a duplicate FIR may constitute
              misuse of the system and is punishable under IPC §182.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDupWarn(null)}
                className="flex-1 py-2 rounded-lg border border-amber-300 text-amber-700 text-xs font-medium">
                Cancel
              </button>
              <button onClick={async () => { setDupWarn(null); await handleSubmit(); }}
                className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold">
                File Anyway (Different Incident)
              </button>
            </div>
          </div>
        )}

        <Button full size="lg" variant="success" onClick={handleSubmit} disabled={submitting}>
          {submitting
            ? <><span className="animate-spin">⏳</span> Submitting…</>
            : <><CheckCircle className="h-5 w-5" /> Submit FIR Officially</>}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-bold text-blue-700">REPORT — New FIR</h1>
          <p className="text-xs text-gray-400">
            Step {step + 1}/{STEPS.length} · {isOnline ? "🟢 Online" : "🔴 Offline"}
          </p>
        </div>
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : window.history.back()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
      </div>

      <StepBar steps={STEPS} current={step} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 min-h-64">
          {renderStep()}
        </div>

        {!submitted && (
          <div className="flex items-center justify-between mt-5">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const draft = {
                    ...form,
                    id: generateFIRId(),
                    language: lang?.name,
                    status: "draft",
                    createdAt: new Date().toISOString(),
                  };
                  saveFIR(draft);
                  alert("Draft saved!");
                }}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Save Draft
              </button>
              {step < STEPS.length - 1 && (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
                  Next →
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}