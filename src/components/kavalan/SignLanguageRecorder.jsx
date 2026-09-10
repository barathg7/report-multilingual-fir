import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Hand,
  Camera,
  CameraOff,
  AlertTriangle,
  CheckCircle,
  X,
  Edit3,
  Trash2,
  Info,
  BookOpen,
  ArrowRight,
  Shield,
  HelpCircle,
  FlaskConical,
  AlertCircle,
} from 'lucide-react';
import {
  ISLRecognitionAdapter,
  MODEL_STATUS,
  RECOGNITION_STATE,
  ISL_VOCABULARY,
  EMERGENCY_TOKENS,
} from '@/lib/signLanguage';

async function requestCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera access is not supported in this browser.');
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  });
}

function stopStream(s) {
  if (s) s.getTracks().forEach(t => t.stop());
}

/**
 * SignLanguageRecorder — Experimental ISL Gesture Input Aid for REPORT.
 *
 * HONEST DISCLOSURE:
 * - This is an EXPERIMENTAL rule-based gesture recognizer, NOT a trained ISL translator.
 * - All recognized gestures are experimental suggestions that require citizen review.
 * - Emergency tokens (HELP, POLICE, ACCIDENT, THEFT, STOP) require explicit
 *   citizen dialog confirmation before entering the draft statement.
 * - matchScore is a geometric fit score, NOT a validated accuracy percentage.
 * - This module does NOT produce legal determinations or official FIR classifications.
 */
export default function SignLanguageRecorder({ onConfirm, onCancel, existingText = '' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const adapterRef = useRef(null);

  // Camera & Model State
  const [cameraState, setCameraState] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [modelStatus, setModelStatus] = useState(MODEL_STATUS.UNINITIALIZED);

  // Recognition state
  const [recognitionState, setRecognitionState] = useState(RECOGNITION_STATE.IDLE);
  const [detectedSign, setDetectedSign] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [tokens, setTokens] = useState([]);
  const [showVocabGuide, setShowVocabGuide] = useState(false);

  // Emergency confirmation dialog state
  const [pendingEmergencyToken, setPendingEmergencyToken] = useState(null);

  // Statement editor state
  const [draftText, setDraftText] = useState('');
  const [userHasEdited, setUserHasEdited] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [mergeMode, setMergeMode] = useState('append');

  // Initialize ISL Adapter on mount
  useEffect(() => {
    const adapter = new ISLRecognitionAdapter({
      minMatchScore: 0.90,
      holdDurationMs: 700,
      onStateChange:       (st)    => setRecognitionState(st),
      onModelStatusChange: (status) => setModelStatus(status),
      onSignDetected:      (sign)  => setDetectedSign(sign),
      onHoldProgress:      (prog)  => setHoldProgress(prog),
      onTokenRecognized:   (token) => {
        // Non-emergency tokens go directly to the shelf
        setTokens((prev) => [...prev, token]);
      },
      onEmergencyCandidate: (token) => {
        // Emergency token: pause recognition, show citizen confirmation dialog
        setPendingEmergencyToken(token);
      },
    });

    adapterRef.current = adapter;
    adapter.initialize();

    return () => {
      adapter.dispose();
      stopStream(streamRef.current);
    };
  }, []);

  // Camera management
  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    setCameraError('');
    try {
      const stream = await requestCameraStream();
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraState('active');
      if (adapterRef.current && videoRef.current && canvasRef.current) {
        adapterRef.current.start(videoRef.current, canvasRef.current);
      }
    } catch (err) {
      const denied = ['NotAllowedError', 'PermissionDeniedError'].includes(err.name);
      setCameraState(denied ? 'denied' : 'error');
      setCameraError(
        denied
          ? 'Camera permission was denied. Allow camera access in browser settings.'
          : err.message || 'Could not access camera.'
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (adapterRef.current) adapterRef.current.stop();
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState('idle');
    setDetectedSign(null);
    setHoldProgress(0);
  }, []);

  // Emergency token: citizen confirms → token enters draft shelf
  const handleEmergencyConfirm = () => {
    if (!pendingEmergencyToken || !adapterRef.current) return;
    adapterRef.current.confirmEmergencyToken(pendingEmergencyToken);
    setTokens((prev) => [...prev, { ...pendingEmergencyToken, citizenConfirmed: true }]);
    setPendingEmergencyToken(null);
  };

  // Emergency token: citizen rejects → discard without emitting
  const handleEmergencyReject = () => {
    if (adapterRef.current) adapterRef.current.rejectEmergencyToken();
    setPendingEmergencyToken(null);
  };

  // Transfer tokens into draftText
  const handleInsertTokensIntoStatement = () => {
    if (!tokens.length) return;
    const assembled = adapterRef.current?.assembleStatement(tokens) || '';
    if (!assembled) return;
    setDraftText((prev) => {
      const trimmed = prev.trim();
      return !trimmed ? assembled : trimmed + ' ' + assembled;
    });
  };

  const handleRemoveToken = (indexToRemove) => {
    setTokens((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleClearTokens = () => setTokens([]);

  // Final Confirmation — provenance is sign_language_experimental, verified: false
  const handleConfirm = () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;

    const provenance = tokens.length > 0
      ? {
          source:      'sign_language_experimental',
          verified:    false,
          editedByUser: userHasEdited,
          lastUpdated: new Date().toISOString(),
          engineType:  'rule_based_geometric_heuristic',
          disclaimer:  'Experimental gesture suggestions — not validated ISL translation.',
          signDetails: {
            tokenCount: tokens.length,
            tokens: tokens.map((t) => ({ code: t.code, matchScore: t.matchScore })),
          },
        }
      : {
          source:      'sign_language_manual',
          verified:    false,
          editedByUser: true,
          lastUpdated: new Date().toISOString(),
        };

    const finalText =
      existingText && mergeMode === 'append'
        ? existingText.trim() + '\n\n' + trimmed
        : trimmed;

    setConfirmed(true);
    setTimeout(() => {
      stopCamera();
      onConfirm({ text: finalText, provenance });
    }, 600);
  };

  const handleCancel = () => {
    stopCamera();
    onCancel?.();
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
      role="region"
      aria-label="ISL Gesture Input — Experimental"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-700 to-indigo-800 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
            <Hand className="h-5 w-5 text-violet-200" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">ISL Gesture Input</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/80 border border-amber-400/40 text-white flex items-center gap-1">
                <FlaskConical className="h-2.5 w-2.5" aria-hidden="true" />
                EXPERIMENTAL
              </span>
            </div>
            <p className="text-[11px] text-violet-200">
              Experimental gesture recognition · Results are suggestions only · Always review before submitting
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowVocabGuide(!showVocabGuide)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition font-medium"
            title="Supported Signs Guide"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ISL Guide</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close sign language recorder"
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Experimental Disclosure Banner (always shown) ── */}
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] text-amber-800 leading-snug">
            <strong>Experimental gesture recognition only.</strong>{' '}
            Results are suggestions based on hand geometry — not a validated ISL translation model.
            Review and confirm each gesture before adding it to your statement.
            Emergency gestures (HELP, POLICE, ACCIDENT, THEFT, STOP) require your explicit confirmation.
          </p>
        </div>

        {/* ── Engine Status Banner ── */}
        {modelStatus === MODEL_STATUS.READY && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <p className="text-xs font-semibold text-emerald-900">
                Gesture Engine: <strong>Active</strong>
                <span className="font-normal text-emerald-700"> (Rule-based heuristic · Not a neural model)</span>
              </p>
            </div>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
              Min. Heuristic Match: 90%
            </span>
          </div>
        )}

        {modelStatus === MODEL_STATUS.INITIALIZING && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-3.5 py-2.5 text-xs text-blue-800">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent shrink-0" />
            <span>Initializing hand detection runtime…</span>
          </div>
        )}

        {modelStatus === MODEL_STATUS.UNAVAILABLE && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5" role="status">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900">Hand Detection Runtime Offline</p>
              <p className="text-[11px] text-amber-800 leading-snug">
                The MediaPipe hand detection bundle could not be loaded.
                You may type your statement directly below, or request an authorized ISL interpreter.
              </p>
            </div>
          </div>
        )}

        {/* ── Emergency Token Confirmation Dialog ── */}
        {pendingEmergencyToken && (
          <div
            className="bg-rose-50 border-2 border-rose-400 rounded-xl p-4 space-y-3"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="emergency-dialog-title"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" aria-hidden="true" />
              <h3 id="emergency-dialog-title" className="text-sm font-extrabold text-rose-900">
                Emergency Gesture Detected — Confirm Before Adding
              </h3>
            </div>
            <p className="text-sm text-rose-800">
              Possible gesture:{' '}
              <strong className="font-extrabold text-rose-900 text-base">
                {pendingEmergencyToken.code}
              </strong>
              {' '}— {pendingEmergencyToken.label}
            </p>
            <p className="text-[11px] text-rose-700 bg-rose-100 rounded-lg px-3 py-2 leading-snug">
              This is an experimental suggestion based on hand geometry only.
              Is this gesture correct? Confirming will add it to your draft statement for your review.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                id="emergency-confirm-btn"
                onClick={handleEmergencyConfirm}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition"
              >
                <CheckCircle className="h-4 w-4" />
                Yes, this is correct — Add to Draft
              </button>
              <button
                type="button"
                id="emergency-reject-btn"
                onClick={handleEmergencyReject}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 font-semibold text-sm transition"
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </div>
        )}

        {/* ── Vocabulary Guide Drawer (collapsible) ── */}
        {showVocabGuide && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <HelpCircle className="h-4 w-4 text-violet-600" />
                Supported Gesture Postures (Experimental)
              </div>
              <button
                type="button"
                onClick={() => setShowVocabGuide(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              Hold sign steadily for ~700ms until the hold ring completes.{' '}
              <strong>Heuristic match must reach 90%</strong> before a gesture is registered.
              Emergency gestures require your explicit confirmation.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
              {ISL_VOCABULARY.filter(v => v.code !== 'UNKNOWN').map((v) => (
                <div
                  key={v.code}
                  className="bg-white border border-slate-200 rounded-lg p-2 space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-violet-700">{v.code}</span>
                    <div className="flex items-center gap-1">
                      {EMERGENCY_TOKENS.includes(v.code) && (
                        <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded">CONFIRM</span>
                      )}
                      <span className="text-[10px] text-slate-400 uppercase">{v.category}</span>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium text-slate-700">{v.label}</p>
                  <p className="text-[10px] text-slate-500 leading-tight">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Camera & Landmark Video Preview Area ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" /> Live Gesture Tracking
            </p>
            {cameraState === 'active' ? (
              <button
                type="button"
                onClick={stopCamera}
                aria-label="Stop camera"
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition"
              >
                <CameraOff className="h-3.5 w-3.5" /> Stop Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                disabled={cameraState === 'requesting'}
                aria-label="Start camera"
                className="text-xs text-violet-600 hover:text-violet-700 font-semibold flex items-center gap-1 transition disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" />
                {cameraState === 'requesting' ? 'Requesting...' : 'Start Camera'}
              </button>
            )}
          </div>

          {/* Video + Canvas Stack */}
          <div
            className={`relative rounded-xl overflow-hidden bg-gray-950 ${
              cameraState === 'active' ? 'aspect-video' : 'h-32'
            } flex items-center justify-center`}
            aria-label="Camera preview area"
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
              aria-label="Live camera feed"
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${
                cameraState === 'active' ? 'block' : 'hidden'
              }`}
              aria-label="Real-time hand landmarks overlay"
            />

            {cameraState !== 'active' && (
              <div className="flex flex-col items-center gap-2 text-gray-400 p-4 text-center">
                <CameraOff className="h-7 w-7 text-gray-500" aria-hidden="true" />
                <p className="text-xs">
                  {cameraState === 'idle'      && 'Click "Start Camera" to enable gesture tracking'}
                  {cameraState === 'requesting' && 'Requesting camera permissions...'}
                  {cameraState === 'denied'     && 'Camera access denied by browser'}
                  {cameraState === 'error'      && 'Camera device unavailable'}
                </p>
              </div>
            )}

            {/* In-Video HUD — shows Heuristic Match %, not "confidence" */}
            {cameraState === 'active' && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                {detectedSign && detectedSign.code !== 'UNKNOWN' ? (
                  <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1.5 text-white flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-sm tracking-wide text-amber-300">
                          {detectedSign.code}
                        </span>
                        <span className="text-[11px] text-gray-300">
                          ({detectedSign.label})
                        </span>
                        {EMERGENCY_TOKENS.includes(detectedSign.code) && (
                          <span className="text-[9px] font-bold text-rose-400 border border-rose-600/40 px-1 py-0.5 rounded">
                            NEEDS CONFIRM
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-emerald-400 font-mono">
                          Heuristic Match: {Math.round(detectedSign.matchScore * 100)}%
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Hold: {Math.round(holdProgress * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="w-16 bg-gray-700 rounded-full h-2 overflow-hidden border border-gray-600">
                      <div
                        className="bg-amber-400 h-full transition-all duration-75 ease-out"
                        style={{ width: `${holdProgress * 100}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-md px-2.5 py-1 text-gray-300 text-[11px] flex items-center gap-1.5">
                    <Hand className="h-3 w-3 text-violet-400" />
                    <span>Show hands in frame…</span>
                  </div>
                )}

                {/* Engine label in HUD */}
                <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-md px-2 py-1 text-gray-400 text-[10px] flex items-center gap-1">
                  <FlaskConical className="h-2.5 w-2.5 text-amber-400" />
                  Experimental Engine
                </div>
              </div>
            )}
          </div>

          {cameraError && (
            <p className="text-xs text-rose-600 mt-1.5 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              {cameraError}
            </p>
          )}
        </div>

        {/* ── Recognized Gesture Tokens Shelf ── */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-violet-600" /> Gesture Suggestions ({tokens.length})
            </span>
            {tokens.length > 0 && (
              <button
                type="button"
                onClick={handleClearTokens}
                className="text-[11px] text-gray-500 hover:text-rose-600 font-medium flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          {tokens.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-1">
              No gestures recognized yet. Hold an ISL posture (e.g., POLICE, THEFT, PHONE) steadily to register.
              Emergency gestures will require your confirmation first.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {tokens.map((token, idx) => (
                <span
                  key={token.id || idx}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs ${
                    EMERGENCY_TOKENS.includes(token.code)
                      ? 'bg-rose-50 border border-rose-300 text-rose-900'
                      : 'bg-violet-50 border border-violet-200 text-violet-900'
                  }`}
                >
                  <span>{token.code}</span>
                  {token.matchScore > 0 && (
                    <span className="text-[9px] font-normal opacity-70">{Math.round(token.matchScore * 100)}%</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveToken(idx)}
                    className="text-gray-400 hover:text-rose-600 ml-0.5"
                    title="Remove token"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              <button
                type="button"
                onClick={handleInsertTokensIntoStatement}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition shadow-xs ml-auto"
              >
                <span>Add to Draft</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* ── Merge mode (if existing statement text) ── */}
        {existingText && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" aria-hidden="true" /> Existing statement found
            </p>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="sign_merge_mode"
                  value="append"
                  checked={mergeMode === 'append'}
                  onChange={() => setMergeMode('append')}
                  className="accent-violet-600"
                />
                <span className="text-xs text-blue-800">Add after existing text</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="sign_merge_mode"
                  value="replace"
                  checked={mergeMode === 'replace'}
                  onChange={() => setMergeMode('replace')}
                  className="accent-rose-600"
                />
                <span className="text-xs text-rose-700">Replace existing text</span>
              </label>
            </div>
          </div>
        )}

        {/* ── Draft Statement Textarea ── */}
        <div>
          <label
            htmlFor="sign-stmt"
            className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
          >
            Draft Statement Text
            <span className="text-gray-400 font-normal normal-case tracking-normal ml-1">
              (experimental gesture suggestions — review and edit before confirming)
            </span>
          </label>
          <textarea
            id="sign-stmt"
            value={draftText}
            onChange={(e) => {
              setDraftText(e.target.value);
              setUserHasEdited(true);
            }}
            placeholder="Gesture suggestions will appear here. You can also type directly. Review carefully before confirming."
            rows={5}
            aria-label="Draft statement text area"
            aria-describedby="sign-stmt-help"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none font-sans"
          />
          <p id="sign-stmt-help" className="text-[11px] text-gray-400 mt-1">
            Review and adjust wording before confirming. Only text you explicitly confirm here enters your formal FIR statement.
          </p>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setDraftText(''); setUserHasEdited(false); }}
            disabled={!draftText}
            aria-label="Clear draft text"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Clear
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!draftText.trim() || confirmed}
            aria-label="Confirm and add draft to statement"
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-bold text-sm transition disabled:opacity-50 shadow-sm"
          >
            {confirmed ? (
              <>
                <CheckCircle className="h-4 w-4" aria-hidden="true" /> Added to Statement
              </>
            ) : (
              <>
                <Edit3 className="h-4 w-4" aria-hidden="true" /> Confirm &amp; Add to Statement
              </>
            )}
          </button>
        </div>

        {/* ── Provenance & Integrity Notice ── */}
        <div className="flex items-center gap-2 border-t border-gray-100 pt-3 text-[11px] text-gray-500">
          <Shield className="h-3.5 w-3.5 text-violet-600 shrink-0" />
          <span>
            Provenance:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono text-[10px]">
              {tokens.length > 0 ? 'sign_language_experimental' : 'sign_language_manual'}
            </code>{' '}
            · <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono text-[10px]">verified: false</code>
            {' '}· Rule-based heuristic · Not a validated ISL model · Complete audit trail preserved.
          </span>
        </div>
      </div>
    </div>
  );
}