import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, CheckCircle, AlertTriangle, Sparkles, MapPin, FileText, Wand2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import GroqManager from './GroqManager';

const LANG_MAP = {
  ta:"ta-IN", hi:"hi-IN", en:"en-IN", te:"te-IN", kn:"kn-IN", ml:"ml-IN",
  mr:"mr-IN", bn:"bn-IN", gu:"gu-IN", pa:"pa-IN", ur:"ur-PK", or:"or-IN",
  as:"as-IN", mai:"hi-IN", ks:"ur-PK", sd:"ur-PK", sat:"hi-IN", ne:"ne-NP",
  kok:"mr-IN", mni:"bn-IN", doi:"hi-IN", sa:"hi-IN",
  ar:"ar-SA", fr:"fr-FR", de:"de-DE", es:"es-ES", pt:"pt-PT", it:"it-IT",
  ru:"ru-RU", zh:"zh-CN", ja:"ja-JP", ko:"ko-KR", nl:"nl-NL", sv:"sv-SE",
  no:"nb-NO", da:"da-DK", fi:"fi-FI", pl:"pl-PL", tr:"tr-TR", he:"he-IL",
  th:"th-TH", vi:"vi-VN", id:"id-ID", ms:"ms-MY", uk:"uk-UA", cs:"cs-CZ",
  ro:"ro-RO", hu:"hu-HU", el:"el-GR", bg:"bg-BG",
};

// BNS = Bharatiya Nyaya Sanhita 2023 — effective July 1, 2024
// Replaces Indian Penal Code (IPC) 1860 entirely
const BNS_DB = {
  // CHAPTER VI — Offences against State
  "147":"Punishment for sedition (new)",
  // CHAPTER VII — Offences against public tranquility
  "189":"Unlawful assembly",
  "191":"Rioting",
  "192":"Rioting armed with deadly weapon",
  "193":"Every member of unlawful assembly guilty",
  "196":"Promoting enmity between groups",
  "221":"Obstructing public servant",
  // CHAPTER X — Contempt
  "229":"Giving false evidence",
  "231":"Punishment for false evidence",
  "238":"Causing disappearance of evidence",
  // CHAPTER XI — Offences affecting human body
  "101":"Murder",
  "104":"Culpable homicide not amounting to murder",
  "106":"Causing death by negligence",
  "80":"Dowry death",
  "108":"Abetment of suicide",
  "109":"Attempt to murder",
  "110":"Attempt to commit culpable homicide",
  "226":"Attempt to commit suicide",
  "114":"Hurt",
  "115":"Grievous hurt",
  "116":"Voluntarily causing hurt — punishment",
  "117":"Voluntarily causing grievous hurt — punishment",
  "118":"Voluntarily causing hurt by dangerous weapons",
  "119":"Voluntarily causing grievous hurt by dangerous weapons",
  "124":"Voluntarily causing grievous hurt by acid attack",
  "125":"Attempt to throw acid",
  "132":"Causing hurt to deter public servant",
  "125A":"Act endangering life or personal safety",
  "127":"Wrongful confinement",
  "126":"Wrongful restraint",
  // CHAPTER V — Offences against women & children
  "74":"Assault to outrage modesty of woman",
  "75":"Sexual harassment",
  "76":"Assault with intent to disrobe",
  "77":"Voyeurism",
  "78":"Stalking",
  "137":"Kidnapping",
  "138":"Kidnapping from lawful guardianship",
  "139":"Abduction",
  "140":"Punishment for kidnapping",
  "141":"Kidnapping minor for begging",
  "142":"Kidnapping or abducting to murder",
  "143":"Kidnapping for ransom",
  "144":"Kidnapping with intent to secretly confine",
  "145":"Kidnapping woman to compel marriage",
  "63":"Rape — definition",
  "64":"Punishment for rape",
  "66":"Causing death during rape / persistent vegetative state",
  "70":"Gang rape",
  "71":"Repeat offenders — rape",
  "38":"Unnatural offences (deleted — decriminalised by SC)",
  // CHAPTER XVII — Offences against property
  "303":"Theft — definition",
  "304":"Punishment for theft",
  "305":"Theft in dwelling house",
  "306":"Theft by clerk or servant",
  "307":"Theft after preparation for hurt or death",
  "308":"Extortion — definition",
  "309":"Punishment for extortion",
  "310":"Putting person in fear to commit extortion",
  "311":"Extortion by threat of death or grievous hurt",
  "309A":"Robbery — definition",
  "310A":"Dacoity — definition",
  "309B":"Punishment for robbery",
  "312":"Attempt to commit robbery",
  "313":"Voluntarily causing hurt in committing robbery",
  "310B":"Punishment for dacoity",
  "311A":"Dacoity with murder",
  "312A":"Robbery or dacoity with deadly weapon",
  "314":"Preparation to commit dacoity",
  "315":"Belonging to gang of dacoits",
  "316":"Dishonest misappropriation of property",
  "316A":"Criminal breach of trust — definition",
  "316B":"Punishment for criminal breach of trust",
  "316C":"Criminal breach of trust by public servant",
  "318":"Cheating — definition",
  "319":"Punishment for cheating",
  "319A":"Punishment for cheating by personation",
  "319B":"Cheating and inducing delivery of property",
  "324":"Mischief — definition",
  "324A":"Punishment for mischief",
  "325":"Mischief causing damage",
  "326":"Mischief by fire or explosive",
  "327":"Mischief by fire destroying house",
  "329":"Criminal trespass — definition",
  "330":"House-trespass — definition",
  "329A":"Punishment for criminal trespass",
  "330A":"Punishment for house-trespass",
  "333":"Lurking house-trespass to commit offence",
  "336":"Lurking house-trespass or house-breaking by night",
  // CHAPTER XVIII — Documents & property marks
  "336A":"Forgery",
  "336B":"Forgery for cheating",
  "336C":"Using forged document as genuine",
  // CHAPTER XX — Marriage offences
  "82":"Marrying again during lifetime of spouse",
  "84":"Enticing or detaining married woman",
  "85":"Husband or relative subjecting woman to cruelty (Domestic Violence)",
  "86":"Cruelty — definition",
  // CHAPTER XXI — Defamation & intimidation
  "356":"Defamation — definition",
  "351":"Criminal intimidation — definition",
  "352":"Intentional insult to provoke breach of peace",
  "351B":"Punishment for criminal intimidation",
  "79":"Word or gesture to insult modesty of woman",
  // IT Act 2000 (unchanged — not replaced by BNS)
  "66C":"IT Act §66C — Identity theft",
  "66D":"IT Act §66D — Cheating by personation using computer",
  "66E":"IT Act §66E — Violation of privacy",
  "67":"IT Act §67 — Publishing obscene material online",
  "67A":"IT Act §67A — Publishing sexually explicit material",
};

function getTodayContext() {
  const now = new Date();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const dby = new Date(now); dby.setDate(dby.getDate() - 2);

  const fmt = (d) =>
    `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;

  const DAY = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  return {
    todayFormatted: fmt(now),
    todayDayName: DAY[now.getDay()],
    yesterdayFormatted: fmt(yest),
    yesterdayDayName: DAY[yest.getDay()],
    dayBeforeYestFormatted: fmt(dby),
    dayBeforeYestDayName: DAY[dby.getDay()],
    currentTime12h: now.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit", hour12:true }),
  };
}

function toHTMLDate(ddmmyyyy) {
  if (!ddmmyyyy || typeof ddmmyyyy !== "string") return "";
  const parts = ddmmyyyy.split(/[\/\-]/);
  if (parts.length !== 3) return "";
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return "";
  return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
}

function toHTMLTime(time12h) {
  if (!time12h || typeof time12h !== "string") return "";
  const match = time12h.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "";
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2,"0")}:${m}`;
}

function normalizeExtracted(extracted) {
  if (!extracted) return extracted;
  return {
    ...extracted,
    incidentDate: toHTMLDate(extracted.incidentDate),
    incidentTime: toHTMLTime(extracted.incidentTime),
  };
}

// IMPROVED: More robust JSON parsing
function parseJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error("Empty or invalid response");
  }

  // Remove markdown code blocks
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  
  // Try to find JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    // Check if it's an error message
    if (cleaned.includes("rate limit") || cleaned.includes("Rate limit")) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (cleaned.includes("API key") || cleaned.includes("authentication")) {
      throw new Error("API key error. Please check your Groq API key.");
    }
    throw new Error("No JSON object found in response");
  }

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON parse error:", e, "Raw:", raw.substring(0, 200));
    throw new Error("Invalid JSON format in response");
  }
}

function useVoiceCapture(language) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [dots, setDots] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const dotsRef = useRef(null);
  const isRecordingRef = useRef(false);
  const transcriptRef = useRef("");

  const start = (onDone) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Chrome browser for voice recording."); return; }
    setError(""); setTranscript(""); transcriptRef.current = "";
    isRecordingRef.current = true;

    const r = new SR();
    recognitionRef.current = r;
    r.lang = LANG_MAP[language?.code] || "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      const updated = transcriptRef.current ? transcriptRef.current + " " + text : text;
      transcriptRef.current = updated.trim();
      setTranscript(updated.trim());
    };

    r.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Microphone access denied. Allow microphone in browser settings.");
        isRecordingRef.current = false; setRecording(false);
      } else if (e.error !== "no-speech") {
        console.warn("Speech recognition error:", e.error);
      }
    };

    r.onend = () => {
      if (isRecordingRef.current) {
        try { r.start(); } catch (_) {}
      } else {
        setRecording(false);
        clearInterval(dotsRef.current);
        const final = transcriptRef.current.trim();
        if (final) onDone?.(final);
      }
    };

    r.start();
    setRecording(true);
    let d = 0;
    dotsRef.current = setInterval(() => { d = (d + 1) % 4; setDots(".".repeat(d)); }, 500);
    setTimeout(() => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        try { r.stop(); } catch (_) {}
      }
    }, 90000);
  };

  const stop = (onDone) => {
    isRecordingRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    clearInterval(dotsRef.current);
    setRecording(false);
    const final = transcriptRef.current.trim();
    if (final) onDone?.(final);
  };

  return { recording, transcript, setTranscript, dots, error, start, stop };
}

export default function VoiceRecorder({ language, onComplete }) {
  const [voiceStep, setVoiceStep] = useState("crime");
  const [rawTranscript, setRawTranscript] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [crimeExtracted, setCrimeExtracted] = useState(null);
  const [locationExtracted, setLocationExtracted] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const [approved, setApproved] = useState(false);
  const [processingError, setProcessingError] = useState("");

  const crimeVoice = useVoiceCapture(language);
  const locationVoice = useVoiceCapture(language);

  const latestExtractedRef = useRef(null);
  const latestCorrectedRef = useRef("");
  const groqManagerRef = useRef(null);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    if (apiKey) {
      groqManagerRef.current = new GroqManager(apiKey);
    }
  }, [apiKey]);

  const hasLocationFromCrime = !!(
    crimeExtracted?.incidentLocation ||
    crimeExtracted?.locationCity ||
    crimeExtracted?.nearestLandmark
  );

  const processCrimeStatement = async (rawText) => {
    if (!rawText?.trim()) return;
    
    if (!apiKey) {
      setProcessingError("VITE_GROQ_API_KEY is not set. Add it to your .env file.");
      return;
    }

    if (!groqManagerRef.current) {
      setProcessingError("GroqManager not initialized. Check API key.");
      return;
    }

    setProcessing(true);
    setProcessingError("");
    setRawTranscript(rawText);

    try {
      setProcessingLabel("🔤 Correcting speech recognition errors…");
      
      // Step 1: Correct transcript
      const corrected = await groqManagerRef.current.chat([
        {
          role: "system",
          content: `You are a speech-to-text correction assistant for Indian police FIRs.
The input is a raw speech recognition transcript in ${language?.name || "English"} that may have errors.

Your task:
1. Fix garbled, repeated, or unclear words caused by speech recognition errors
2. Preserve ALL factual content — names, numbers, places, amounts
3. Do NOT add information not present in the original
4. Return the corrected text in the SAME language as the input

Common errors to fix:
- "Valeo cherry" → "Velachery"
- "Phonics Mall" → "Phoenix Mall"
- Repeated words → keep once

Return ONLY the corrected transcript text. No explanation, no JSON.`,
        },
        {
          role: "user",
          content: `Fix this ${language?.name || "English"} transcript:\n\n"${rawText}"\n\nReturn only corrected text.`,
        },
      ], 600);

      if (!corrected || corrected.trim().length === 0) {
        throw new Error("Empty response from AI correction");
      }

      setCorrectedText(corrected);
      latestCorrectedRef.current = corrected;

      // Step 1.5: Translate to English if the language is not English
      // This ensures incidentDescription in the FIR is always in English
      let correctedEnglish = corrected;
      if (language?.code && language.code !== "en") {
        setProcessingLabel("🌐 Translating statement to English…");
        try {
          const translated = await groqManagerRef.current.chat([
            {
              role: "system",
              content: `You are a professional translator for Indian police FIR documents.
Translate the following victim statement from ${language?.name || "the input language"} to English.
Rules:
- Translate ALL content faithfully and completely
- Preserve all names, numbers, places, dates, amounts exactly as spoken
- Transliterate proper nouns (names of people, places) to English phonetically
- Do NOT add or remove any factual content
- Return ONLY the translated English text, no explanation`,
            },
            {
              role: "user",
              content: `Translate this ${language?.name} statement to English:\n\n"${corrected}"\n\nReturn only the English translation.`,
            },
          ], 800);
          if (translated && translated.trim().length > 0) {
            correctedEnglish = translated.trim();
          }
        } catch (translationErr) {
          console.warn("Translation failed, using original:", translationErr.message);
          // Fall through — use corrected (original language) if translation fails
        }
      }

      setProcessingLabel("🧠 Extracting FIR details…");
      
      // Step 2: Extract details
      const ctx = getTodayContext();
      
      const extractedRaw = await groqManagerRef.current.chat([
        {
          role: "system",
          content: `You are an expert Indian police FIR assistant. Extract ALL details from victim statements.
Input language: ${language?.name || "English"}

CRITICAL TRANSLATION RULE:
The victim may speak in ANY language (Tamil, Japanese, Arabic, French, etc.).
You MUST translate ALL extracted text values into ENGLISH for the official FIR record.
- complainantName: transliterate to English (e.g. モニカ・ラジャン → Monika Rajan)
- crimeType: in English (e.g. チェーンひったくり → Chain Snatching)
- stolenItems: in English (e.g. マンガルスートラと金のチェーン → Mangalsutra and gold chain)
- suspectDescription: in English
- incidentLocation: in English
- ALL other text fields: in English
Only the original spoken transcript is preserved in the input language. The FIR JSON must be entirely in English.

TODAY'S DATE CONTEXT:
Today: ${ctx.todayFormatted} (${ctx.todayDayName})
Yesterday: ${ctx.yesterdayFormatted}
Day before: ${ctx.dayBeforeYestFormatted}

DATE/TIME RULES:
- "yesterday at 7 pm" → incidentDate="${ctx.yesterdayFormatted}", incidentTime="7:00 PM"
- "morning" → "8:00 AM", "afternoon" → "2:00 PM", "evening" → "7:00 PM", "night" → "10:00 PM"
- incidentDate format: DD/MM/YYYY
- incidentTime format: 12-hour with AM/PM

BNS SECTIONS (Bharatiya Nyaya Sanhita 2023 — effective July 1, 2024, replaces IPC):
- Chain snatching with force: ["309B", "304"] (Robbery + Theft)
- Theft without confrontation: ["304"]
- Assault / Hurt: ["116"] or ["118"] if dangerous weapon used
- Grievous Hurt: ["117"] or ["119"] if dangerous weapon
- Acid attack: ["124"]
- Murder: ["101"]
- Culpable homicide: ["104"]
- Attempt to murder: ["109"]
- Rape: ["64"]
- Gang rape: ["70"]
- Sexual harassment: ["75"]
- Stalking: ["78"]
- Voyeurism: ["77"]
- Kidnapping: ["140"]
- Kidnapping for ransom: ["143"]
- Robbery: ["309B"]
- Dacoity: ["310B"]
- Extortion: ["309"]
- Theft: ["304"]
- Cheating / Fraud: ["319B"]
- Criminal breach of trust: ["316B"]
- Domestic violence / Cruelty to wife: ["85"]
- Dowry death: ["80"]
- Forgery: ["336A"]
- Criminal trespass: ["329A"]
- Criminal intimidation: ["351"]
- Outrage modesty of woman: ["74"]
- Cybercrime / Identity theft: ["66C"] (IT Act)
- Online fraud: ["66D"] (IT Act)

OUTPUT FORMAT - Return ONLY this JSON structure:
{
  "complainantName": "",
  "complainantPhone": "",
  "complainantAge": "",
  "complainantGender": "",
  "incidentDate": "",
  "incidentTime": "",
  "incidentLocation": "",
  "crimeType": "",
  "suspectDescription": "",
  "stolenItems": "",
  "weaponUsed": "",
  "vehicleNumber": "",
  "nearestLandmark": "",
  "locationCity": "",
  "bnsSections": [],  // Use BNS 2023 section numbers (effective July 1, 2024)
  "ipcDetails": ""
}`,
        },
        {
          role: "user",
          content: `Extract FIR details from this statement. Return ONLY valid JSON:\n\n"${correctedEnglish}"`,
        },
      ], 1400);

      // Parse with better error handling
      let extracted;
      try {
        extracted = parseJSON(extractedRaw);
      } catch (parseErr) {
        console.error("Parse error, raw response:", extractedRaw);
        
        // Try to extract data using regex as fallback
        extracted = extractDataFallback(corrected);
        if (!extracted) {
          throw parseErr;
        }
      }

      setCrimeExtracted(extracted);
      
      const normalized = normalizeExtracted(extracted);
      latestExtractedRef.current = normalized;

      onComplete?.({ 
        text: correctedEnglish,          // ✅ Always English for the FIR description
        extracted: normalized, 
        confidence: 0.95, 
        language 
      });

    } catch (err) {
      console.error("Processing failed:", err);
      setProcessingError(`Processing failed: ${err.message}`);
      
      // Still provide the raw text so user can proceed manually
      onComplete?.({ 
        text: rawText, 
        extracted: {}, 
        confidence: 0.5, 
        language,
        error: err.message
      });
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
  };

  // Fallback extraction when JSON parsing fails
  const extractDataFallback = (text) => {
    const extracted = {
      complainantName: "",
      complainantPhone: "",
      complainantAge: "",
      incidentDate: "",
      incidentTime: "",
      incidentLocation: "",
      crimeType: "",
      suspectDescription: "",
      stolenItems: "",
      ipcSections: [],
    };

    // Simple regex extractions
    const nameMatch = text.match(/my name is (\w+)/i);
    if (nameMatch) extracted.complainantName = nameMatch[1];

    const phoneMatch = text.match(/phone (\d{10})/i);
    if (phoneMatch) extracted.complainantPhone = phoneMatch[1];

    const ageMatch = text.match(/age (\d+)/i);
    if (ageMatch) extracted.complainantAge = ageMatch[1];

    const yesterdayMatch = text.match(/yesterday/i);
    const todayMatch = text.match(/today/i);
    const ctx = getTodayContext();
    if (yesterdayMatch) extracted.incidentDate = ctx.yesterdayFormatted;
    else if (todayMatch) extracted.incidentDate = ctx.todayFormatted;

    const timeMatch = text.match(/(\d{1,2})\s*(am|pm)/i);
    if (timeMatch) {
      extracted.incidentTime = `${timeMatch[1]}:00 ${timeMatch[2].toUpperCase()}`;
    }

    const locationMatch = text.match(/near\s+([^,]+)/i);
    if (locationMatch) extracted.incidentLocation = locationMatch[1];

    // Chain snatching detection
    if (text.match(/chain|snatched|snatch/i)) {
      extracted.crimeType = "Chain Snatching";
      extracted.ipcSections = ["309B", "304"]; // BNS: Robbery + Theft
      extracted.stolenItems = "Gold chain";
    }

    return Object.values(extracted).some(v => v && v.length > 0) ? extracted : null;
  };

  const processLocationStatement = async (rawText) => {
    if (!rawText?.trim()) return;
    setProcessing(true);
    setProcessingLabel("📍 Extracting location details…");
    setProcessingError("");

    try {
      const extractedRaw = await groqManagerRef.current.chat([
        {
          role: "system",
          content: `Extract location details from this statement. Return ONLY JSON:
{
  "nearestLandmark": "",
  "locationArea": "",
  "locationCity": "",
  "fullLocationDescription": ""
}`,
        },
        {
          role: "user",
          content: `Extract location from:\n\n"${rawText}"\n\nReturn only JSON.`,
        },
      ], 400);

      const result = parseJSON(extractedRaw);
      setLocationExtracted(result);
    } catch (err) {
      console.error("Location extraction failed:", err);
      setLocationExtracted({ 
        incidentLocation: rawText, 
        searchQuery: rawText,
        nearestLandmark: rawText.split(',')[0] || rawText
      });
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
  };

  const approveWithCrimeOnly = () => {
    setApproved(true);
  };

  const approveWithLocation = () => {
    if (!locationExtracted) return;
    const base = latestExtractedRef.current || {};
    const merged = {
      ...base,
      incidentLocation: locationExtracted.incidentLocation || base.incidentLocation || "",
      nearestLandmark: locationExtracted.nearestLandmark || base.nearestLandmark || "",
      locationArea: locationExtracted.locationArea || base.locationArea || "",
      locationCity: locationExtracted.locationCity || base.locationCity || "",
      fullLocationDescription: locationExtracted.fullLocationDescription || "",
    };
    setApproved(true);
    onComplete?.({
      text: (crimeVoice.transcript + " " + locationVoice.transcript).trim(),
      extracted: merged,
      confidence: 0.95,
      language,
    });
  };

  const Spinner = ({ label }) => (
    <div className="flex items-center gap-2 px-3 py-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 text-sm">
      <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
      </svg>
      <span>{label}</span>
    </div>
  );

  const MicArea = ({ voice, onStop, onStart, hint }) => (
    <div className="flex flex-col items-center gap-3 py-5 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
      <button
        onClick={voice.recording ? () => voice.stop(onStop) : () => voice.start(onStart)}
        disabled={processing}
        className={`h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
          processing ? "bg-gray-400 cursor-not-allowed" : voice.recording ? "bg-red-500 animate-pulse scale-110" : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
        }`}
      >
        {voice.recording ? <MicOff className="h-9 w-9 text-white" /> : <Mic className="h-9 w-9 text-white" />}
      </button>

      {voice.recording && (
        <div className="flex items-end gap-1 h-6">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="w-1.5 bg-red-400 rounded-full animate-bounce" style={{ height:`${10 + (i % 3) * 6}px`, animationDelay:`${i * 0.1}s` }} />
          ))}
        </div>
      )}

      <p className="text-sm text-gray-600 font-medium text-center px-4">
        {voice.recording ? `🔴 Listening${voice.dots} — tap to stop` : processing ? "⏳ Processing…" : "🎙️ Tap to start recording"}
      </p>
      {!voice.recording && !processing && hint && (
        <p className="text-xs text-gray-400 text-center px-6">{hint}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-700 font-medium">
            {language?.native || "English"} ({language?.name || "English"})
          </p>
          <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            ⚡ Groq AI
          </span>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          🎙️ Record → 🔤 AI correction → 🧠 Extract details → 📋 Auto-fill form
        </p>
      </div>

      {/* Step tabs */}
      <div className="flex gap-2">
        {[
          { id: "crime", icon: FileText, label: "Step 1: Crime", done: !!crimeExtracted },
          { id: "location", icon: MapPin, label: "Step 2: Location (Optional)", done: !!locationExtracted },
        ].map(({ id, icon: Icon, label, done }) => (
          <div key={id} className={`flex-1 flex items-center gap-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
            voiceStep === id ? "bg-blue-600 text-white border-blue-600" : done ? "bg-green-50 text-green-700 border-green-300" : "bg-gray-50 text-gray-400 border-gray-200"
          }`}>
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
            {done && <CheckCircle className="h-3.5 w-3.5 ml-auto shrink-0" />}
          </div>
        ))}
      </div>

      {/* STEP 1: Crime */}
      {voiceStep === "crime" && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" /> Describe What Happened
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Include: your name, phone, age, what happened, when, where
            </p>
            <div className="bg-blue-50 rounded-lg p-2 mt-2">
              <p className="text-xs text-blue-700 font-medium">💡 Example:</p>
              <p className="text-xs text-blue-600 mt-0.5">
                "My name is Priya, phone 9876543210, age 24. Yesterday at 7pm near Phoenix Mall Velachery Chennai, a man on a bike snatched my gold chain and fled northward..."
              </p>
            </div>
          </div>

          <MicArea
            voice={crimeVoice}
            onStop={processCrimeStatement}
            onStart={processCrimeStatement}
            hint="Tap stop when done — AI will extract all details automatically"
          />

          {crimeVoice.error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{crimeVoice.error}</span>
            </div>
          )}

          {processingError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{processingError}</span>
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              label="Recorded statement (auto-filled — or type manually)"
              value={crimeVoice.transcript || ""}
              onChange={e => crimeVoice.setTranscript(e.target.value)}
              rows={4}
              placeholder='Speak or type your statement...'
            />

            {correctedText && correctedText !== crimeVoice.transcript && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-2">
                <p className="text-xs font-semibold text-purple-700 mb-1">
                  <Wand2 className="h-3 w-3 inline mr-1" />
                  AI-corrected version:
                </p>
                <p className="text-xs text-purple-800">{correctedText}</p>
              </div>
            )}
          </div>

          {processing && <Spinner label={processingLabel} />}

          {crimeExtracted && !processing && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-green-700 uppercase">✅ Extraction complete</p>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">⚡ AI</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {crimeExtracted.complainantName && <p className="text-xs text-green-800">👤 <strong>Name:</strong> {crimeExtracted.complainantName}</p>}
                {crimeExtracted.complainantPhone && <p className="text-xs text-green-800">📞 <strong>Phone:</strong> {crimeExtracted.complainantPhone}</p>}
                {crimeExtracted.complainantAge && <p className="text-xs text-green-800">🎂 <strong>Age:</strong> {crimeExtracted.complainantAge}</p>}
                {crimeExtracted.incidentDate && <p className="text-xs text-green-800">📅 <strong>Date:</strong> {crimeExtracted.incidentDate}</p>}
                {crimeExtracted.incidentTime && <p className="text-xs text-green-800">🕐 <strong>Time:</strong> {crimeExtracted.incidentTime}</p>}
                {crimeExtracted.crimeType && <p className="text-xs text-green-800 col-span-2">🚨 <strong>Crime:</strong> {crimeExtracted.crimeType}</p>}
                {crimeExtracted.incidentLocation && <p className="text-xs text-green-800 col-span-2">📍 <strong>Location:</strong> {crimeExtracted.incidentLocation}</p>}
              </div>

              {crimeExtracted.ipcSections?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                  <p className="text-xs font-bold text-blue-800">⚖️ BNS Sections (Bharatiya Nyaya Sanhita 2023):</p>
                  {crimeExtracted.ipcSections.map(s => (
                    <div key={s} className="flex items-start gap-2 bg-white rounded-lg px-2 py-1 border border-blue-100 mt-1">
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">§{s}</span>
                      <span className="text-xs text-gray-700">{BNS_DB[s] || "Section " + s}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {crimeVoice.transcript && !crimeExtracted && !processing && (
            <Button full variant="outline" onClick={() => processCrimeStatement(crimeVoice.transcript)}>
              <Sparkles className="h-4 w-4" /> Process with AI
            </Button>
          )}

          {crimeExtracted && !processing && (
            <div className="space-y-2">
              {hasLocationFromCrime ? (
                <div className="flex gap-2">
                  <Button full variant="success" onClick={approveWithCrimeOnly}>
                    <CheckCircle className="h-4 w-4" /> Approve & Continue
                  </Button>
                  <Button variant="outline" onClick={() => setVoiceStep("location")} className="shrink-0 text-xs px-3">
                    + Location
                  </Button>
                </div>
              ) : (
                <Button full onClick={() => setVoiceStep("location")}>
                  Next: Add Location →
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Location */}
      {voiceStep === "location" && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" /> Describe Location
            </h3>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Optional</span>
          </div>

          <MicArea
            voice={locationVoice}
            onStop={processLocationStatement}
            onStart={processLocationStatement}
            hint="Describe landmarks, shops, roads near the crime scene"
          />

          <Textarea
            label="Location details"
            value={locationVoice.transcript || ""}
            onChange={e => locationVoice.setTranscript(e.target.value)}
            rows={3}
            placeholder="Describe the location with landmarks…"
          />

          {processing && <Spinner label={processingLabel} />}

          {locationExtracted && !processing && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs font-bold text-green-700">✅ Location extracted</p>
              {locationExtracted.nearestLandmark && <p className="text-xs text-green-800">🏛️ <strong>Landmark:</strong> {locationExtracted.nearestLandmark}</p>}
              {locationExtracted.locationCity && <p className="text-xs text-green-800">🏙️ <strong>City:</strong> {locationExtracted.locationCity}</p>}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setVoiceStep("crime")}>← Back</Button>
            <Button variant="outline" onClick={approveWithCrimeOnly}>Skip</Button>
            {locationExtracted && !approved && (
              <Button full variant="success" onClick={approveWithLocation}>
                <CheckCircle className="h-4 w-4" /> Approve All
              </Button>
            )}
          </div>
        </div>
      )}

      {approved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm font-medium">
          <CheckCircle className="h-4 w-4" />
          ✅ Approved! Proceed to next step.
        </div>
      )}
    </div>
  );
}