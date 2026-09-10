import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, User, Shield, MapPin, Camera, CheckCircle, FileText, Keyboard, Hand } from "lucide-react";
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

  // ── Step renderers ────────────────────────────────────────────────
  const handleSelectLanguage = (selectedLang) => {
    setLang(selectedLang);
    setStep(1); // Advance directly to next step upon language selection
  };

  const renderStep = () => {

    /* STEP 0 — Language */
    if (step === 0) return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Select Your Language</h2>
          <p className="text-sm text-gray-500 mt-1">மொழியை தேர்ந்தெடுக்கவும் · Choose your language · अपनी भाषा चुनें</p>
          <p className="text-xs text-blue-600 font-semibold mt-0.5">Click any language to proceed directly</p>
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
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                    lang?.code === l.code
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
                  }`}
                >
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
                <button
                  key={l.code}
                  type="button"
                  onClick={() => handleSelectLanguage(l)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                    lang?.code === l.code
                      ? "border-blue-600 bg-blue-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-800">{l.flag} {l.native}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{l.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {lang && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center flex items-center justify-between">
            <p className="text-sm text-blue-700">✅ Current Language: <strong>{lang.native}</strong> ({lang.name})</p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700"
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    );

    /* STEP 1 — Statement Input */
    if (step === 1) return (
      <div className="space-y-4">

        {/* Heading */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Record Your Statement</h2>
          <p className="text-sm text-gray-500 mt-1">
            Speak in <strong>{lang?.native}</strong> — or choose another input method
          </p>
        </div>

        {/* ── Input Mode Switcher ── */}
        <div
          role="group"
          aria-label="Choose statement input method"
          className="flex gap-2 p-1 bg-gray-100 rounded-xl"
        >
          <button
            type="button"
            id="input-mode-voice"
            onClick={() => setInputMode("voice")}
            aria-pressed={inputMode === "voice"}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
              inputMode === "voice"
                ? "bg-white shadow-sm text-blue-700 border border-blue-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            <span>Voice</span>
          </button>
          <button
            type="button"
            id="input-mode-type"
            onClick={() => setInputMode("type")}
            aria-pressed={inputMode === "type"}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
              inputMode === "type"
                ? "bg-white shadow-sm text-blue-700 border border-blue-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            <span>Type</span>
          </button>
          <button
            type="button"
            id="input-mode-sign"
            onClick={() => setInputMode("sign")}
            aria-pressed={inputMode === "sign"}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
              inputMode === "sign"
                ? "bg-white shadow-sm text-indigo-700 border border-indigo-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Hand className="h-4 w-4" aria-hidden="true" />
            <span>Sign Language (Experimental)</span>
          </button>
        </div>

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
            <label htmlFor="type-statement" className="block text-sm font-semibold text-gray-700">
              Type Your Statement
            </label>
            <Textarea
              id="type-statement"
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
              placeholder={`Type your statement in ${lang?.native || "your language"}...`}
              aria-label="Type your statement"
            />
            <p className="text-xs text-gray-400">Text typed here is saved directly to the FIR.</p>
          </div>
        )}

        {/* ── Sign Language mode ── */}
        {inputMode === "sign" && (
          <SignLanguageRecorder
            existingText={form.incidentDescription}
            onConfirm={handleSignConfirm}
            onCancel={() => setInputMode("voice")}
          />
        )}

        {/* Live preview of extracted data for type / sign modes */}
        {inputMode !== "voice" && form.complainantName && (
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
            {parseItemsList(form.stolenItems).length > 0 && (
              <div className="text-sm text-green-800">
                <p className="font-bold">💼 <strong>Items:</strong></p>
                <ul className="list-disc list-inside pl-2 text-xs">
                  {parseItemsList(form.stolenItems).map((it, idx) => (
                    <li key={idx}>{it}</li>
                  ))}
                </ul>
              </div>
            )}
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
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-blue-900 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-blue-600 shrink-0" />
                  Potentially Relevant BNS Sections
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  AI-generated suggestion — requires police/legal verification.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                AI Suggestion
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {form.ipcSections.map(s => (
                <span key={s} className="inline-flex items-center gap-1.5 bg-white border border-blue-300 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full shadow-2xs">
                  BNS §{s}
                  <button type="button" onClick={() => removeIPC(s)} className="text-blue-400 hover:text-red-500 font-bold ml-1">×</button>
                </span>
              ))}
            </div>
            {ipcValidation && (
              <p className={`text-xs font-medium ${ipcValidation.isValid ? "text-emerald-700" : "text-amber-700"}`}>
                {ipcValidation.isValid ? "✅ All suggested sections verified in legal database" : `⚠️ ${ipcValidation.summary}`}
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
          <h2 className="text-2xl font-bold text-gray-900">FIR Statement Submitted</h2>
          <p className="text-gray-500 mt-1">உங்கள் புகார் பதிவு செய்யப்பட்டது · Statement Recorded Officially</p>
          <div className="inline-block mt-3 bg-blue-50 border border-blue-200 rounded-xl px-6 py-2.5">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-0.5">Citizen Acknowledgment / Reference ID</p>
            <p className="text-sm font-mono font-bold text-blue-800">{firData?.submissionId || firData?.id}</p>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Official FIR Number is assigned exclusively by jurisdictional police upon formal registration.
          </p>
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
          <Button onClick={() => navigate("/fir-history")}>View FIR History</Button>
          <Button variant="outline" onClick={resetAll}>File Another FIR</Button>
        </div>
      </div>
    ) : (
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Review & Verify FIR Details</h2>
          <p className="text-xs text-gray-500 mt-1">
            Please review each entry carefully. Badges denote the provenance source of each data point.
          </p>
        </div>

        {/* Provenance Badge Legend */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
          <span className="font-semibold text-slate-700 mr-1">Data Source:</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">USER-PROVIDED</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">AI-EXTRACTED</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-300">SYSTEM-GENERATED</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">POLICE-VERIFIED</span>
        </div>

        {/* Structured Field Review List with Badges */}
        <div className="bg-white border border-gray-200 rounded-2xl divide-y text-sm overflow-hidden">
          {[
            { label: "Language", value: lang?.name, source: "USER-PROVIDED" },
            { label: "Complainant Name", value: form.complainantName, source: "USER-PROVIDED" },
            { label: "Phone Number", value: form.complainantPhone, source: "USER-PROVIDED" },
            { label: "Age / Gender", value: [form.complainantAge, form.complainantGender].filter(Boolean).join(" / "), source: "USER-PROVIDED" },
            { label: "Residential Address", value: form.complainantAddress, source: "USER-PROVIDED" },
            { label: "Crime Category", value: form.crimeType, source: "AI-EXTRACTED" },
            { label: "Incident Date", value: formatDateForDisplay(form.incidentDate), source: "AI-EXTRACTED" },
            { label: "Incident Time", value: formatTimeForDisplay(form.incidentTime), source: "AI-EXTRACTED" },
            { label: "Reported Location", value: form.incidentLocation, source: "AI-EXTRACTED" },
            { label: "Nearest Landmark", value: form.locationLandmarks || form.nearestLandmark, source: "AI-EXTRACTED" },
            { label: "GPS Coordinates", value: location ? `${location.latitude?.toFixed(5)}°N, ${location.longitude?.toFixed(5)}°E` : "Not captured", source: "SYSTEM-GENERATED" },
            { label: "Geocoded Address", value: location?.displayName || location?.address, source: "SYSTEM-GENERATED" },
            { label: "Stolen / Damaged", value: form.stolenItems, source: "AI-EXTRACTED" },
            { label: "Weapon Used", value: form.weaponUsed, source: "AI-EXTRACTED" },
            { label: "Vehicle Number", value: form.vehicleNumber, source: "AI-EXTRACTED" },
            { label: "Witness Names", value: form.witnessNames, source: "AI-EXTRACTED" },
            { label: "Suggested BNS Sections", value: form.ipcSections.map(s => `§${s}`).join(", ") || "None", source: "AI-EXTRACTED" },
            { label: "Evidence Photos", value: photos.length > 0 ? `${photos.length} attached` : "None attached", source: "USER-PROVIDED" },
            { label: "Suspect Sketch", value: sketch ? "✅ Generated & Attached" : "None provided", source: "AI-EXTRACTED" },
            { label: "Station Jurisdiction", value: "Auto-routed to jurisdictional PS", source: "SYSTEM-GENERATED" },
            { label: "Police Status", value: "Pending Station Verification", source: "POLICE-VERIFIED" },
          ].map((item, idx) => item.value ? (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 gap-2 hover:bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-medium text-xs w-36 shrink-0">{item.label}</span>
                <span className="text-gray-900 text-xs font-semibold break-words">{item.value}</span>
              </div>
              <span className={`self-start sm:self-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                item.source === "USER-PROVIDED" ? "bg-blue-50 text-blue-700 border-blue-200" :
                item.source === "AI-EXTRACTED" ? "bg-purple-50 text-purple-700 border-purple-200" :
                item.source === "SYSTEM-GENERATED" ? "bg-slate-100 text-slate-700 border-slate-200" :
                "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {item.source}
              </span>
            </div>
          ) : null)}
        </div>

        {/* Digital Signature Component */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Digital Signature Verification</p>
          <DigitalSignature
            label="Complainant Legal Signature"
            signerName={form.complainantName || "Complainant"}
            signerRole="Complainant"
            onSign={(sig) => setSignature(sig)}
          />
        </div>

        {/* Statutory Declaration Checkbox */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={declarationAgreed}
              onChange={(e) => setDeclarationAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
            />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong>Statutory Declaration:</strong> I hereby certify that the information provided above is true and correct to the best of my personal knowledge and belief. I understand that submitting false, frivolous, or vexatious information is a punishable criminal offense under <strong>Section 217 of Bharatiya Nyaya Sanhita (BNS 2023)</strong> and the <strong>Information Technology Act, 2000</strong>.
            </div>
          </label>
        </div>

        {!isOnline && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            ⚠️ Offline — FIR saved locally, syncs automatically when network is reconnected.
          </div>
        )}

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-2">
            <p className="text-amber-800 font-semibold text-sm">⚠️ Duplicate FIR Detected</p>
            <p className="text-amber-700 text-xs">
              A complaint from this phone number for the same incident date already exists
              (ID: <strong>{duplicateWarning}</strong>). Filing a duplicate FIR may constitute
              misuse of the system and is punishable under IPC §182 / BNS §217.
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

        <Button full size="lg" variant="success" onClick={handleSubmit} disabled={submitting || !declarationAgreed}>
          {submitting
            ? <><span className="animate-spin">⏳</span> Submitting…</>
            : <><CheckCircle className="h-5 w-5" /> Submit FIR Officially</>}
        </Button>

        {!declarationAgreed && (
          <p className="text-center text-[11px] text-slate-500">
            * Please accept the statutory declaration above to enable submission
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-2xs">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-blue-700">REPORT — New FIR</h1>
            <p className="text-xs text-gray-400">
              Step {step + 1}/{STEPS.length} · {isOnline ? "🟢 Online" : "🔴 Offline"}
            </p>
          </div>
          {lang && step > 0 && (
            <button
              type="button"
              onClick={() => setStep(0)}
              title="Click to switch statement language"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer"
            >
              <span>{lang.flag || "🌐"} {lang.native}</span>
              <span className="text-[10px] text-blue-500 font-medium">· Change</span>
            </button>
          )}
        </div>
        <button
          onClick={() => step > 0 ? setStep(s => s - 1) : window.history.back()}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← Back
        </button>
      </div>

      <StepBar steps={STEPS} current={step} onStepClick={setStep} />

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
                    id: generateFIRId({ isDraft: true }),
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