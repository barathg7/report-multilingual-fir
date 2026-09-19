// src/components/kavalan/QuickShieldWidget.jsx
// Phase 5: REPORT QuickShield — Instantaneous Emergency Triggering with Minimal App Navigation

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Zap,
  Mic,
  MicOff,
  Keyboard,
  Smartphone,
  ExternalLink,
  ChevronRight,
  Radio,
  Info,
} from "lucide-react";

export default function QuickShieldWidget({ onTriggerEmergency, onOpenSafeTagSimulator }) {
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showArchDocs, setShowArchDocs] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  // Check Web Speech API support
  useEffect(() => {
    const hasSpeech = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
    setVoiceSupported(Boolean(hasSpeech));
  }, []);

  // Keyboard shortcut listener: Ctrl+Shift+E
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        onTriggerEmergency?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTriggerEmergency]);

  // Deep-link / URL hash trigger: #quickshield or ?sos=quickshield
  useEffect(() => {
    if (window.location.hash.includes("quickshield") || window.location.search.includes("quickshield")) {
      onTriggerEmergency?.();
    }
  }, [onTriggerEmergency]);

  // Toggle voice recognition for "help" or "emergency"
  const toggleVoiceTrigger = useCallback(() => {
    if (!voiceSupported) return;

    if (isVoiceListening) {
      setIsVoiceListening(false);
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onstart = () => {
        setIsVoiceListening(true);
        setVoiceTranscript("Listening for 'Help' or 'Emergency'…");
      };

      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript.trim().toLowerCase();
        setVoiceTranscript(`Heard: "${text}"`);

        if (text.includes("help") || text.includes("emergency") || text.includes("kavalan") || text.includes("police")) {
          recognition.stop();
          setIsVoiceListening(false);
          onTriggerEmergency?.();
        }
      };

      recognition.onerror = () => {
        setIsVoiceListening(false);
        setVoiceTranscript("Voice trigger paused.");
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn("Speech recognition initialization error:", err);
      setIsVoiceListening(false);
    }
  }, [isVoiceListening, onTriggerEmergency, voiceSupported]);

  return (
    <div
      id="report-quickshield-widget"
      className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-900 p-4 shadow-lg text-slate-100"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Left: QuickShield Title & Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/30 border border-red-500/60 text-red-400">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black tracking-wider uppercase text-red-400 flex items-center gap-1.5">
                REPORT QuickShield
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-900/60 border border-red-700/50 text-red-300 font-bold">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Zero-friction emergency activation • Touch, Shortcut, Voice, or SafeTag BLE
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Main Trigger Button */}
          <button
            type="button"
            onClick={onTriggerEmergency}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>ACTIVATE EMERGENCY</span>
          </button>

          {/* Voice Trigger (where supported) */}
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoiceTrigger}
              title={isVoiceListening ? "Stop voice listening" : "Listen for 'Help' keyword"}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isVoiceListening
                  ? "bg-red-500/20 border-red-500 text-red-300 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
              }`}
            >
              {isVoiceListening ? <Mic className="w-4 h-4 text-red-400" /> : <MicOff className="w-4 h-4" />}
            </button>
          )}

          {/* SafeTag Simulator Trigger */}
          <button
            type="button"
            onClick={onOpenSafeTagSimulator}
            title="Open SafeTag Hardware Simulator"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 hover:text-amber-300 transition-all cursor-pointer"
          >
            <Radio className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Voice Status indicator */}
      {isVoiceListening && (
        <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-red-950/80 border border-red-800/60 text-[11px] font-mono text-red-200 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
            <span>{voiceTranscript}</span>
          </span>
          <span className="text-[10px] text-slate-400">Say "HELP" to trigger</span>
        </div>
      )}

      {/* Auxiliary shortcuts & Architecture Toggle */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5 text-slate-500" />
          <span>Shortcut: <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300 text-[10px]">Ctrl+Shift+E</kbd></span>
        </span>

        <button
          type="button"
          onClick={() => setShowArchDocs((prev) => !prev)}
          className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 font-mono text-[10px] underline cursor-pointer"
        >
          <Info className="w-3 h-3" />
          <span>{showArchDocs ? "Hide Hardware/PWA Scope" : "Hardware & PWA Scope"}</span>
        </button>
      </div>

      {/* Architectural Separation Documentation Drawer */}
      {showArchDocs && (
        <div id="quickshield-reality-check-drawer" className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-2 text-slate-300 animate-in fade-in">
          <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider">
            QuickShield Technical Reality & Scope Check
          </h4>

          <div className="grid sm:grid-cols-3 gap-2.5 pt-1 text-[10px]">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-emerald-900/40">
              <span className="font-bold text-emerald-400 block mb-1">SUPPORTED NOW:</span>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>Emergency UI (one-touch dispatch)</li>
                <li>Keyboard shortcut (<kbd className="font-mono bg-slate-800 px-1 py-0.2 rounded text-slate-200 text-[9px]">Ctrl+Shift+E</kbd>)</li>
                <li>Deep-link activation (<code className="font-mono text-emerald-300">#quickshield</code>)</li>
                <li>Supported browser voice input ("HELP")</li>
                <li>SafeTag simulator (demo hardware)</li>
              </ul>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-rose-900/40">
              <span className="font-bold text-rose-400 block mb-1">NOT SUPPORTED BY WEB/PWA:</span>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>Arbitrary Android power-button interception (blocked by OS security sandbox)</li>
                <li>Arbitrary locked-screen hardware-button interception</li>
              </ul>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-amber-900/40">
              <span className="font-bold text-amber-400 block mb-1">REQUIRES NATIVE ANDROID COMPANION:</span>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>Locked-screen SafeTag BLE background service</li>
                <li>Android hardware trigger integration</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
