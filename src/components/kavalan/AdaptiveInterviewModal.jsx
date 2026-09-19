// src/components/kavalan/AdaptiveInterviewModal.jsx
// Phase 8: Adaptive Emergency Interview — Collects critical incident intelligence one question at a time

import React, { useState } from "react";
import {
  ShieldAlert,
  HelpCircle,
  X,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Users,
  Eye,
  Lock,
} from "lucide-react";
import { CrisisIntelligenceEngine } from "../../lib/crisisIntelligence/CrisisIntelligenceEngine";
import { PROVENANCE_SOURCES } from "../../lib/crisisIntelligence/emergencyTaxonomy";

const INTERVIEW_QUESTIONS = [
  {
    id: "threat_proximity",
    icon: AlertTriangle,
    question: "Is the threat or attacker currently near you?",
    tamilQuestion: "அச்சுறுத்தல் அல்லது தாக்குபவர் தற்போது உங்கள் அருகில் உள்ளாரா?",
    options: [
      { label: "YES — NEARBY", value: true, factKey: "threat_nearby" },
      { label: "NO — AT A DISTANCE", value: false, factKey: "threat_nearby" },
      { label: "DON'T KNOW", value: "unknown", factKey: "threat_nearby" },
    ],
  },
  {
    id: "weapon_visible",
    icon: Eye,
    question: "Is a weapon visible?",
    tamilQuestion: "ஆயுதம் ஏதேனும் தெரிகிறதா?",
    options: [
      { label: "YES — WEAPON SEEN", value: true, factKey: "weapon_visible" },
      { label: "NO WEAPON SEEN", value: false, factKey: "weapon_visible" },
      { label: "NOT SURE", value: "unknown", factKey: "weapon_visible" },
    ],
  },
  {
    id: "suspects_count",
    icon: Users,
    question: "How many suspects or perpetrators are there?",
    tamilQuestion: "எத்தனை சந்தேக நபர்கள் உள்ளனர்?",
    options: [
      { label: "1 PERSON", value: "1", factKey: "suspects_count" },
      { label: "2 PERSONS", value: "2", factKey: "suspects_count" },
      { label: "3+ PERSONS", value: "3+", factKey: "suspects_count" },
      { label: "DON'T KNOW", value: "unknown", factKey: "suspects_count" },
    ],
  },
  {
    id: "safe_shelter",
    icon: Lock,
    question: "Are you in a safe room, shelter, or barricaded?",
    tamilQuestion: "நீங்கள் பாதுகாப்பான அறை அல்லது புகலிடத்தில் உள்ளீர்களா?",
    options: [
      { label: "YES — SAFE SHELTER", value: true, factKey: "safe_shelter" },
      { label: "NO — EXPOSED", value: false, factKey: "safe_shelter" },
      { label: "TRYING TO HIDE", value: "hiding", factKey: "safe_shelter" },
    ],
  },
];

export default function AdaptiveInterviewModal({
  isOpen = false,
  incidentId,
  onComplete,
  onClose,
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  if (!isOpen || !incidentId) return null;

  const currentQ = INTERVIEW_QUESTIONS[currentIdx];
  const isLastQuestion = currentIdx >= INTERVIEW_QUESTIONS.length - 1;

  const handleSelectOption = async (option) => {
    setIsSubmitting(true);
    try {
      const factUpdate = {
        [option.factKey]: option.value,
      };

      // Push to Crisis Intelligence Engine
      await CrisisIntelligenceEngine.updateFacts(
        incidentId,
        factUpdate,
        "CITIZEN",
        PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW
      );

      // Append detailed timeline event
      await CrisisIntelligenceEngine.appendTimelineEvent(incidentId, {
        eventType: "INTERVIEW_RESPONSE",
        description: `Citizen answered "${currentQ.question}": ${option.label}`,
        actor: "CITIZEN",
        source: PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW,
        metadata: { questionId: currentQ.id, answer: option.value },
      });

      setAnsweredCount((prev) => prev + 1);

      if (isLastQuestion) {
        onComplete?.();
      } else {
        setCurrentIdx((prev) => prev + 1);
      }
    } catch (err) {
      console.warn("Interview response error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (isLastQuestion) {
      onComplete?.();
    } else {
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const IconComponent = currentQ.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adaptive Emergency Question"
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl p-6 space-y-6">
        {/* Header with non-blocking exit */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
              ADAPTIVE INCIDENT INTELLIGENCE ({currentIdx + 1}/{INTERVIEW_QUESTIONS.length})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Return to emergency screen (Stop answering)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Question Area */}
        <div className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <IconComponent className="w-6 h-6" />
          </div>

          <h2 className="text-base font-bold text-slate-100 leading-snug">
            {currentQ.question}
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            {currentQ.tamilQuestion}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {currentQ.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectOption(opt)}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-800/90 hover:bg-blue-600 active:bg-blue-700 border border-slate-700 hover:border-blue-400 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-98 shadow-sm flex items-center justify-between cursor-pointer disabled:opacity-50"
            >
              <span>{opt.label}</span>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </button>
          ))}
        </div>

        {/* Footer controls: Skip or Return */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 font-medium transition-colors"
          >
            I can't answer right now
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="text-blue-400 hover:text-blue-300 font-bold transition-colors"
          >
            Skip question →
          </button>
        </div>
      </div>
    </div>
  );
}
