import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, CheckCircle, AlertTriangle, Sparkles, MapPin, FileText, Wand2, Scale } from "lucide-react";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import GroqManager from './GroqManager';
import { calculateCompleteness } from "@/lib/firSchema";
import { formatDateForDisplay, formatTimeForDisplay, parseItemsList, isMeaningfulValue } from "@/utils";
import { determineBnsCandidates } from "@/utils/bnsValidator";

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
  // CHAPTER XVII — Offences against property (Bharatiya Nyaya Sanhita, 2023)
  "303":"Theft (BNS §303)",
  "304":"Snatching (BNS §304)",
  "305":"Theft in dwelling house, transport, or place of worship (BNS §305)",
  "306":"Theft by clerk or servant (BNS §306)",
  "307":"Theft after preparation for hurt or death (BNS §307)",
  "308":"Extortion (BNS §308)",
  "309":"Robbery (BNS §309)",
  "310":"Dacoity (BNS §310)",
  "311":"Robbery or dacoity with attempt to cause death or grievous hurt (BNS §311)",
  "312":"Attempt to commit robbery or dacoity when armed with deadly weapon (BNS §312)",
  "313":"Voluntarily causing hurt in committing robbery (BNS §313)",
  "314":"Dishonest misappropriation of property (BNS §314)",
  "315":"Belonging to gang of dacoits (BNS §315)",
  "316":"Criminal breach of trust (BNS §316)",
  "318":"Cheating and inducing delivery of property (BNS §318)",
  "319":"Cheating by personation (BNS §319)",
  "324":"Mischief (BNS §324)",
  "326":"Mischief by fire or explosive substance (BNS §326)",
  "329":"Criminal trespass and house-trespass (BNS §329)",
  "331":"Lurking house-trespass or house-breaking (BNS §331)",
  "336":"Forgery (BNS §336)",
  "338":"Forgery for purpose of cheating (BNS §338)",
  "340":"Using as genuine a forged document (BNS §340)",
  // Backward-compatibility aliases
  "309B":"Robbery (BNS §309)",
  "310B":"Dacoity (BNS §310)",
  "316A":"Criminal breach of trust — definition (BNS §316(1))",
  "316B":"Criminal breach of trust — punishment (BNS §316(2))",
  "316C":"Criminal breach of trust by public servant (BNS §316(5))",
  "319A":"Cheating by personation (BNS §319)",
  "319B":"Cheating and inducing delivery of property (BNS §318(4))",
  "324A":"Punishment for mischief (BNS §324(2))",
  "325":"Mischief causing damage (BNS §324(3))",
  "329A":"Punishment for criminal trespass (BNS §329(3))",
  "330":"House-trespass (BNS §329(2))",
  "330A":"Punishment for house-trespass (BNS §329(4))",
  "336A":"Forgery (BNS §336)",
  "336B":"Forgery for cheating (BNS §338)",
  "336C":"Using forged document as genuine (BNS §340)",
  // CHAPTER XX — Marriage offences
  "82":"Marrying again during lifetime of spouse (BNS §82)",
  "84":"Enticing or detaining married woman (BNS §84)",
  "85":"Husband or relative subjecting woman to cruelty (BNS §85)",
  "86":"Cruelty — definition (BNS §86)",
  // CHAPTER XXI — Defamation & intimidation
  "356":"Defamation (BNS §356)",
  "351":"Criminal intimidation (BNS §351)",
  "352":"Intentional insult to provoke breach of peace (BNS §352)",
  "351B":"Criminal intimidation with threat (BNS §351(3))",
  "79":"Word or gesture to insult modesty of woman (BNS §79)",
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

function toHTMLDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[\/\-]/);
  if (parts.length !== 3) return "";
  if (parts[0].length === 4) {
    const [yyyy, mm, dd] = parts;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const [dd, mm, yyyy] = parts;
  if (!dd || !mm || !yyyy || yyyy.length !== 4) return "";
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toHTMLTime(time12h) {
  if (!time12h || typeof time12h !== "string") return "";
  const trimmed = time12h.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return "";
  let [, h, m, period] = match;
  h = parseInt(h, 10);
  if (period.toUpperCase() === "PM" && h !== 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2,"0")}:${m}`;
}

function normalizeExtracted(extracted) {
  if (!extracted) return extracted;
  const rawItems = extracted.stolenItems || extracted.propertyItems || extracted.items || "";
  const items = parseItemsList(rawItems);
  return {
    ...extracted,
    incidentDate: toHTMLDate(extracted.incidentDate) || extracted.incidentDate || "",
    incidentTime: toHTMLTime(extracted.incidentTime) || extracted.incidentTime || "",
    stolenItems: items.length > 0 ? items.join(", ") : (typeof rawItems === "string" ? rawItems.trim() : ""),
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

export default function VoiceRecorder({ language, onComplete, onApprove, existingForm, provenance }) {
  const [voiceStep, setVoiceStep] = useState("crime");
  const [rawTranscript, setRawTranscript] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [crimeExtracted, setCrimeExtracted] = useState(() => {
    if (existingForm && (existingForm.complainantName || existingForm.crimeType || existingForm.incidentDate || existingForm.stolenItems)) {
      return {
        complainantName: existingForm.complainantName,
        complainantPhone: existingForm.complainantPhone,
        complainantAge: existingForm.complainantAge,
        incidentDate: existingForm.incidentDate,
        incidentTime: existingForm.incidentTime,
        crimeType: existingForm.crimeType,
        incidentLocation: existingForm.incidentLocation,
        stolenItems: existingForm.stolenItems,
        suspectDescription: existingForm.suspectDescription,
        weaponUsed: existingForm.weaponUsed,
        vehicleNumber: existingForm.vehicleNumber,
        ipcSections: existingForm.ipcSections,
      };
    }
    return null;
  });
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

  // GroqManager uses a server-side proxy (/api/ai/groq) — no client-side API key needed.
  useEffect(() => {
    groqManagerRef.current = new GroqManager();
  }, []);

  // Provenance-aware resolution: manual citizen edits ALWAYS take precedence over AI suggestions
  const isFieldEdited = (field) => Boolean(provenance?.[field]?.editedByUser);

  const getEffectiveValue = (field, fallback = "") => {
    if (isFieldEdited(field)) {
      return existingForm?.[field] ?? fallback;
    }
    return crimeExtracted?.[field] || existingForm?.[field] || fallback;
  };

  const currentName = getEffectiveValue("complainantName");
  const currentPhone = getEffectiveValue("complainantPhone");
  const currentAge = getEffectiveValue("complainantAge");
  const currentCrime = getEffectiveValue("crimeType");
  const currentDate = getEffectiveValue("incidentDate");
  const currentTime = getEffectiveValue("incidentTime");
  const currentLocation = getEffectiveValue("incidentLocation");
  const currentItemsRaw = getEffectiveValue("stolenItems");
  const currentItems = parseItemsList(currentItemsRaw);
  const currentSuspect = getEffectiveValue("suspectDescription");
  const currentVehicle = getEffectiveValue("vehicleNumber");
  const currentWeapon = getEffectiveValue("weaponUsed");

  const currentIPC = (existingForm?.ipcSections?.length ? existingForm.ipcSections : (crimeExtracted?.ipcSections || crimeExtracted?.bnsSections)) || [];

  const hasExtractedData = Boolean(
    crimeExtracted ||
    (existingForm && (
      existingForm.complainantName ||
      existingForm.crimeType ||
      existingForm.incidentDate ||
      existingForm.stolenItems ||
      existingForm.incidentLocation
    ))
  );

  const hasLocationFromCrime = !!(
    currentLocation ||
    existingForm?.locationCity ||
    crimeExtracted?.locationCity ||
    existingForm?.nearestLandmark ||
    crimeExtracted?.nearestLandmark
  );

  const processCrimeStatement = async (rawText) => {
    if (!rawText?.trim()) return;

    if (!groqManagerRef.current) {
      groqManagerRef.current = new GroqManager();
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

BNS SECTIONS (Bharatiya Nyaya Sanhita 2023 — Act No. 45 of 2023):
- Theft without confrontation / unattended property: ["303"]
- Theft: ["303"]
- Snatching (sudden, quick or forcible grab from person/possession): ["304"]
- Robbery: ["309"]
- Dacoity: ["310"]
- Extortion: ["308"]
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
- Cheating / Fraud: ["318"]
- Criminal breach of trust: ["316"]
- Domestic violence / Cruelty to wife: ["85"]
- Dowry death: ["80"]
- Forgery: ["336"]
- Criminal trespass: ["329"]
- Criminal intimidation: ["351"]
- Outrage modesty of woman: ["74"]
- Cybercrime / Identity theft: ["66C"] (IT Act)
- Online fraud: ["66D"] (IT Act)

NO FABRICATION MANDATE:
- DO NOT invent suspect, weapon, vehicle, CCTV, or force if not explicitly stated.
- If property was left unattended or missing while away, it is strictly Theft ["303"], NOT Snatching ["304"].
- Snatching ["304"] requires explicit sudden, quick, or forcible seizure from person.

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
  "bnsSections": [],  // Suggested BNS section numbers (non-authoritative)
  "ipcDetails": ""
}`,
        },
        {
          role: "user",
          content: `Extract FIR details from this statement. Return ONLY valid JSON:\n\n"${correctedEnglish}"`,
        },
      ], 1400);

      // Parse with safe error handling — NEVER fabricate fake fallback data
      let extracted = {};
      try {
        extracted = GroqManager.safeParseJSON(extractedRaw);
      } catch (parseErr) {
        console.warn("Structured parse issue:", parseErr.message);
        setProcessingError("AI structured extraction failed to parse. Your spoken statement is preserved. You can edit details directly or tap Retry AI.");
        extracted = {};
      }

      // Deterministic Legal Candidate Classification (Rule engine takes authority over LLM hallucination)
      const deterministicCandidates = determineBnsCandidates({
        description: correctedEnglish,
        crimeType: extracted.crimeType,
        stolenItems: extracted.stolenItems,
      });

      const finalLegalSuggestions = deterministicCandidates.length > 0
        ? deterministicCandidates
        : (extracted.bnsSections || []).map(sec => ({
            act: "BNS 2023",
            section: String(sec).replace(/^§/, "").trim(),
            title: `BNS §${String(sec).replace(/^§/, "").trim()}`,
            explanation: "AI legal suggestion based on statement extraction",
            confidence: 0.70,
            source: "AI",
            verifiedByPolice: false,
            verifiedByOfficerBadge: null,
            verifiedAt: null,
          }));

      const finalSections = finalLegalSuggestions.map(s => s.section);
      extracted.bnsSections = finalSections;
      extracted.ipcSections = finalSections;
      extracted.legalSuggestions = finalLegalSuggestions;

      setCrimeExtracted(extracted);
      
      const normalized = normalizeExtracted(extracted);
      latestExtractedRef.current = normalized;

      const honestScore = Math.max(0.3, calculateCompleteness(normalized) / 100);

      onComplete?.({ 
        text: correctedEnglish,          // English description
        rawText: rawText,                // Preserve raw spoken audio text
        extracted: normalized, 
        confidence: honestScore, 
        language 
      });

    } catch (err) {
      console.error("Processing failed:", err);
      setProcessingError(`AI extraction unavailable (${err.message}). Your spoken statement is preserved below. You can edit directly or tap Retry AI.`);
      
      // Still provide the raw text so user can proceed manually without fabricated data
      onComplete?.({ 
        text: rawText, 
        rawText: rawText,
        extracted: {}, 
        confidence: null, 
        language,
        error: err.message
      });
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
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

      let result = {};
      try {
        result = GroqManager.safeParseJSON(extractedRaw);
      } catch (_) {
        result = {};
      }
      setLocationExtracted(result);
    } catch (err) {
      console.error("Location extraction failed:", err);
      setLocationExtracted({ 
        incidentLocation: rawText, 
        searchQuery: rawText,
        nearestLandmark: ""
      });
    } finally {
      setProcessing(false);
      setProcessingLabel("");
    }
  };

  const approveWithCrimeOnly = () => {
    setApproved(true);
    onApprove?.();
  };

  const approveWithLocation = () => {
    if (!locationExtracted) return;
    const base = latestExtractedRef.current || crimeExtracted || existingForm || {};
    const merged = {
      ...base,
      incidentLocation: locationExtracted.incidentLocation || base.incidentLocation || "",
      nearestLandmark: locationExtracted.nearestLandmark || base.nearestLandmark || "",
      locationArea: locationExtracted.locationArea || base.locationArea || "",
      locationCity: locationExtracted.locationCity || base.locationCity || "",
      fullLocationDescription: locationExtracted.fullLocationDescription || "",
    };
    setApproved(true);
    const honestScore = Math.max(0.3, calculateCompleteness(merged) / 100);
    onComplete?.({
      text: (crimeVoice.transcript + " " + locationVoice.transcript).trim(),
      rawText: (crimeVoice.transcript + " " + locationVoice.transcript).trim(),
      extracted: merged,
      confidence: honestScore,
      language,
    });
    onApprove?.();
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
            <div className="bg-blue-50 rounded-lg p-2.5 mt-2">
              <p className="text-xs text-blue-700 font-semibold">💡 What to state clearly:</p>
              <p className="text-xs text-blue-600 mt-0.5 leading-relaxed">
                State your full name, contact mobile number, date and time of the incident, the specific location, and what happened in your own words.
              </p>
            </div>
          </div>

          <MicArea
            voice={crimeVoice}
            onStop={processCrimeStatement}
            onStart={processCrimeStatement}
            hint="Tap stop when done — speech recognition will transcribe your statement"
          />

          {crimeVoice.error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{crimeVoice.error}</span>
            </div>
          )}

          {processingError && (
            <div className="flex items-start justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{processingError}</span>
              </div>
              <button
                type="button"
                onClick={() => processCrimeStatement(crimeVoice.transcript)}
                className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-xs shrink-0 transition cursor-pointer"
              >
                Retry AI
              </button>
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

          {hasExtractedData && !processing && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-green-200/60 pb-2">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  EXTRACTION COMPLETE
                </p>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  ⚡ AI
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-green-900">
                {isMeaningfulValue(currentName) && (
                  <p>👤 <strong>Name:</strong> {currentName}</p>
                )}
                {isMeaningfulValue(currentPhone) && (
                  <p>📞 <strong>Phone:</strong> {currentPhone}</p>
                )}
                {isMeaningfulValue(currentAge) && (
                  <p>🎂 <strong>Age:</strong> {currentAge}</p>
                )}
                {isMeaningfulValue(currentCrime) && (
                  <p className="sm:col-span-2">🚨 <strong>Crime:</strong> {currentCrime}</p>
                )}
                {isMeaningfulValue(currentDate) && (
                  <p>📅 <strong>Date:</strong> {formatDateForDisplay(currentDate)}</p>
                )}
                {isMeaningfulValue(currentTime) && (
                  <p>🕐 <strong>Time:</strong> {formatTimeForDisplay(currentTime)}</p>
                )}
                {isMeaningfulValue(currentLocation) && (
                  <p className="sm:col-span-2">📍 <strong>Location:</strong> {currentLocation}</p>
                )}

                {/* Stolen / Property Items */}
                {currentItems.length > 0 && (
                  <div className="sm:col-span-2 pt-2 mt-1 border-t border-green-200/70">
                    <p className="font-bold text-green-900 flex items-center gap-1 mb-1">
                      <span>💼</span> <span>ITEMS:</span>
                    </p>
                    <ul className="space-y-0.5 pl-2 text-green-950 font-medium">
                      {currentItems.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="text-green-600 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suspect info (only if stated) */}
                {isMeaningfulValue(currentSuspect) && (
                  <p className="sm:col-span-2 pt-1 border-t border-green-200/50">
                    👤 <strong>Suspect:</strong> {currentSuspect}
                  </p>
                )}

                {/* Vehicle info (only if stated) */}
                {isMeaningfulValue(currentVehicle) && (
                  <p className="sm:col-span-2 pt-1 border-t border-green-200/50">
                    🚗 <strong>Vehicle:</strong> {currentVehicle}
                  </p>
                )}

                {/* Weapon info (only if stated) */}
                {isMeaningfulValue(currentWeapon) && (
                  <p className="sm:col-span-2 pt-1 border-t border-green-200/50">
                    🔪 <strong>Weapon:</strong> {currentWeapon}
                  </p>
                )}
              </div>

              {currentIPC?.length > 0 && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-2.5 mt-2 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-blue-700" />
                      <span>Suggested BNS Sections</span>
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                      AI Suggestion
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-700 italic">
                    AI legal suggestion — requires police verification
                  </p>
                  <div className="pt-1 space-y-1">
                    {currentIPC.map(s => {
                      const secCode = typeof s === "object" ? s.section : String(s).replace(/^§/, "");
                      return (
                        <div key={secCode} className="flex items-start gap-2 bg-white rounded-lg px-2 py-1 border border-blue-100">
                          <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">§{secCode}</span>
                          <span className="text-xs text-gray-700">{BNS_DB[secCode] || "Section " + secCode}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {crimeVoice.transcript && !hasExtractedData && !processing && (
            <Button full variant="outline" onClick={() => processCrimeStatement(crimeVoice.transcript)}>
              <Sparkles className="h-4 w-4" /> Process with AI
            </Button>
          )}

          {hasExtractedData && !processing && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button full variant="success" onClick={approveWithCrimeOnly}>
                  <CheckCircle className="h-4 w-4" /> Approve & Continue
                </Button>
                <Button variant="outline" onClick={() => setVoiceStep("location")} className="shrink-0 text-xs px-3">
                  {hasLocationFromCrime ? "+ Location" : "Next: Add Location →"}
                </Button>
              </div>
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