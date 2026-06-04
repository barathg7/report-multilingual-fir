/**
 * SuspectSketch.jsx
 *
 * Primary:   Cloudflare Workers AI  (VITE_CF_AI_TOKEN + VITE_CF_ACCOUNT_ID)
 * Backup 1:  NVIDIA NIM SDXL        (VITE_NGC_API_KEY)
 * Backup 2:  NVIDIA NIM Flux        (VITE_NGC_FLUX_API_KEY)
 * Backup 3:  Pollinations AI        (free, no key — CORS-safe)
 * Backup 4:  Hugging Face           (free, no key — CORS-safe)
 *
 * .env:
 *   VITE_CF_AI_TOKEN=cfut_xxxxxxxxxxxx
 *   VITE_CF_ACCOUNT_ID=xxxxxxxxxxxx        ← get from dash.cloudflare.com (right sidebar)
 *   VITE_NGC_API_KEY=nvapi-xxxxxxxxxxxx    (optional)
 *   VITE_NGC_FLUX_API_KEY=nvapi-xxxxxxxxxx (optional)
 *   VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxxxxx
 */
import { useState, useRef } from "react";
import {
  User, AlertTriangle, Loader2, RefreshCw,
  CheckCircle, Sparkles, Mic, MicOff, Zap,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";

// ── Cloudflare Workers AI models (text-to-image) ──────────────────────────────
// https://developers.cloudflare.com/workers-ai/models/#text-to-image
const CF_MODELS = [
  "@cf/black-forest-labs/flux-1-schnell",  // Best quality, fast
  "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  "@cf/lykon/dreamshaper-8-lcm",
  "@cf/bytedance/stable-diffusion-xl-lightning",
];

// ── NVIDIA NIM endpoints ──────────────────────────────────────────────────────
const NVIDIA_ENDPOINTS = [
  "https://ai.api.nvidia.com/v1/genai/stabilityai/sdxl-turbo",
  "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium",
  "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-xl",
];
const NVIDIA_FLUX_ENDPOINTS = [
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-schnell",
  "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux-dev",
];

// ── Language map ──────────────────────────────────────────────────────────────
const LANG_MAP = {
  ta:"ta-IN",hi:"hi-IN",en:"en-IN",te:"te-IN",kn:"kn-IN",
  ml:"ml-IN",mr:"mr-IN",bn:"bn-IN",gu:"gu-IN",pa:"pa-IN",
  ur:"ur-PK",or:"or-IN",as:"as-IN",mai:"hi-IN",ks:"ur-PK",
  sd:"ur-PK",sat:"hi-IN",ne:"ne-NP",kok:"mr-IN",mni:"bn-IN",
  doi:"hi-IN",sa:"hi-IN",ar:"ar-SA",fr:"fr-FR",de:"de-DE",
  es:"es-ES",pt:"pt-PT",it:"it-IT",ru:"ru-RU",zh:"zh-CN",
  ja:"ja-JP",ko:"ko-KR",nl:"nl-NL",sv:"sv-SE",no:"nb-NO",
  da:"da-DK",fi:"fi-FI",pl:"pl-PL",tr:"tr-TR",he:"he-IL",
  th:"th-TH",vi:"vi-VN",id:"id-ID",ms:"ms-MY",uk:"uk-UA",
  cs:"cs-CZ",ro:"ro-RO",hu:"hu-HU",el:"el-GR",bg:"bg-BG",
};

// ── Cross-browser AbortSignal helper ─────────────────────────────────────────
function makeTimeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  controller.signal._clearTimer = () => clearTimeout(timer);
  return controller.signal;
}

// ── Build forensic sketch prompt ──────────────────────────────────────────────
function buildSketchPrompt(description) {
  const safeDesc = description.trim().length < 20
    ? `${description}, male person, front facing portrait, detailed face`
    : description;
  return (
    `forensic police composite sketch, pencil and charcoal portrait, ` +
    `black and white, front facing neutral expression, ${safeDesc}, ` +
    `detailed facial features, professional law enforcement sketch style, ` +
    `high detail, photorealistic pencil drawing`
  );
}

// ═══════════════════════════════════════════════════════
// 1. CLOUDFLARE WORKERS AI (Primary)
// ═══════════════════════════════════════════════════════
async function generateWithCloudflare(description, token, accountId) {
  if (!token || !accountId) throw new Error("CF token or account ID missing");

  const prompt = buildSketchPrompt(description);

  for (const model of CF_MODELS) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
      const signal = makeTimeoutSignal(45000);

      let res;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({
            prompt,
            negative_prompt: "color, realistic photo, background noise, bad anatomy, extra limbs, blurry, watermark, nsfw",
            num_steps: 20,
            guidance: 7.5,
            width:  512,
            height: 768,
          }),
          signal,
        });
      } finally {
        signal._clearTimer?.();
      }

      if (res.status === 404 || res.status === 405) {
        console.warn(`CF model ${model} not available, trying next…`);
        continue;
      }
      if (res.status === 401) throw new Error("Invalid Cloudflare API token.");
      if (res.status === 429) throw new Error("Cloudflare rate limit reached.");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = err?.errors?.[0]?.message || err?.message || `HTTP ${res.status}`;
        console.warn(`CF model ${model} error: ${msg}`);
        continue;
      }

      // CF returns raw binary image bytes (not JSON)
      const contentType = res.headers.get("content-type") || "image/png";
      if (contentType.includes("application/json")) {
        // Some models return JSON with base64
        const data = await res.json();
        if (data?.result?.image) return `data:image/png;base64,${data.result.image}`;
        if (data?.result)        return `data:image/png;base64,${data.result}`;
        console.warn(`CF model ${model} returned unexpected JSON, trying next…`);
        continue;
      }

      // Binary image blob → data URL
      const blob    = await res.blob();
      const dataUrl = await blobToDataUrl(blob);
      console.log(`✅ Cloudflare Workers AI success with ${model}`);
      return dataUrl;

    } catch (e) {
      if (
        e.message.includes("Invalid Cloudflare") ||
        e.message.includes("rate limit")
      ) throw e; // hard stop — don't try other models
      console.warn(`CF model ${model} failed:`, e.message);
    }
  }

  throw new Error("All Cloudflare Workers AI models failed.");
}

// ═══════════════════════════════════════════════════════
// 2. NVIDIA NIM SDXL (Backup 1)
// ═══════════════════════════════════════════════════════
function parseNvidiaResponse(data) {
  if (data?.artifacts?.[0]?.base64) return `data:image/png;base64,${data.artifacts[0].base64}`;
  if (data?.image)                   return `data:image/png;base64,${data.image}`;
  if (data?.images?.[0])             return `data:image/png;base64,${data.images[0]}`;
  if (data?.data?.[0]?.b64_json)     return `data:image/png;base64,${data.data[0].b64_json}`;
  return null;
}

async function fetchNvidiaEndpoint(endpoint, body, apiKey) {
  const signal = makeTimeoutSignal(30000);
  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Accept":        "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } finally {
    signal._clearTimer?.();
  }
  if (res.status === 404 || res.status === 405) return null;
  if (res.status === 402) throw new Error("NVIDIA credits exhausted.");
  if (res.status === 401) throw new Error("Invalid NVIDIA API key.");
  if (res.status === 429) throw new Error("NVIDIA rate limit reached.");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`NVIDIA error ${res.status}: ${err?.detail || err?.message || "unknown"}`);
  }
  const data = await res.json();
  const imgSrc = parseNvidiaResponse(data);
  if (!imgSrc) throw new Error("Unrecognized NVIDIA response format");
  return imgSrc;
}

async function generateWithNvidia(description, apiKey) {
  const body = {
    prompt: buildSketchPrompt(description),
    negative_prompt: "color, realistic photo, background, bad anatomy, extra limbs, blurry, watermark",
    cfg_scale: 5,
    seed: Math.floor(Math.random() * 9999),
    steps: 20,
    width: 512,
    height: 512,
  };
  for (const endpoint of NVIDIA_ENDPOINTS) {
    try {
      const imgSrc = await fetchNvidiaEndpoint(endpoint, body, apiKey);
      if (imgSrc) return imgSrc;
    } catch (e) {
      if (e.message.includes("credits") || e.message.includes("Invalid NVIDIA") || e.message.includes("rate limit")) throw e;
      console.warn(`NVIDIA endpoint ${endpoint} failed:`, e.message);
    }
  }
  throw new Error("All NVIDIA SDXL endpoints failed.");
}

// ═══════════════════════════════════════════════════════
// 3. NVIDIA NIM Flux (Backup 2)
// ═══════════════════════════════════════════════════════
async function generateWithNvidiaFlux(description, apiKey) {
  const body = {
    prompt: buildSketchPrompt(description),
    negative_prompt: "color, realistic photo, bad anatomy, blurry, watermark",
    seed: Math.floor(Math.random() * 9999),
    steps: 20,
    width: 512,
    height: 512,
    guidance: 3.5,
  };
  for (const endpoint of NVIDIA_FLUX_ENDPOINTS) {
    try {
      const imgSrc = await fetchNvidiaEndpoint(endpoint, body, apiKey);
      if (imgSrc) return imgSrc;
    } catch (e) {
      if (e.message.includes("credits") || e.message.includes("Invalid NVIDIA") || e.message.includes("rate limit")) throw e;
      console.warn(`Flux endpoint ${endpoint} failed:`, e.message);
    }
  }
  throw new Error("All NVIDIA Flux endpoints failed.");
}

// ═══════════════════════════════════════════════════════
// 4. Pollinations AI (Backup 3)
// ═══════════════════════════════════════════════════════
async function generateWithPollinations(description) {
  const prompt = encodeURIComponent(buildSketchPrompt(description));
  const seed   = Math.floor(Math.random() * 99999);
  const urls   = [
    `https://image.pollinations.ai/prompt/${prompt}?width=512&height=640&seed=${seed}&nologo=true&model=flux`,
    `https://image.pollinations.ai/prompt/${prompt}?width=512&height=640&seed=${seed}&nologo=true&model=turbo`,
    `https://image.pollinations.ai/prompt/${prompt}?width=512&height=512&seed=${seed}&nologo=true`,
  ];
  for (const url of urls) {
    const ok = await probeImageUrl(url, 30000);
    if (ok) return url;
    console.warn("Pollinations URL failed:", url);
  }
  throw new Error("All Pollinations URLs failed.");
}

function probeImageUrl(url, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const img   = new Image();
    const timer = setTimeout(() => { img.src = ""; resolve(false); }, timeoutMs);
    img.onload  = () => { clearTimeout(timer); resolve(true);  };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src     = url;
  });
}

// ═══════════════════════════════════════════════════════
// 5. Hugging Face (Backup 4)
// ═══════════════════════════════════════════════════════
async function generateWithHuggingFace(description) {
  const HF_MODELS = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-2-1",
    "CompVis/stable-diffusion-v1-4",
  ];
  for (const model of HF_MODELS) {
    try {
      const result = await fetchHuggingFaceModel(model, description);
      if (result) return result;
    } catch (e) {
      console.warn(`HF model ${model} error:`, e.message);
    }
  }
  throw new Error("All Hugging Face models failed.");
}

async function fetchHuggingFaceModel(model, description) {
  const url     = `https://api-inference.huggingface.co/models/${model}`;
  const body    = JSON.stringify({
    inputs: `police forensic sketch: ${description}, pencil art, black and white, front facing portrait, detailed`,
    parameters: { num_inference_steps: 20 },
  });
  const headers = { "Content-Type": "application/json" };
  const signal1 = makeTimeoutSignal(45000);
  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body, signal: signal1 });
  } finally {
    signal1._clearTimer?.();
  }
  if (res.status === 503) {
    const waitMs = Math.min(parseInt(res.headers.get("X-Wait-For-Model") || "10", 10) * 1000, 15000);
    await new Promise((r) => setTimeout(r, waitMs));
    const signal2 = makeTimeoutSignal(45000);
    let res2;
    try {
      res2 = await fetch(url, { method: "POST", headers, body, signal: signal2 });
    } finally {
      signal2._clearTimer?.();
    }
    if (!res2.ok) return null;
    return blobToDataUrl(await res2.blob());
  }
  if (!res.ok) return null;
  return blobToDataUrl(await res.blob());
}

// ── Blob → data URL ───────────────────────────────────────────────────────────
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader   = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

// ═══════════════════════════════════════════════════════
// Groq: Extract suspect description from voice
// ═══════════════════════════════════════════════════════
async function extractSuspectFromVoice(rawText, languageName, apiKey) {
  if (!apiKey?.trim()) throw new Error("VITE_GROQ_API_KEY is not set.");
  const signal = makeTimeoutSignal(30000);
  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 400,
        temperature: 0.0,
        messages: [
          {
            role: "system",
            content: `You are a police forensic assistant. Extract physical suspect details from a ${languageName} voice statement.
Extract: gender, age, height, build, skin tone, face shape, hair (length/style/color), facial hair, eyes, nose, distinguishing features (scars/tattoos/marks), clothing.
Return ONLY raw JSON (no markdown):
{"sketchDescription":"2-3 sentence English description for sketch artist","gender":"","age":"","height":"","build":"","skinTone":"","hair":"","facialHair":"","distinguishingFeatures":"","clothing":"","summary":"One-line summary"}`,
          },
          {
            role: "user",
            content: `Extract suspect from this ${languageName} statement:\n\n"${rawText}"\n\nReturn only JSON.`,
          },
        ],
      }),
      signal,
    });
  } finally {
    signal._clearTimer?.();
  }
  if (!res.ok) throw new Error(`Groq API error ${res.status}`);
  const data    = await res.json();
  const raw     = data.choices?.[0]?.message?.content || "{}";
  const cleaned = raw.replace(/```json|```/gi, "").trim();
  const match   = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in Groq response");
  return JSON.parse(match[0]);
}

// ═══════════════════════════════════════════════════════
// Voice capture hook
// ═══════════════════════════════════════════════════════
function useVoiceCapture(language) {
  const [recording,  setRecording]  = useState(false);
  const [transcript, setTranscript] = useState("");
  const [dots,       setDots]       = useState("");
  const [error,      setError]      = useState("");
  const recognitionRef  = useRef(null);
  const dotsRef         = useRef(null);
  const isRecordingRef  = useRef(false);
  const transcriptRef   = useRef("");

  const start = (onDone) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Chrome browser for voice recording."); return; }
    setError(""); setTranscript(""); transcriptRef.current = ""; isRecordingRef.current = true;
    const r = new SR();
    recognitionRef.current = r;
    r.lang = LANG_MAP[language?.code] || "en-IN";
    r.continuous = false; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text    = e.results[0][0].transcript;
      const updated = transcriptRef.current ? transcriptRef.current + " " + text : text;
      transcriptRef.current = updated.trim();
      setTranscript(updated.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") {
        setError("Microphone access denied."); isRecordingRef.current = false; setRecording(false); clearInterval(dotsRef.current);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Speech error:", e.error); isRecordingRef.current = false; setRecording(false); clearInterval(dotsRef.current);
        setError(`Microphone error: ${e.error}. Please try again.`);
      }
    };
    r.onend = () => {
      if (isRecordingRef.current) {
        try { r.start(); } catch (_) {}
      } else {
        setRecording(false); clearInterval(dotsRef.current);
        const final = transcriptRef.current.trim();
        if (final && typeof onDone === "function") onDone(final);
      }
    };
    try { r.start(); } catch (e) { setError("Could not start microphone: " + e.message); isRecordingRef.current = false; return; }
    setRecording(true);
    let d = 0;
    dotsRef.current = setInterval(() => { d = (d + 1) % 4; setDots(".".repeat(d)); }, 500);
    setTimeout(() => { if (isRecordingRef.current) { isRecordingRef.current = false; try { r.stop(); } catch (_) {} } }, 90000);
  };

  const stop = (onDone) => {
    isRecordingRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    clearInterval(dotsRef.current); setRecording(false);
    const final = transcriptRef.current.trim();
    if (final && typeof onDone === "function") onDone(final);
  };

  return { recording, transcript, setTranscript, dots, error, start, stop };
}

// ═══════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════
export default function SuspectSketch({ onSketchGenerated, initialDescription = "", language = null }) {
  const CF_TOKEN      = import.meta.env.VITE_CF_AI_TOKEN      || "";
  const CF_ACCOUNT    = import.meta.env.VITE_CF_ACCOUNT_ID    || "";
  const NGC_KEY       = import.meta.env.VITE_NGC_API_KEY      || "";
  const NGC_FLUX_KEY  = import.meta.env.VITE_NGC_FLUX_API_KEY || "";
  const GROQ_KEY      = import.meta.env.VITE_GROQ_API_KEY     || "";

  const [description,      setDescription]     = useState(initialDescription);
  const [sketchUrl,        setSketchUrl]        = useState(null);
  const [loading,          setLoading]          = useState(false);
  const [status,           setStatus]           = useState("");
  const [error,            setError]            = useState("");
  const [source,           setSource]           = useState("");
  const [extracting,       setExtracting]       = useState(false);
  const [extractError,     setExtractError]     = useState("");
  const [extractedDetails, setExtractedDetails] = useState(null);

  const suspectVoice = useVoiceCapture(language);

  const handleVoiceDone = async (text) => {
    const safeText = (text?.trim()) || suspectVoice.transcript?.trim();
    if (!safeText) return;
    setExtracting(true); setExtractError(""); setExtractedDetails(null);
    try {
      const result = await extractSuspectFromVoice(safeText, language?.name || "English", GROQ_KEY);
      setExtractedDetails(result);
      if (result.sketchDescription) setDescription(result.sketchDescription);
    } catch (e) {
      setExtractError(`Could not extract details: ${e.message}. You can edit manually.`);
      setDescription(safeText);
    } finally {
      setExtracting(false);
    }
  };

  const finishGeneration = (imgSrc, srcKey) => {
    setSketchUrl(imgSrc); setSource(srcKey); setStatus(""); setLoading(false);
    onSketchGenerated?.({ url: imgSrc, description });
  };

  // ── Generate cascade: CF → NVIDIA → Flux → Pollinations → HF ───────────────
  const generate = async () => {
    if (!description.trim()) { setError("Please describe the suspect's appearance first."); return; }
    setLoading(true); setError(""); setSketchUrl(null); setSource("");

    // 1️⃣  Cloudflare Workers AI (primary)
    if (CF_TOKEN && CF_ACCOUNT) {
      try {
        setStatus("⚡ Generating with Cloudflare Workers AI…");
        const imgSrc = await generateWithCloudflare(description, CF_TOKEN, CF_ACCOUNT);
        finishGeneration(imgSrc, "cloudflare");
        return;
      } catch (e) {
        console.warn("Cloudflare failed:", e.message);
        setStatus("⚠️ Cloudflare unavailable — trying NVIDIA NIM…");
      }
    }

    // 2️⃣  NVIDIA NIM SDXL
    if (NGC_KEY) {
      try {
        setStatus("⚡ Generating with NVIDIA NIM…");
        const imgSrc = await generateWithNvidia(description, NGC_KEY);
        finishGeneration(imgSrc, "nvidia");
        return;
      } catch (e) {
        console.warn("NVIDIA SDXL failed:", e.message);
        setStatus("⚠️ NVIDIA unavailable — trying NVIDIA Flux…");
      }
    }

    // 3️⃣  NVIDIA NIM Flux
    if (NGC_FLUX_KEY) {
      try {
        setStatus("⚡ Generating with NVIDIA Flux…");
        const imgSrc = await generateWithNvidiaFlux(description, NGC_FLUX_KEY);
        finishGeneration(imgSrc, "flux");
        return;
      } catch (e) {
        console.warn("NVIDIA Flux failed:", e.message);
        setStatus("⚠️ NVIDIA Flux unavailable — trying Pollinations AI…");
      }
    }

    // 4️⃣  Pollinations AI
    try {
      setStatus("🌐 Generating with Pollinations AI…");
      const imgSrc = await generateWithPollinations(description);
      finishGeneration(imgSrc, "pollinations");
      return;
    } catch (e) {
      console.warn("Pollinations failed:", e.message);
      setStatus("⚠️ Pollinations unavailable — trying Hugging Face…");
    }

    // 5️⃣  Hugging Face
    try {
      setStatus("🤗 Generating with Hugging Face…");
      const imgSrc = await generateWithHuggingFace(description);
      finishGeneration(imgSrc, "huggingface");
    } catch (e) {
      setError(`Sketch generation failed on all providers: ${e.message}`);
      setStatus(""); setLoading(false);
    }
  };

  const SOURCE_BADGES = {
    cloudflare:   { label: "☁️ Cloudflare Workers AI", cls: "bg-orange-100 text-orange-700" },
    nvidia:       { label: "⚡ NVIDIA NIM",             cls: "bg-green-100 text-green-700"   },
    flux:         { label: "⚡ NVIDIA Flux",             cls: "bg-emerald-100 text-emerald-700" },
    pollinations: { label: "🌐 Pollinations AI",         cls: "bg-blue-100 text-blue-700"     },
    huggingface:  { label: "🤗 Hugging Face",            cls: "bg-yellow-100 text-yellow-700" },
  };
  const sourceBadge = SOURCE_BADGES[source];
  const hasCF       = CF_TOKEN && CF_ACCOUNT;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <User className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">AI Suspect Sketch</h3>
        {hasCF ? (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
            ☁️ Cloudflare Workers AI + 4 Backups
          </span>
        ) : (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            🌐 Pollinations + 🤗 HF Backup
          </span>
        )}
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>AI-generated sketch — for investigative reference only. Not admissible as primary evidence in court.</span>
      </div>

      {/* Provider status */}
      {hasCF ? (
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800 flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-orange-600" />
          <span>
            <strong>Cloudflare Workers AI</strong> active (FLUX.1-schnell → SDXL → DreamShaper → SDXL Lightning).
            Fallbacks: NVIDIA NIM → Pollinations → Hugging Face.
          </span>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
          💡 Add{" "}
          <code className="bg-blue-100 px-1 rounded">VITE_CF_AI_TOKEN</code> and{" "}
          <code className="bg-blue-100 px-1 rounded">VITE_CF_ACCOUNT_ID</code> to{" "}
          <code className="bg-blue-100 px-1 rounded">.env</code> for Cloudflare Workers AI.
          Using Pollinations AI → Hugging Face as fallbacks.
        </div>
      )}

      {/* ── VOICE INPUT ─────────────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
            <Mic className="h-4 w-4" /> Describe Suspect by Voice
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Speak in {language?.native || "your language"} — Groq AI extracts physical details automatically
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 py-4 border-2 border-dashed border-blue-200 rounded-xl bg-white">
          <button
            onClick={
              suspectVoice.recording
                ? () => suspectVoice.stop(handleVoiceDone)
                : () => suspectVoice.start(() => {})
            }
            className={`h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all ${
              suspectVoice.recording
                ? "bg-red-500 animate-pulse scale-110"
                : "bg-blue-600 hover:bg-blue-700 hover:scale-105"
            }`}
          >
            {suspectVoice.recording
              ? <MicOff className="h-7 w-7 text-white" />
              : <Mic    className="h-7 w-7 text-white" />}
          </button>

          {suspectVoice.recording && (
            <div className="flex items-end gap-1 h-5">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="w-1.5 bg-red-400 rounded-full animate-bounce"
                  style={{ height:`${8+(i%3)*5}px`, animationDelay:`${i*0.1}s` }} />
              ))}
            </div>
          )}

          <p className="text-sm text-gray-600 font-medium text-center">
            {suspectVoice.recording
              ? `🔴 Listening${suspectVoice.dots} — Tap to stop`
              : "🎙️ Tap to describe suspect by voice"}
          </p>
        </div>

        {suspectVoice.error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4" /> {suspectVoice.error}
          </div>
        )}

        {suspectVoice.transcript && (
          <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm text-gray-700">
            <p className="text-xs text-blue-500 font-medium mb-1">🎙️ Voice transcript:</p>
            <p>{suspectVoice.transcript}</p>
          </div>
        )}

        {extracting && (
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span><strong>Groq AI</strong> is extracting suspect details…</span>
          </div>
        )}

        {suspectVoice.transcript && !extractedDetails && !extracting && (
          <Button full variant="outline" onClick={() => handleVoiceDone(suspectVoice.transcript)}>
            <Sparkles className="h-4 w-4" /> Extract Suspect Details with Groq AI
          </Button>
        )}

        {extractError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4" /> {extractError}
          </div>
        )}

        {extractedDetails && !extracting && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide">✅ Suspect details extracted</p>
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">⚡ Groq AI</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm text-green-800">
              {extractedDetails.gender                 && <p>🧑 <strong>Gender:</strong> {extractedDetails.gender}</p>}
              {extractedDetails.age                    && <p>🎂 <strong>Age:</strong> {extractedDetails.age}</p>}
              {extractedDetails.height                 && <p>📏 <strong>Height:</strong> {extractedDetails.height}</p>}
              {extractedDetails.build                  && <p>💪 <strong>Build:</strong> {extractedDetails.build}</p>}
              {extractedDetails.skinTone               && <p>🎨 <strong>Skin:</strong> {extractedDetails.skinTone}</p>}
              {extractedDetails.hair                   && <p className="col-span-2">💈 <strong>Hair:</strong> {extractedDetails.hair}</p>}
              {extractedDetails.facialHair             && <p className="col-span-2">🧔 <strong>Facial hair:</strong> {extractedDetails.facialHair}</p>}
              {extractedDetails.clothing               && <p className="col-span-2">👕 <strong>Clothing:</strong> {extractedDetails.clothing}</p>}
              {extractedDetails.distinguishingFeatures && <p className="col-span-2">⚠️ <strong>Features:</strong> {extractedDetails.distinguishingFeatures}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Description textarea */}
      <Textarea
        label="Suspect Physical Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        placeholder='e.g. "Male, early 30s, tall, dark brown skin, short black curly hair, trimmed beard, scar on left cheek, wearing blue shirt"'
      />
      <p className="text-xs text-gray-400">
        Include: gender, age, height, skin tone, hair style/color, facial hair, clothing, distinguishing features.
      </p>

      {/* Generate button */}
      <Button full onClick={generate} disabled={loading || !description.trim()}>
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> {status || "Generating…"}</>
          : <><Sparkles className="h-4 w-4" /> Generate Suspect Sketch</>}
      </Button>

      {loading && status && (
        <p className="text-xs text-center text-orange-600 animate-pulse">{status}</p>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <button onClick={generate} className="text-xs text-blue-600 underline mt-1 flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Try Again
            </button>
          </div>
        </div>
      )}

      {sketchUrl && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Generated Sketch:</p>
            {sourceBadge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceBadge.cls}`}>
                {sourceBadge.label}
              </span>
            )}
          </div>
          <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-md">
            <img src={sketchUrl} alt="AI Suspect Sketch" className="w-full object-cover" />
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700 font-semibold">⚠️ INVESTIGATIVE REFERENCE ONLY</p>
            <p className="text-xs text-gray-600 mt-0.5"><strong>Description:</strong> {description}</p>
          </div>
          <Button variant="outline" full onClick={generate} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Regenerate Sketch
          </Button>
        </div>
      )}

      <p className="text-xs text-center text-gray-400">
        Primary: ☁️ Cloudflare Workers AI · Backup 1: NVIDIA NIM · Backup 2: NVIDIA Flux · Backup 3: Pollinations · Backup 4: Hugging Face
      </p>
    </div>
  );
}