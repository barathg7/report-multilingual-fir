import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic, User, Shield, MapPin, Camera, CheckCircle, FileText,
  Keyboard, Hand, ChevronRight, Globe2, Wifi, WifiOff,
  AlertTriangle, Info, BookOpen, FlaskConical, Check, Save,
  Sparkles, Pencil,
} from "lucide-react";
import StepBar from "@/components/ui/StepBar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import VoiceRecorder from "@/components/kavalan/VoiceRecorder";
import SignLanguageRecorder from "@/components/kavalan/SignLanguageRecorder";
import LocationCapture from "@/components/kavalan/LocationCapture";
import PhotoUpload from "@/components/kavalan/PhotoUpload";
import SuspectSketch from "@/components/kavalan/SuspectSketch";
import FIRDocument from "@/components/kavalan/FIRDocument";
import FIRDownload from "@/components/kavalan/FIRDownload";
import DigitalSignature from "@/components/kavalan/DigitalSignature";
import InputMethodSelector from "@/components/fir/InputMethodSelector";
import ProvenanceBadge from "@/components/fir/ProvenanceBadge";
import LegalSuggestionCard from "@/components/fir/LegalSuggestionCard";
import SubmissionSummary from "@/components/fir/SubmissionSummary";
import { normalizeFIR } from "@/lib/firSchema";
import { useFIRStore } from "@/hooks/useFIRStore";
import { getNearbyStations } from "@/utils/policeStations";
import { suggestIPCSections, validateIPCSections } from "@/utils/bnsValidator";
import { generateFIRId, generateUUID, generateSubmissionId, formatDateForDisplay, formatTimeForDisplay, parseItemsList } from "@/utils";

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

// Note: formatDateForDisplay and formatTimeForDisplay are imported from @/utils

// ── Module-scope layout helpers (outside component to prevent remounting) ──────
// FieldGroup: section divider with optional "Optional" badge.
// Defined at module scope so React does not recreate it on each render,
// which would cause child form inputs to unmount/remount and lose focus.
function FieldGroup({ title, optional = false, children }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          {optional && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Optional</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export default function RecordStatement() {
  const navigate = useNavigate();
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
  const [signature, setSignature]       = useState(null);
  const [declarationAgreed, setDeclarationAgreed] = useState(false);
  const [ipcInput, setIpcInput]     = useState("");
  const [ipcValidation, setIpcValidation] = useState(null);
  // Input mode for Step 1: voice | type | sign
  const [inputMode, setInputMode]   = useState("voice");

  // Ref stores the latest extracted data synchronously — avoids stale closure issues
  const extractedRef = useRef(null);

  const { saveFIR, isOnline, checkDuplicate } = useFIRStore();

  // Load citizen user from localStorage (or fallback to sessionStorage)
  const citizenUser = (() => {
    try {
      const raw = localStorage.getItem("citizen_user") || sessionStorage.getItem("citizen_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const citizenEmail = citizenUser?.email || "";

  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    complainantName: citizenUser?.name || "",
    complainantPhone: citizenUser?.phone || "",
    complainantEmail: citizenUser?.email || "",
  }));

  const [provenance, setProvenance] = useState({});
  const provenanceRef = useRef({});

  const upd = useCallback((field, value, source = "USER") => {
    setForm(prev => ({ ...prev, [field]: value }));
    const meta = {
      source,
      confidence: source === "USER" ? 1.0 : 0.85,
      editedByUser: source === "USER",
      verified: field === "complainantPhone" && (Boolean(citizenEmail) || provenanceRef.current[field]?.verified),
      lastUpdated: new Date().toISOString(),
    };
    provenanceRef.current[field] = meta;
    setProvenance(prev => ({ ...prev, [field]: meta }));
  }, [citizenEmail]);

  const addIPC = (s) => {
    const clean = s.trim().replace(/^§/, "");
    const sec = [...new Set([...form.ipcSections, clean])];
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

  // ── KEY FIX: handleVoiceComplete with User Edit Protection ────────────────
  const handleVoiceComplete = useCallback(({ text, rawText, extracted }) => {
    if (extracted && Object.keys(extracted).length > 0) {
      extractedRef.current = extracted;
    }

    setTranscript(text || rawText || "");

    setForm(prev => {
      const e = extractedRef.current || {};
      const next = { ...prev };
      const prov = { ...provenanceRef.current };

      const safeMerge = (field, extractedVal, currentVal) => {
        // Rule 1: User-edited value cannot be overwritten by later AI extraction
        if (prov[field]?.editedByUser) {
          return currentVal;
        }
        // Rule 2: OTP-verified phone cannot be overwritten by voice extraction
        if (field === "complainantPhone" && (prov[field]?.verified || Boolean(citizenEmail))) {
          return currentVal;
        }
        // Rule 3: Specialized handling for stolenItems list
        if (field === "stolenItems") {
          const items = parseItemsList(extractedVal);
          if (items.length > 0) {
            const meta = {
              source: "AI",
              confidence: e.confidence || 0.85,
              editedByUser: false,
              verified: false,
              lastUpdated: new Date().toISOString(),
            };
            prov[field] = meta;
            provenanceRef.current[field] = meta;
            return items.join(", ");
          }
          return currentVal;
        }
        // If extracted value is present
        if (extractedVal && String(extractedVal).trim()) {
          const meta = {
            source: "AI",
            confidence: e.confidence || 0.85,
            editedByUser: false,
            verified: false,
            lastUpdated: new Date().toISOString(),
          };
          prov[field] = meta;
          provenanceRef.current[field] = meta;
          return String(extractedVal).trim();
        }
        return currentVal;
      };

      next.complainantName         = safeMerge("complainantName",         e.complainantName,         prev.complainantName);
      next.complainantPhone        = safeMerge("complainantPhone",        e.complainantPhone,        prev.complainantPhone);
      next.complainantAge          = safeMerge("complainantAge",          e.complainantAge,          prev.complainantAge);
      next.complainantGender       = safeMerge("complainantGender",       e.complainantGender,       prev.complainantGender);
      next.complainantAddress      = safeMerge("complainantAddress",      e.complainantAddress,      prev.complainantAddress);

      next.incidentDate            = safeMerge("incidentDate",            e.incidentDate,            prev.incidentDate);
      next.incidentTime            = safeMerge("incidentTime",            e.incidentTime,            prev.incidentTime);
      next.incidentLocation        = safeMerge("incidentLocation",        e.incidentLocation,        prev.incidentLocation);
      next.crimeType               = safeMerge("crimeType",               e.crimeType,               prev.crimeType);

      if (text && text.trim() && !prov.incidentDescription?.editedByUser) {
        next.incidentDescription = text.trim();
        const descMeta = {
          source: "AI",
          confidence: 0.9,
          editedByUser: false,
          verified: false,
          lastUpdated: new Date().toISOString(),
        };
        prov.incidentDescription = descMeta;
        provenanceRef.current.incidentDescription = descMeta;
      }

      next.suspectDescription      = safeMerge("suspectDescription",      e.suspectDescription,      prev.suspectDescription);
      next.stolenItems             = safeMerge("stolenItems",             e.stolenItems,             prev.stolenItems);
      next.weaponUsed              = safeMerge("weaponUsed",              e.weaponUsed,              prev.weaponUsed);
      next.vehicleNumber           = safeMerge("vehicleNumber",           e.vehicleNumber,           prev.vehicleNumber);
      next.witnessNames            = safeMerge("witnessNames",            e.witnessNames,            prev.witnessNames);

      next.locationLandmarks       = safeMerge("locationLandmarks",       e.locationLandmarks,       prev.locationLandmarks);
      next.nearestLandmark         = safeMerge("nearestLandmark",         e.nearestLandmark,         prev.nearestLandmark);
      next.locationArea            = safeMerge("locationArea",            e.locationArea,            prev.locationArea);
      next.locationCity            = safeMerge("locationCity",            e.locationCity,            prev.locationCity);
      next.locationState           = safeMerge("locationState",           e.locationState,           prev.locationState);
      next.locationSearchQuery     = safeMerge("locationSearchQuery",     e.locationSearchQuery,     prev.locationSearchQuery);
      next.fullLocationDescription = safeMerge("fullLocationDescription", e.fullLocationDescription, prev.fullLocationDescription);

      // Rule 5: AI legal sections are suggestions only
      const incomingSections = e.ipcSections || e.legalSuggestions;
      if (incomingSections && incomingSections.length > 0) {
        const canonicalSuggestions = incomingSections.map(sec => {
          if (typeof sec === "object" && sec.section) return sec;
          const clean = String(sec).replace(/^§/, "").trim();
          return {
            act: "BNS 2023",
            section: clean,
            title: `BNS §${clean}`,
            explanation: "AI suggestion based on speech extraction",
            confidence: 0.85,
            source: "AI",
            verifiedByPolice: false,
            verifiedByOfficerBadge: null,
            verifiedAt: null,
          };
        });
        next.legalSuggestions = canonicalSuggestions;
        next.ipcSections = canonicalSuggestions.map(s => s.section);
      }

      setProvenance(prov);
      return next;
    });

    if (extracted?.ipcSections?.length) {
      setIpcValidation(validateIPCSections(extracted.ipcSections));
    }
  }, [citizenEmail]);

  const canProceed = () => {
    if (step === 0) return !!lang;
    if (step === 1) return !!(transcript || form.incidentDescription);
    if (step === 2) return !!(form.complainantName && form.complainantPhone);
    if (step === 3) return !!(form.incidentDate && form.incidentDescription);
    return true;
  };

  const handleSubmit = async () => {
    if (!declarationAgreed) {
      alert("Please review and agree to the statutory declaration before submitting.");
      return;
    }
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
      const incState = location?.state || form.locationState || "Tamil Nadu";
      let stationCode = "", stationName = "", stationId = "";
      if (incLat && incLng) {
        const nearby = getNearbyStations(incLat, incLng, 50, 1);
        if (nearby.length > 0) {
          stationCode = nearby[0].code || nearby[0].id || "";
          stationName = nearby[0].name || "";
          stationId   = nearby[0].id   || "";
        }
      }

      const rawFIR = {
        ...form,
        id:                (form.id && !form.id.startsWith("DRAFT-")) ? form.id : generateUUID(),
        submissionId:      isOnline ? null : generateSubmissionId({ state: incState, stationCode }),
        language:          lang?.name || "English",
        transcribedText:   transcript,
        incidentLatitude:  incLat,
        incidentLongitude: incLng,
        locationAddress:   location?.displayName || location?.address || form.incidentLocation,
        locationRoad:      location?.road,
        locationSuburb:    location?.suburb,
        locationCity:      location?.city || form.locationCity,
        locationState:     incState,
        locationPostcode:  location?.postcode,
        evidencePhotos:    photos.map(p => (typeof p === "string" ? p : p.dataUrl || p.url || "")).filter(Boolean),
        suspectSketchUrl:  sketch?.url || "",
        ipcValidated:      ipcValidation?.isValid || false,
        signatureDataUrl:  signature?.imageData || null,
        signatureDate:     signature?.signedAt || (signature ? new Date().toISOString() : null),
        stationCode,
        stationName,
        stationId,
        selectedState:     incState,
        status:            "submitted",
        createdAt:         new Date().toISOString(),
        complainantEmail:  citizenEmail,
      };

      const normalized = normalizeFIR(rawFIR);
      const saved = await saveFIR(normalized);
      setFirData(saved || normalized);
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
    setSignature(null); setDeclarationAgreed(false);
    setInputMode("voice");
    extractedRef.current = null;
  };

  // ── Sign Language confirmed text handler ────────────────────────────────────
  // Mirrors the data-integrity rules of handleVoiceComplete:
  //  - editedByUser fields are never overwritten
  //  - only sets incidentDescription if not already user-edited
  //  - provenance is sign_language_experimental (verified: false)
  //  - NEVER touches legalSuggestions, ipcSections, or BNS sections
  const handleSignConfirm = useCallback(({ text, provenance }) => {
    if (!text?.trim()) return;
    setTranscript(prev => prev ? prev + "\n\n" + text.trim() : text.trim());
    setForm(prev => {
      const prov = { ...provenanceRef.current };
      // Only set description if not already edited by user
      if (!prov.incidentDescription?.editedByUser) {
        const meta = { ...provenance, lastUpdated: new Date().toISOString() };
        prov.incidentDescription = meta;
        provenanceRef.current.incidentDescription = meta;
        setProvenance(p => ({ ...p, incidentDescription: meta }));
        return { ...prev, incidentDescription: text.trim() };
      }
      return prev;
    });
    setInputMode("voice"); // Return to voice mode after confirmation
  }, []);

  const filteredLangs = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.native.includes(langSearch)
  );
  const indianLangs  = filteredLangs.filter(l => l.group === "Indian");
  const touristLangs = filteredLangs.filter(l => l.group === "Tourist");



  const renderStep = () => {
    // ── Language selection handler (inside renderStep scope to avoid re-render issues) ──
    const handleSelectLanguage = (selectedLang) => {
      setLang(selectedLang);
      setStep(1); // Advance directly to next step upon language selection
    };


    /* ── STEP 0 — Language Selection ─────────────────────────────── */
    if (step === 0) return (
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Step 1 — Language</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Select Your Language</h2>
          <p className="text-sm text-slate-500">மொழியை தேர்ந்தெடுக்கவும் · Choose your language · अपनी भाषा चुनें</p>
          <p className="text-xs text-civic-blue-600 font-semibold">Click any language to proceed directly →</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Globe2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={langSearch}
            onChange={e => setLangSearch(e.target.value)}
            placeholder="Search language… (Tamil, French, Korean, Arabic…)"
            className="w-full border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-civic-blue-500 focus:border-civic-blue-400 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]"
            aria-label="Search for a language"
          />
        </div>

        {/* Indian Languages */}
        {indianLangs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">🇮🇳 22 Official Indian Languages</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {indianLangs.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`group p-3 rounded-xl border-2 text-center transition-all cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-blue-500 focus-visible:ring-offset-2
                    ${lang?.code === l.code
                      ? "border-civic-blue-500 bg-civic-blue-50 shadow-[0_2px_8px_-2px_rgba(29,78,216,0.18)]"
                      : "border-slate-200 bg-white hover:border-civic-blue-300 hover:bg-civic-blue-50/40 hover:-translate-y-0.5"
                    }`}
                  aria-pressed={lang?.code === l.code}
                >
                  {lang?.code === l.code && (
                    <div className="flex justify-end mb-0.5">
                      <Check className="h-3 w-3 text-civic-blue-600" aria-hidden="true" />
                    </div>
                  )}
                  <p className="text-sm font-bold text-civic-navy-900">{l.native}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tourist/Foreign Languages */}
        {touristLangs.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">🌍 International Languages (28)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {touristLangs.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`group p-3 rounded-xl border-2 text-center transition-all cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-civic-blue-500 focus-visible:ring-offset-2
                    ${lang?.code === l.code
                      ? "border-civic-blue-500 bg-civic-blue-50 shadow-[0_2px_8px_-2px_rgba(29,78,216,0.18)]"
                      : "border-slate-200 bg-white hover:border-civic-blue-300 hover:bg-civic-blue-50/40 hover:-translate-y-0.5"
                    }`}
                  aria-pressed={lang?.code === l.code}
                >
                  {lang?.code === l.code && (
                    <div className="flex justify-end mb-0.5">
                      <Check className="h-3 w-3 text-civic-blue-600" aria-hidden="true" />
                    </div>
                  )}
                  <p className="text-sm font-bold text-civic-navy-900">{l.flag} {l.native}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected language confirm strip */}
        {lang && (
          <div className="flex items-center justify-between gap-3 p-3 bg-civic-blue-50 border border-civic-blue-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-civic-blue-600 shrink-0" aria-hidden="true" />
              <p className="text-sm text-civic-blue-800 font-semibold">
                {lang.native} <span className="font-normal text-civic-blue-600">({lang.name}) selected</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-civic-blue-700 hover:bg-civic-blue-800 px-3 py-1.5 rounded-lg transition-colors min-h-[36px]"
            >
              Continue <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    );

    /* ── STEP 1 — Statement Input ────────────────────────────────── */
    if (step === 1) return (
      <div className="space-y-5">
        {/* Step header */}
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 2 — Record Statement</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Record Your Statement</h2>
          <p className="text-sm text-slate-500">
            Speak in <strong className="text-civic-navy-700">{lang?.native}</strong> — or choose another input method below.
          </p>
        </div>

        {/* Input method selector */}
        <InputMethodSelector inputMode={inputMode} setInputMode={setInputMode} />

        {/* ── Voice mode ── */}
        {inputMode === "voice" && (
          <VoiceRecorder
            language={lang}
            onComplete={handleVoiceComplete}
            onApprove={() => setStep(2)}
            existingForm={form}
            provenance={provenance}
          />
        )}

        {/* ── Type mode ── */}
        {inputMode === "type" && (
          <div className="space-y-3">
            <Textarea
              id="type-statement"
              label="Your Statement"
              value={form.incidentDescription}
              onChange={e => {
                autoSuggest(e.target.value);
                // Mark as user-edited so it won't be overwritten by AI extraction
                const meta = {
                  source: "USER", confidence: 1.0, editedByUser: true,
                  verified: false, lastUpdated: new Date().toISOString(),
                };
                provenanceRef.current.incidentDescription = meta;
                setProvenance(p => ({ ...p, incidentDescription: meta }));
              }}
              rows={8}
              placeholder={`Type your statement in ${lang?.native || "your language"}…`}
              aria-label="Type your statement"
              helper="Text typed here is saved directly to the FIR. You can review and edit it in the next steps."
            />
          </div>
        )}

        {/* ── Sign Language mode — Sign Language (Experimental) ── */}
        {inputMode === "sign" && (
          <div className="space-y-3" aria-label="Sign Language (Experimental) input mode">
            {/* Experimental notice */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <FlaskConical className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-emerald-800">ISL Gesture Input — Experimental</p>
                <p className="text-xs text-emerald-700">
                  Limited gesture suggestions only. Review all suggestions carefully before adding to your complaint.
                  This is not full ISL translation.
                </p>
              </div>
            </div>
            <SignLanguageRecorder
              existingText={form.incidentDescription}
              onConfirm={handleSignConfirm}
              onCancel={() => setInputMode("voice")}
            />
          </div>
        )}

        {/* Live preview of extracted data for type / sign modes */}
        {inputMode !== "voice" && form.complainantName && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-civic-blue-500 shrink-0" aria-hidden="true" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Auto-filled — tap Next to verify</p>
            </div>
            <div className="space-y-1.5">
              {form.complainantName  && <p className="text-sm text-slate-700"><span className="font-semibold">Name:</span> {form.complainantName}</p>}
              {form.complainantPhone && <p className="text-sm text-slate-700"><span className="font-semibold">Phone:</span> {form.complainantPhone}</p>}
              {form.complainantAge   && <p className="text-sm text-slate-700"><span className="font-semibold">Age:</span> {form.complainantAge}</p>}
              {form.crimeType        && <p className="text-sm text-slate-700"><span className="font-semibold">Crime Type:</span> {form.crimeType}</p>}
              {form.incidentDate     && (
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Date:</span> {formatDateForDisplay(form.incidentDate)}
                  {form.incidentTime ? ` · ${formatTimeForDisplay(form.incidentTime)}` : ""}
                </p>
              )}
              {form.incidentLocation && <p className="text-sm text-slate-700"><span className="font-semibold">Location:</span> {form.incidentLocation}</p>}
              {parseItemsList(form.stolenItems).length > 0 && (
                <div className="text-sm text-slate-700">
                  <span className="font-semibold">Stolen Items:</span>
                  <ul className="list-disc list-inside pl-3 mt-0.5 text-xs text-slate-600">
                    {parseItemsList(form.stolenItems).map((it, idx) => <li key={idx}>{it}</li>)}
                  </ul>
                </div>
              )}
              {form.ipcSections?.length > 0 && (
                <p className="text-sm text-slate-700"><span className="font-semibold">BNS Suggestions:</span> {form.ipcSections.map(s => `§${s}`).join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );

    /* ── STEP 2 — Complainant Details ────────────────────────────── */
    if (step === 2) return (
      <div className="space-y-5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 3 — Your Details</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Complainant Details</h2>
          <p className="text-sm text-slate-500">Auto-filled from your statement — verify and correct if needed.</p>
        </div>

        <FieldGroup title="Essential Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              required
              value={form.complainantName}
              onChange={e => upd("complainantName", e.target.value)}
              placeholder="Your full legal name"
              helper="As it appears on your government ID"
            />
            <Input
              label="Phone Number"
              required
              type="tel"
              value={form.complainantPhone}
              onChange={e => upd("complainantPhone", e.target.value)}
              placeholder="10-digit mobile number"
              helper="Police may contact you at this number"
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Additional Details" optional>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Age"
              type="number"
              min="1" max="120"
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
                helper="Street, area, city, state, PIN"
              />
            </div>
          </div>
        </FieldGroup>
      </div>
    );

    /* ── STEP 3 — Incident & BNS Sections ───────────────────────── */
    if (step === 3) return (
      <div className="space-y-5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 4 — Incident Details</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Incident Details</h2>
          <p className="text-sm text-slate-500">Review and edit the incident information below. Correct anything that is inaccurate.</p>
        </div>

        {/* AI extraction notice — shown when AI has populated any fields */}
        {extractedRef.current && Object.keys(extractedRef.current).some(k => extractedRef.current[k]) && (
          <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-purple-50 border border-purple-200">
            <Sparkles className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-bold text-purple-800">AI extracted information from your voice statement</p>
              <p className="text-xs text-purple-700 leading-snug">
                Fields below may have been pre-filled. Review each field carefully and correct anything that is wrong — your edits are always saved and will never be overwritten by AI.
              </p>
            </div>
          </div>
        )}

        {/* Essential incident fields */}
        <FieldGroup title="When & What Happened">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date of Incident"
              required
              type="date"
              value={form.incidentDate}
              onChange={e => upd("incidentDate", e.target.value)}
              provenance={provenance.incidentDate}
            />
            <Input
              label="Time of Incident"
              type="time"
              value={form.incidentTime}
              onChange={e => upd("incidentTime", e.target.value)}
              helper="Approximate time is fine"
              provenance={provenance.incidentTime}
            />
            <Select
              label="Crime Type"
              value={form.crimeType}
              onChange={e => upd("crimeType", e.target.value)}
              options={CRIME_TYPES}
              placeholder="Select crime type"
            />
            <Input
              label="Location / Area"
              value={form.incidentLocation}
              onChange={e => upd("incidentLocation", e.target.value)}
              placeholder="Street, area, city"
              provenance={provenance.incidentLocation}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label="Incident Description"
              required
              value={form.incidentDescription}
              onChange={e => autoSuggest(e.target.value)}
              rows={5}
              placeholder="Describe what happened, in as much detail as you can remember…"
              helper="Include what happened, who was involved, and any identifying details. Your edits here are always preserved."
              provenance={provenance.incidentDescription}
            />
          </div>
        </FieldGroup>

        {/* Optional additional fields */}
        <FieldGroup title="Additional Details" optional>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Stolen / Damaged Items"
              value={form.stolenItems}
              onChange={e => upd("stolenItems", e.target.value)}
              placeholder="e.g. Gold chain, Mobile phone, Wallet"
              provenance={provenance.stolenItems}
            />
            <Input
              label="Weapon Used"
              value={form.weaponUsed}
              onChange={e => upd("weaponUsed", e.target.value)}
              placeholder="Knife, rod, gun, etc."
            />
            <Input
              label="Vehicle Number"
              value={form.vehicleNumber}
              onChange={e => upd("vehicleNumber", e.target.value)}
              placeholder="TN01AB1234"
            />
            <Input
              label="Witness Names"
              value={form.witnessNames}
              onChange={e => upd("witnessNames", e.target.value)}
              placeholder="Names of any witnesses"
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Suspect Description"
                value={form.suspectDescription}
                onChange={e => upd("suspectDescription", e.target.value)}
                rows={3}
                placeholder="Physical appearance, clothing, age, height…"
                helper="Include any identifying features you remember."
              />
            </div>
          </div>
        </FieldGroup>

        {/* BNS Legal Suggestion — uses LegalSuggestionCard */}
        <LegalSuggestionCard
          sections={form.ipcSections}
          legalSuggestions={form.legalSuggestions || []}
          onRemove={removeIPC}
          validation={ipcValidation}
          variant="edit"
        />

        {/* Manual BNS entry */}
        <div>
          <label className="flex items-center gap-1 text-sm font-medium text-slate-700 mb-1.5">
            Add BNS Section Manually
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 ml-1">Optional</span>
          </label>
          <div className="flex gap-2">
            <Input
              value={ipcInput}
              onChange={e => setIpcInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && ipcInput && addIPC(ipcInput)}
              placeholder="e.g. 302, 376, 420, 498A"
              helper="Enter a BNS section number and press Add"
            />
            <Button variant="outline" onClick={() => ipcInput && addIPC(ipcInput)} className="shrink-0">
              Add
            </Button>
          </div>
        </div>
      </div>
    );

    /* ── STEP 4 — Location ───────────────────────────────────────── */
    if (step === 4) return (
      <div className="space-y-5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 5 — Location</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Crime Scene Location</h2>
          <p className="text-sm text-slate-500">Pinpoint where the incident occurred. GPS coordinates help route your complaint to the correct station.</p>
        </div>

        {/* Voice-described location hint */}
        {(form.nearestLandmark || form.locationLandmarks || form.locationCity) && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-civic-blue-50 border border-civic-blue-200">
            <Info className="h-4 w-4 text-civic-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-civic-blue-700">Voice-described location — map will auto-search:</p>
              {form.nearestLandmark   && <p className="text-xs text-civic-blue-800">Nearest landmark: {form.nearestLandmark}</p>}
              {form.locationLandmarks && <p className="text-xs text-civic-blue-800">Landmarks: {form.locationLandmarks}</p>}
              {form.locationArea      && <p className="text-xs text-civic-blue-800">Area: {form.locationArea}</p>}
              {form.locationCity      && <p className="text-xs text-civic-blue-800">City: {form.locationCity}</p>}
            </div>
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

    /* ── STEP 5 — Evidence ───────────────────────────────────────── */
    if (step === 5) return (
      <div className="space-y-5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 6 — Evidence</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Evidence &amp; Suspect Sketch</h2>
          <p className="text-sm text-slate-500">Upload photos and optionally generate a suspect sketch. Both are optional.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <PhotoUpload onPhotosUpdated={setPhotos} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <SuspectSketch onSketchGenerated={setSketch} initialDescription={form.suspectDescription} />
        </div>
      </div>
    );

    /* ── STEP 6 — Review & Submit ────────────────────────────────── */
    if (step === 6) return submitted ? (
      /* ── Submission Success — rendered by SubmissionSummary ── */
      <SubmissionSummary
        firData={firData}
        isOnline={isOnline}
        onNavigateHistory={() => navigate("/fir-history")}
        onFileAnother={resetAll}
        location={location}
        FIRDocument={FIRDocument}
        FIRDownload={FIRDownload}
      />
    ) : (
      /* ── Review Dossier ── */
      <div className="space-y-5">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Step 7 — Review &amp; Submit</p>
          <h2 className="text-xl font-bold text-civic-navy-900">Review Your Complaint</h2>
          <p className="text-xs text-slate-500">Check every detail carefully before submitting. Badges show the source of each data point.</p>
        </div>

        {/* Provenance legend */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="font-semibold text-slate-600 mr-1 shrink-0">Data source:</span>
          <ProvenanceBadge source="USER-PROVIDED" />
          <ProvenanceBadge source="USER-EDITED" />
          <ProvenanceBadge source="AI-EXTRACTED" />
          <ProvenanceBadge source="SYSTEM-GENERATED" />
          <ProvenanceBadge source="PENDING" />
        </div>

        {/* ── Helper: resolve provenance source for a field ── */}
        {/* (defined inline for clarity — no state mutation) */}

        {/* ── Complainant Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" aria-hidden="true" /> Complainant
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Language",      value: lang?.name,            field: null,                  fallback: "USER-PROVIDED" },
              { label: "Full Name",     value: form.complainantName,  field: "complainantName",     fallback: "USER-PROVIDED" },
              { label: "Phone Number", value: form.complainantPhone, field: "complainantPhone",    fallback: "USER-PROVIDED" },
              { label: "Age / Gender", value: [form.complainantAge, form.complainantGender].filter(Boolean).join(" / "), field: "complainantAge", fallback: "USER-PROVIDED" },
              { label: "Home Address", value: form.complainantAddress, field: "complainantAddress", fallback: "USER-PROVIDED" },
            ].map((item, idx) => {
              if (!item.value) return null;
              const prov = item.field ? provenance[item.field] : null;
              const source = prov?.editedByUser ? "USER-EDITED"
                           : prov?.source === "AI" ? "AI-EXTRACTED"
                           : item.fallback;
              return (
                <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-civic-navy-900 font-medium mt-0.5 break-words">{item.value}</p>
                  </div>
                  <ProvenanceBadge source={source} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Incident Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Incident
            </p>
          </div>
          {/* Description full-width */}
          {form.incidentDescription && (
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Your Statement</p>
                {(() => {
                  const prov = provenance.incidentDescription;
                  const src = prov?.editedByUser ? "USER-EDITED" : prov?.source === "AI" ? "AI-EXTRACTED" : "USER-PROVIDED";
                  return <ProvenanceBadge source={src} />;
                })()}
              </div>
              <p className="text-sm text-civic-navy-900 leading-relaxed whitespace-pre-line">{form.incidentDescription}</p>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {[
              { label: "Crime Type",     value: form.crimeType,                           field: "crimeType"         },
              { label: "Date",           value: formatDateForDisplay(form.incidentDate),   field: "incidentDate"      },
              { label: "Time",           value: formatTimeForDisplay(form.incidentTime),   field: "incidentTime"      },
              { label: "Location",       value: form.incidentLocation,                     field: "incidentLocation"  },
              { label: "Stolen Items",   value: form.stolenItems,                          field: "stolenItems"       },
              { label: "Weapon Used",    value: form.weaponUsed,                           field: "weaponUsed"        },
              { label: "Vehicle Number", value: form.vehicleNumber,                        field: "vehicleNumber"     },
              { label: "Witness Names",  value: form.witnessNames,                         field: "witnessNames"      },
              { label: "Suspect",        value: form.suspectDescription,                   field: "suspectDescription" },
            ].map((item, idx) => {
              if (!item.value) return null;
              const prov = item.field ? provenance[item.field] : null;
              const source = prov?.editedByUser ? "USER-EDITED"
                           : prov?.source === "AI" ? "AI-EXTRACTED"
                           : "USER-PROVIDED";
              return (
                <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-civic-navy-900 font-medium mt-0.5 break-words">{item.value}</p>
                  </div>
                  <ProvenanceBadge source={source} />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Location Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Location
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Nearest Landmark", value: form.locationLandmarks || form.nearestLandmark, source: "AI-EXTRACTED"      },
              { label: "GPS Coordinates",  value: location ? `${location.latitude?.toFixed(5)}°N, ${location.longitude?.toFixed(5)}°E` : null, source: "SYSTEM-GENERATED" },
              { label: "Geocoded Address", value: location?.displayName || location?.address,      source: "SYSTEM-GENERATED" },
              { label: "Station Routing",  value: "Auto-routed to jurisdictional police station",   source: "SYSTEM-GENERATED" },
            ].map((item, idx) => item.value ? (
              <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm text-civic-navy-900 font-medium mt-0.5 break-words">{item.value}</p>
                </div>
                <ProvenanceBadge source={item.source} />
              </div>
            ) : null)}
          </div>
        </div>

        {/* ── Evidence Section ── */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_6px_-2px_rgba(15,23,42,0.06)]">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Evidence
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Photos",         value: photos.length > 0 ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} attached` : "None attached", source: "USER-PROVIDED"    },
              { label: "Suspect Sketch", value: sketch ? "Generated & attached" : "None provided",  source: "SYSTEM-GENERATED" },
              { label: "Police Status",  value: "Pending station verification",                      source: "PENDING"           },
            ].map((item, idx) => item.value ? (
              <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm text-civic-navy-900 font-medium mt-0.5">{item.value}</p>
                </div>
                <ProvenanceBadge source={item.source} />
              </div>
            ) : null)}
          </div>
        </div>

        {/* ── Legal Suggestion Section (review mode) ── */}
        <LegalSuggestionCard
          sections={form.ipcSections}
          legalSuggestions={form.legalSuggestions || []}
          onRemove={null}
          validation={ipcValidation}
          variant="review"
        />

        {/* Digital Signature */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Digital Signature</p>
          <DigitalSignature
            label="Complainant Legal Signature"
            signerName={form.complainantName || "Complainant"}
            signerRole="Complainant"
            onSign={(sig) => setSignature(sig)}
          />
        </div>

        {/* Statutory Declaration */}
        <div className="p-4 rounded-xl bg-slate-50 border-2 border-slate-200 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationAgreed}
              onChange={(e) => setDeclarationAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-civic-blue-600 focus:ring-civic-blue-500 shrink-0"
              aria-describedby="declaration-text"
            />
            <div id="declaration-text" className="text-xs text-slate-700 leading-relaxed">
              <strong>Statutory Declaration:</strong> I hereby certify that the information provided above is true and correct to the best of my personal knowledge and belief. I understand that submitting false, frivolous, or vexatious information is a punishable criminal offense under <strong>Section 217 of Bharatiya Nyaya Sanhita (BNS 2023)</strong> and the <strong>Information Technology Act, 2000</strong>.
            </div>
          </label>
        </div>

        {/* Offline warning */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            Offline — FIR saved locally, syncs automatically when network is reconnected.
          </div>
        )}

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-amber-800 font-semibold text-sm">Duplicate FIR Detected</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  A complaint from this phone number for the same incident date already exists
                  (ID: <strong>{duplicateWarning}</strong>). Filing a duplicate FIR may constitute
                  misuse of the system and is punishable under BNS §217.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDupWarn(null)}
                className="flex-1 py-2 rounded-xl border border-amber-300 text-amber-700 text-xs font-medium transition-colors hover:bg-amber-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => { setDupWarn(null); await handleSubmit(); }}
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
              >
                File Anyway (Different Incident)
              </button>
            </div>
          </div>
        )}

        {/* Submit button */}
        <Button
          full
          size="lg"
          variant="success"
          onClick={handleSubmit}
          disabled={submitting || !declarationAgreed}
        >
          {submitting
            ? <><span className="inline-block animate-spin mr-1" aria-hidden="true">⏳</span> Submitting…</>
            : <><CheckCircle className="h-5 w-5" aria-hidden="true" /> Submit Complaint Officially</>
          }
        </Button>

        {!declarationAgreed && (
          <p className="text-center text-[11px] text-slate-400">
            Please accept the statutory declaration above to enable submission.
          </p>
        )}
      </div>
    );
  };

  /* ── Page shell ──────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky header ── */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_4px_0_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          {/* Brand mark */}
          <div className="w-8 h-8 rounded-xl bg-civic-navy-900 flex items-center justify-center shrink-0 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.3)]">
            <Shield className="h-4 w-4 text-civic-blue-400" aria-hidden="true" />
          </div>
          <div className="leading-none">
            <h1 className="text-[13px] font-extrabold text-civic-navy-900 tracking-tight">REPORT — New Complaint</h1>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              Step {step + 1} of {STEPS.length}
              <span aria-hidden="true">·</span>
              {isOnline
                ? <span className="flex items-center gap-0.5 text-emerald-600"><Wifi className="h-2.5 w-2.5" aria-hidden="true" />Online</span>
                : <span className="flex items-center gap-0.5 text-rose-600"><WifiOff className="h-2.5 w-2.5" aria-hidden="true" />Offline</span>
              }
            </p>
          </div>
          {/* Active language chip */}
          {lang && step > 0 && (
            <button
              type="button"
              onClick={() => setStep(0)}
              title="Click to switch statement language"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-civic-blue-50 border border-civic-blue-200 text-civic-blue-800 text-xs font-semibold hover:bg-civic-blue-100 hover:border-civic-blue-300 transition-all cursor-pointer min-h-[32px]"
            >
              <span>{lang.flag || "🌐"} {lang.native}</span>
              <span className="text-[10px] text-civic-blue-500 font-medium">· Change</span>
            </button>
          )}
        </div>
        {/* Back button — shown on mobile only; desktop uses the nav bar below */}
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : window.history.back()}
          className="sm:hidden text-xs font-semibold text-slate-500 hover:text-civic-navy-900 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[36px]"
          aria-label="Go back"
        >
          ← Back
        </button>
      </div>

      {/* ── Step progress ── */}
      <StepBar steps={STEPS} current={step} onStepClick={setStep} />

      {/* ── Step content ── */}
      <div className="max-w-2xl mx-auto px-4 py-6 pb-28 sm:pb-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5 sm:p-6 min-h-64">
          {renderStep()}
        </div>

        {/* ── Desktop navigation ── */}
        {!submitted && (
          <div className="hidden sm:flex items-center justify-between mt-5">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ← Back
            </Button>
            <div className="flex items-center gap-3">
              {/* Save Draft */}
              <button
                onClick={() => {
                  const draft = {
                    ...form,
                    id: generateFIRId({ isDraft: true }),
                    language: lang?.name,
                    status: "draft",
                    createdAt: new Date().toISOString(),
                  };
                  saveFIR(draft);
                  alert("Draft saved!");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors"
              >
                <Save className="h-3 w-3" aria-hidden="true" />
                Save Draft
              </button>
              {step < STEPS.length - 1 && (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}>
                  Next <ChevronRight className="h-4 w-4 ml-0.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile sticky bottom action bar ── */}
      {!submitted && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.10)]">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="shrink-0"
            >
              ←
            </Button>
            <button
              onClick={() => {
                const draft = {
                  ...form,
                  id: generateFIRId({ isDraft: true }),
                  language: lang?.name,
                  status: "draft",
                  createdAt: new Date().toISOString(),
                };
                saveFIR(draft);
                alert("Draft saved!");
              }}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors shrink-0"
              aria-label="Save draft"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden xs:inline">Draft</span>
            </button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1"
              >
                Continue <ChevronRight className="h-4 w-4 ml-0.5" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="success"
                onClick={handleSubmit}
                disabled={submitting || !declarationAgreed}
                className="flex-1"
              >
                {submitting ? "Submitting…" : "Submit"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
