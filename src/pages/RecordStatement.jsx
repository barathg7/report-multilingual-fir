import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mic, User, Shield, MapPin, Camera, CheckCircle, FileText,
  Keyboard, Hand, ChevronRight, Globe2, Wifi, WifiOff,
  AlertTriangle, Info, BookOpen, FlaskConical, Check, Save,
  Sparkles, Pencil, ArrowLeft,
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

// Exactly 4 main pages for the citizen experience
const STEPS = [
  { label: "Language", icon: Globe2 },
  { label: "Incident", icon: Shield },
  { label: "Evidence", icon: Camera },
  { label: "Review",   icon: CheckCircle },
];

const LANGUAGES = [
  { code: "ta",  name: "Tamil",      native: "தமிழ்",           flag: "🇮🇳", group: "Indian" },
  { code: "hi",  name: "Hindi",      native: "हिन्दी",           flag: "🇮🇳", group: "Indian" },
  { code: "en",  name: "English",    native: "English",           flag: "🇬🇧", group: "Indian" },
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

  // Tourist / Foreign Languages
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
  // 4 simple pages: 0: Language, 1: Incident, 2: Evidence, 3: Review
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
  // Input mode: voice | type | sign
  const [inputMode, setInputMode]   = useState("voice");

  // Ref stores the latest extracted data synchronously
  const extractedRef = useRef(null);

  const { saveFIR, isOnline, checkDuplicate } = useFIRStore();

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

  // ── handleVoiceComplete with User Edit Protection ────────────────
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

  // Page validation
  const canProceed = () => {
    if (step === 0) return !!lang;
    if (step === 1) {
      // Must have essential details: Name, Phone, Incident Date, and Description
      const hasName = Boolean(form.complainantName?.trim());
      const hasPhone = Boolean(form.complainantPhone?.trim());
      const hasDate = Boolean(form.incidentDate);
      const hasDesc = Boolean((form.incidentDescription && form.incidentDescription.trim()) || transcript?.trim());
      return hasName && hasPhone && hasDate && hasDesc;
    }
    if (step === 2) return true; // Evidence is optional
    if (step === 3) return declarationAgreed;
    return true;
  };

  const handleSubmit = async () => {
    if (!declarationAgreed) {
      alert("Please review and agree to the statutory declaration before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      if (form.complainantPhone && form.incidentDate) {
        const { isDuplicate, existingId } = await checkDuplicate(form.complainantPhone, form.incidentDate);
        if (isDuplicate) {
          setDupWarn(existingId);
          setSubmitting(false);
          return;
        }
      }

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
      if (!prov.incidentDescription?.editedByUser) {
        const meta = { ...provenance, lastUpdated: new Date().toISOString() };
        prov.incidentDescription = meta;
        provenanceRef.current.incidentDescription = meta;
        setProvenance(p => ({ ...p, incidentDescription: meta }));
        return { ...prev, incidentDescription: text.trim() };
      }
      return prev;
    });
    setInputMode("voice");
  }, []);

  const filteredLangs = LANGUAGES.filter(l =>
    l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
    l.native.includes(langSearch)
  );
  const indianLangs  = filteredLangs.filter(l => l.group === "Indian");
  const touristLangs = filteredLangs.filter(l => l.group === "Tourist");

  const renderStep = () => {
    const handleSelectLanguage = (selectedLang) => {
      setLang(selectedLang);
      setStep(1); // Advance directly to next page upon language selection
    };

    /* ══════════════════════════════════════════════════════════════════
       PAGE 1 — LANGUAGE SELECTION
       ══════════════════════════════════════════════════════════════════ */
    if (step === 0) return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Page 1 of 4 · Language Selection
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Select Your Language</h2>
          <p className="text-sm text-slate-500">
            மொழியை தேர்ந்தெடுக்கவும் · Choose your language · अपनी भाषा चुनें
          </p>
          <p className="text-xs text-blue-600 font-semibold">
            Choose your language to proceed directly to complaint information
          </p>
        </div>


        {/* Search */}
        <div className="relative max-w-lg mx-auto">
          <Globe2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            type="text"
            value={langSearch}
            onChange={e => setLangSearch(e.target.value)}
            placeholder="Search language… (Tamil, French, Hindi, Spanish…)"
            className="w-full border border-slate-300 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 shadow-sm bg-white"
            aria-label="Search for a language"
          />
        </div>

        {/* 22 Official Indian Languages */}
        {indianLangs.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">🇮🇳 22 Official Indian Languages</p>
              <span className="text-xs text-slate-400">{indianLangs.length} available</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {indianLangs.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`group p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer min-h-[64px] flex flex-col items-center justify-center
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                    ${lang?.code === l.code
                      ? "border-blue-600 bg-blue-50 shadow-sm ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 hover:-translate-y-0.5 shadow-xs"
                    }`}
                  aria-pressed={lang?.code === l.code}
                >
                  <p className="text-sm font-bold text-slate-900">{l.native}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tourist/Foreign Languages */}
        {touristLangs.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">🌍 International Languages</p>
              <span className="text-xs text-slate-400">{touristLangs.length} available</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {touristLangs.map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`group p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer min-h-[64px] flex flex-col items-center justify-center
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                    ${lang?.code === l.code
                      ? "border-blue-600 bg-blue-50 shadow-sm ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 hover:-translate-y-0.5 shadow-xs"
                    }`}
                  aria-pressed={lang?.code === l.code}
                >
                  <p className="text-sm font-bold text-slate-900">{l.flag} {l.native}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected language confirmation bar */}
        {lang && (
          <div className="flex items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <Check className="h-5 w-5 text-blue-700 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm text-blue-900 font-bold">
                  {lang.native} ({lang.name}) Selected
                </p>
                <p className="text-xs text-blue-600">Ready to record statement</p>
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => setStep(1)}
              className="min-h-[44px]"
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    );

    /* ══════════════════════════════════════════════════════════════════
       PAGE 2 — INCIDENT INFORMATION (COMBINED STATEMENT + DETAILS + LOCATION + BNS)
       ══════════════════════════════════════════════════════════════════ */
    if (step === 1) return (
      <div className="space-y-8">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Page 2 of 4 · Incident Information
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Incident Details &amp; Statement</h2>
          <p className="text-sm text-slate-500">
            Speak, type, or sign your complaint in <strong className="text-blue-700 font-bold">{lang?.native || "your language"}</strong>. Review and complete all details in the sections below.
          </p>
        </div>

        {/* ── SECTION 1: RECORD STATEMENT CARD ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                1
              </div>
              <h3 className="font-extrabold text-base text-slate-900">Record Statement</h3>
            </div>
            <InputMethodSelector inputMode={inputMode} setInputMode={setInputMode} />
          </div>

          {/* Voice input mode */}
          {inputMode === "voice" && (
            <VoiceRecorder
              language={lang}
              onComplete={handleVoiceComplete}
              onApprove={() => {}}
              existingForm={form}
              provenance={provenance}
            />
          )}

          {/* Type mode */}
          {inputMode === "type" && (
            <div className="space-y-3">
              <Textarea
                id="type-statement"
                label="Type Your Statement"
                value={form.incidentDescription}
                onChange={e => {
                  autoSuggest(e.target.value);
                  const meta = {
                    source: "USER", confidence: 1.0, editedByUser: true,
                    verified: false, lastUpdated: new Date().toISOString(),
                  };
                  provenanceRef.current.incidentDescription = meta;
                  setProvenance(p => ({ ...p, incidentDescription: meta }));
                }}
                rows={6}
                placeholder={`Type your statement in ${lang?.native || "your language"}…`}
                helper="What you type here directly populates your complaint description. You can edit it freely below."
              />
            </div>
          )}

          {/* Sign Language (Experimental) mode */}
          {inputMode === "sign" && (
            <div className="space-y-3" aria-label="Sign Language (Experimental) input mode">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <FlaskConical className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-emerald-800">Sign Language (Experimental)</p>
                  <p className="text-xs text-emerald-700">
                    Experimental heuristic gesture recognition. Review suggestions carefully before adding to statement.
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

          {/* AI Extraction Banner if fields were populated */}
          {extractedRef.current && Object.keys(extractedRef.current).some(k => extractedRef.current[k]) && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
              <Sparkles className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs font-bold text-purple-800">AI has auto-filled information from your voice</p>
                <p className="text-xs text-purple-700 leading-snug">
                  Please review each card below. Your edits are permanently preserved and will never be overwritten.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 2: COMPLAINANT / REQUIRED DETAILS CARD ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Complainant Details</h3>
              <p className="text-xs text-slate-500">Essential contact information for official verification</p>
            </div>
          </div>

          <FieldGroup title="Essential Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Legal Name"
                required
                value={form.complainantName}
                onChange={e => upd("complainantName", e.target.value)}
                placeholder="Your full name as on ID"
                provenance={provenance.complainantName}
              />
              <Input
                label="Phone Number"
                required
                type="tel"
                value={form.complainantPhone}
                onChange={e => upd("complainantPhone", e.target.value)}
                placeholder="10-digit mobile number"
                helper="Police contact number"
                provenance={provenance.complainantPhone}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Additional Particulars" optional>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Age"
                type="number"
                min="1" max="120"
                value={form.complainantAge}
                onChange={e => upd("complainantAge", e.target.value)}
                placeholder="Age in years"
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
                  label="Residential Address"
                  value={form.complainantAddress}
                  onChange={e => upd("complainantAddress", e.target.value)}
                  placeholder="Door No, Street, Area, City, PIN"
                />
              </div>
            </div>
          </FieldGroup>
        </div>

        {/* ── SECTION 3: INCIDENT DESCRIPTION CARD ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Incident Facts &amp; Description</h3>
              <p className="text-xs text-slate-500">Date, time, nature of offense, and statement narrative</p>
            </div>
          </div>

          <FieldGroup title="When & What">
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
                helper="Approximate time"
                provenance={provenance.incidentTime}
              />
              <Select
                label="Crime Type"
                value={form.crimeType}
                onChange={e => upd("crimeType", e.target.value)}
                options={CRIME_TYPES}
                placeholder="Select classification"
              />
              <Input
                label="Incident Area / Street"
                value={form.incidentLocation}
                onChange={e => upd("incidentLocation", e.target.value)}
                placeholder="e.g. T. Nagar, near bus terminus"
                provenance={provenance.incidentLocation}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Full Incident Description"
                required
                value={form.incidentDescription}
                onChange={e => autoSuggest(e.target.value)}
                rows={5}
                placeholder="Describe what occurred, who was present, and any crucial details…"
                provenance={provenance.incidentDescription}
              />
            </div>
          </FieldGroup>

          <FieldGroup title="Specific Incident Details" optional>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Stolen or Damaged Items"
                value={form.stolenItems}
                onChange={e => upd("stolenItems", e.target.value)}
                placeholder="e.g. Gold chain, smartphone, wallet"
                provenance={provenance.stolenItems}
              />
              <Input
                label="Weapon Used (if any)"
                value={form.weaponUsed}
                onChange={e => upd("weaponUsed", e.target.value)}
                placeholder="Knife, club, etc."
              />
              <Input
                label="Vehicle Number (if seen)"
                value={form.vehicleNumber}
                onChange={e => upd("vehicleNumber", e.target.value)}
                placeholder="e.g. TN 01 AB 1234"
              />
              <Input
                label="Witness Names"
                value={form.witnessNames}
                onChange={e => upd("witnessNames", e.target.value)}
                placeholder="Names or contacts of witnesses"
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Suspect Physical Description"
                  value={form.suspectDescription}
                  onChange={e => upd("suspectDescription", e.target.value)}
                  rows={2}
                  placeholder="Height, build, clothing, identifying marks…"
                />
              </div>
            </div>
          </FieldGroup>
        </div>

        {/* ── SECTION 4: LOCATION & POLICE JURISDICTION CARD ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Crime Scene Location &amp; Station Routing</h3>
              <p className="text-xs text-slate-500">Auto-routes to the nearest police station based on GPS coordinates</p>
            </div>
          </div>

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

        {/* ── SECTION 5: LEGAL & BNS ADVISORY CARD ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              5
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">BNS 2023 Legal Advisory (AI Suggested)</h3>
              <p className="text-xs text-slate-500">Bharatiya Nyaya Sanhita section suggestions — strictly advisory, verified by police</p>
            </div>
          </div>

          <LegalSuggestionCard
            sections={form.ipcSections}
            legalSuggestions={form.legalSuggestions || []}
            onRemove={removeIPC}
            validation={ipcValidation}
            variant="edit"
          />

          <div className="pt-2">
            <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
              Add BNS Section Manually (Optional)
            </label>
            <div className="flex gap-2">
              <Input
                value={ipcInput}
                onChange={e => setIpcInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && ipcInput && addIPC(ipcInput)}
                placeholder="e.g. 303, 304, 351, 115"
                helper="Type section number and click Add"
              />
              <Button variant="outline" onClick={() => ipcInput && addIPC(ipcInput)} className="shrink-0">
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Continue to Evidence Banner */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="text-xs text-slate-500">
            {!canProceed() ? (
              <span className="text-rose-600 font-semibold">
                * Please provide Complainant Name, Phone, Incident Date, and Description to continue
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> All required incident fields completed
              </span>
            )}
          </div>
          <Button
            variant="primary"
            onClick={() => setStep(2)}
            disabled={!canProceed()}
          >
            Continue to Evidence <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );

    /* ══════════════════════════════════════════════════════════════════
       PAGE 3 — EVIDENCE + SUSPECT SKETCH (DEDICATED SUPPORTING INFORMATION)
       ══════════════════════════════════════════════════════════════════ */
    if (step === 2) return (
      <div className="space-y-8">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Page 3 of 4 · Supporting Information
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Evidence &amp; Suspect Sketch</h2>
          <p className="text-sm text-slate-500">
            Upload photos, documents, and create or provide a suspect sketch. Both are optional but assist investigators.
          </p>
        </div>

        {/* Section 1: Evidence Upload */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <h3 className="font-extrabold text-base text-slate-900">Upload Evidence Photos &amp; Documents</h3>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <PhotoUpload onPhotosUpdated={setPhotos} />
        </div>

        {/* Section 2: Suspect Sketch */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-indigo-600" />
              <h3 className="font-extrabold text-base text-slate-900">Suspect Identification &amp; Sketch</h3>
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
              Optional
            </span>
          </div>
          <SuspectSketch onSketchGenerated={setSketch} initialDescription={form.suspectDescription} />
        </div>

        {/* Next to Review Banner */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <Button variant="outline" onClick={() => setStep(1)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Incident
          </Button>
          <Button variant="primary" onClick={() => setStep(3)}>
            Continue to Review <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );

    /* ══════════════════════════════════════════════════════════════════
       PAGE 4 — REVIEW + SUBMISSION (STRUCTURED CONFIRMATION & OFFICIAL SUBMISSION)
       ══════════════════════════════════════════════════════════════════ */
    if (step === 3) return submitted ? (
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
      <div className="space-y-8">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Page 4 of 4 · Final Review &amp; Official Submission
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Review Your Complaint</h2>
          <p className="text-sm text-slate-500">
            Verify all details carefully before final submission. Click "Edit" on any section if changes are needed.
          </p>
        </div>

        {/* Provenance legend */}
        <div className="flex flex-wrap items-center gap-2 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
          <span className="font-bold text-slate-600 mr-1 shrink-0">Data provenance:</span>
          <ProvenanceBadge source="USER-PROVIDED" />
          <ProvenanceBadge source="USER-EDITED" />
          <ProvenanceBadge source="AI-EXTRACTED" />
          <ProvenanceBadge source="SYSTEM-GENERATED" />
          <ProvenanceBadge source="PENDING" />
        </div>

        {/* 1. Language Review Card */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5 text-blue-600" /> Language of Statement
            </p>
            <button
              onClick={() => setStep(0)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="px-4 py-3 text-sm text-slate-800 flex items-center justify-between">
            <span className="font-semibold">{lang?.native || "English"} ({lang?.name || "English"})</span>
            <ProvenanceBadge source="USER-PROVIDED" />
          </div>
        </div>

        {/* 2. Complainant Review Card */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-blue-600" /> Complainant Information
            </p>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "Full Name",     value: form.complainantName,  field: "complainantName" },
              { label: "Phone Number", value: form.complainantPhone, field: "complainantPhone" },
              { label: "Age / Gender", value: [form.complainantAge, form.complainantGender].filter(Boolean).join(" / "), field: "complainantAge" },
              { label: "Home Address", value: form.complainantAddress, field: "complainantAddress" },
            ].map((item, idx) => {
              if (!item.value) return null;
              const prov = provenance[item.field];
              const source = prov?.editedByUser ? "USER-EDITED"
                           : prov?.source === "AI" ? "AI-EXTRACTED"
                           : "USER-PROVIDED";
              return (
                <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-slate-900 font-medium mt-0.5">{item.value}</p>
                  </div>
                  <ProvenanceBadge source={source} />
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Incident Review Card */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-blue-600" /> Incident Facts &amp; Statement
            </p>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          {form.incidentDescription && (
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Statement</p>
              <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">{form.incidentDescription}</p>
            </div>
          )}
          <div className="divide-y divide-slate-100">
            {[
              { label: "Crime Classification", value: form.crimeType, field: "crimeType" },
              { label: "Date of Incident",     value: formatDateForDisplay(form.incidentDate), field: "incidentDate" },
              { label: "Time of Incident",     value: formatTimeForDisplay(form.incidentTime), field: "incidentTime" },
              { label: "Incident Area",        value: form.incidentLocation, field: "incidentLocation" },
              { label: "Stolen / Lost Items",  value: form.stolenItems, field: "stolenItems" },
              { label: "Weapon Used",          value: form.weaponUsed, field: "weaponUsed" },
              { label: "Vehicle Number",       value: form.vehicleNumber, field: "vehicleNumber" },
              { label: "Witness Names",        value: form.witnessNames, field: "witnessNames" },
              { label: "Suspect Description",  value: form.suspectDescription, field: "suspectDescription" },
            ].map((item, idx) => {
              if (!item.value) return null;
              const prov = provenance[item.field];
              const source = prov?.editedByUser ? "USER-EDITED" : prov?.source === "AI" ? "AI-EXTRACTED" : "USER-PROVIDED";
              return (
                <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm text-slate-900 font-medium mt-0.5">{item.value}</p>
                  </div>
                  <ProvenanceBadge source={source} />
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Location & Station Review Card */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-blue-600" /> Location &amp; Station Jurisdiction
            </p>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {[
              { label: "GPS Coordinates",  value: location ? `${location.latitude?.toFixed(5)}°N, ${location.longitude?.toFixed(5)}°E` : null, source: "SYSTEM-GENERATED" },
              { label: "Geocoded Address", value: location?.displayName || location?.address || form.incidentLocation, source: "SYSTEM-GENERATED" },
              { label: "Station Routing",  value: "Auto-routed to jurisdictional police station", source: "SYSTEM-GENERATED" },
            ].map((item, idx) => item.value ? (
              <div key={idx} className="flex items-start justify-between px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm text-slate-900 font-medium mt-0.5">{item.value}</p>
                </div>
                <ProvenanceBadge source={item.source} />
              </div>
            ) : null)}
          </div>
        </div>

        {/* 5. Evidence & Sketch Review Card */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-blue-600" /> Evidence &amp; Suspect Sketch
            </p>
            <button
              onClick={() => setStep(2)}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-start justify-between px-4 py-3 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Uploaded Photos</p>
                <p className="text-sm text-slate-900 font-medium mt-0.5">
                  {photos.length > 0 ? `${photos.length} photo${photos.length !== 1 ? "s" : ""} attached` : "None attached"}
                </p>
              </div>
              <ProvenanceBadge source="USER-PROVIDED" />
            </div>
            <div className="flex items-start justify-between px-4 py-3 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Suspect Sketch</p>
                <p className="text-sm text-slate-900 font-medium mt-0.5">
                  {sketch ? "Generated & attached" : "None provided"}
                </p>
              </div>
              <ProvenanceBadge source={sketch ? "SYSTEM-GENERATED" : "PENDING"} />
            </div>
          </div>
        </div>

        {/* 6. Legal Suggestion Card (Review variant) */}
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
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationAgreed}
              onChange={(e) => setDeclarationAgreed(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
              aria-describedby="declaration-text"
            />
            <div id="declaration-text" className="text-xs text-slate-700 leading-relaxed">
              <strong>Statutory Declaration:</strong> I hereby certify that the information provided above is true and correct to the best of my personal knowledge and belief. I understand that submitting false, frivolous, or vexatious information is a punishable criminal offense under <strong>Section 217 of Bharatiya Nyaya Sanhita (BNS 2023)</strong> and the <strong>Information Technology Act, 2000</strong>.
            </div>
          </label>
        </div>

        {/* Offline notice */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-sm text-amber-700">
            <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
            Offline Mode: FIR saved locally in secure store. Syncs automatically when reconnected.
          </div>
        )}

        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-amber-800 font-semibold text-sm">Duplicate Complaint Detected</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  A complaint from this phone number for the same incident date already exists
                  (ID: <strong>{duplicateWarning}</strong>).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDupWarn(null)}
                className="flex-1 py-2 rounded-xl border border-amber-300 text-amber-700 text-xs font-medium hover:bg-amber-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => { setDupWarn(null); await handleSubmit(); }}
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
              >
                File Anyway (Different Incident)
              </button>
            </div>
          </div>
        )}

        {/* Final Submission Button */}
        <div className="space-y-3">
          <Button
            full
            size="lg"
            variant="success"
            onClick={handleSubmit}
            disabled={submitting || !declarationAgreed}
            className="min-h-[56px] text-base font-black shadow-3d-button"
          >
            {submitting
              ? <><span className="inline-block animate-spin mr-2" aria-hidden="true">⏳</span> Submitting to Jurisdictional Station…</>
              : <><CheckCircle className="h-5 w-5 mr-2" aria-hidden="true" /> Submit Complaint Officially</>
            }
          </Button>

          {!declarationAgreed && (
            <p className="text-center text-xs text-slate-400">
              Please review the details and check the statutory declaration above to enable submission.
            </p>
          )}
        </div>
      </div>
    );
  };

  /* ══════════════════════════════════════════════════════════════════
     PAGE SHELL & ACCESSIBLE WRAPPER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen civic-mesh-bg text-slate-900">

      {/* Sticky Top Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center shrink-0 shadow-3d-button-primary border border-cyan-400/30 cursor-pointer"
            title="Return to REPORT Home"
          >
            <Shield className="h-4 w-4 text-cyan-400" aria-hidden="true" />
          </button>
          <div className="leading-none">
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              REPORT — Citizen Portal
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 font-medium">
              Page {step + 1} of 4: {STEPS[step]?.label}
              <span aria-hidden="true">·</span>
              {isOnline
                ? <span className="flex items-center gap-0.5 text-emerald-600 font-bold"><Wifi className="h-2.5 w-2.5" aria-hidden="true" />Online</span>
                : <span className="flex items-center gap-0.5 text-rose-600 font-bold"><WifiOff className="h-2.5 w-2.5" aria-hidden="true" />Offline</span>
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Active language pill */}
          {lang && step > 0 && (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-all cursor-pointer min-h-[36px]"
              title="Click to switch complaint language"
            >
              <span>{lang.flag || "🌐"} {lang.native}</span>
              <span className="text-[10px] text-blue-600 font-normal">Change</span>
            </button>
          )}

        </div>
      </header>

      {/* 4-Step Progress Indicator */}
      <StepBar steps={STEPS} current={step} onStepClick={setStep} />

      {/* Step Content Container */}
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 sm:pb-14">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 shadow-3d-card p-6 sm:p-8 min-h-64">
          {renderStep()}
        </div>

        {/* Desktop Step Navigation */}
        {!submitted && (
          <div className="hidden sm:flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Previous
            </Button>

            <div className="flex items-center gap-3">
              {/* Draft Save */}
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
                  alert("Draft saved to secure local storage!");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 underline underline-offset-2 transition-colors cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Save Draft
              </button>

              {step < STEPS.length - 1 && (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={!canProceed()}
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Action Bar */}
      {!submitted && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-slate-200 px-4 py-3 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.10)]">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="shrink-0 min-h-[44px]"
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
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors shrink-0 min-h-[44px]"
              aria-label="Save draft"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Draft</span>
            </button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="flex-1 min-h-[44px]"
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                variant="success"
                onClick={handleSubmit}
                disabled={submitting || !declarationAgreed}
                className="flex-1 min-h-[44px]"
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
