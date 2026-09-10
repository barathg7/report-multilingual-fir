/**
 * src/lib/signLanguage/islAdapter.js
 *
 * Recognition Adapter Interface and Runtime for the Experimental ISL Gesture Input Aid in REPORT.
 *
 * Architecture:
 *   Webcam Video
 *     -> MediaPipe Vision HandLandmarker (WASM)
 *     -> 21 3D landmarks (left & right hand)
 *     -> Real-time Canvas Skeleton Overlay
 *     -> ISL Geometric Classifier (deterministic rule-based heuristic)
 *     -> matchScore >= 0.90 gate (conservative — false negatives preferred)
 *     -> Sustained Hold Debounce (>= 700ms)
 *     -> Emergency Token Confirmation (requires explicit citizen dialog confirm)
 *     -> Token Accumulator & Draft Statement Assembler
 *
 * HONEST DISCLOSURE:
 * - This is NOT a trained, validated ISL translation model.
 * - matchScore is a geometric fit score, NOT a Bayesian ML probability.
 * - All recognized tokens are experimental suggestions only.
 * - Emergency tokens (HELP, POLICE, ACCIDENT, THEFT, STOP) require explicit
 *   citizen confirmation before entering the draft statement.
 * - No legal determinations (BNS sections, offence codes) are made by this module.
 */

import {
  RECOGNITION_STATE,
  MODEL_STATUS,
  HAND_CONNECTIONS,
  EMERGENCY_TOKENS,
  CANDIDATE_MIN_SCORE,
  PROVENANCE_SOURCE_EXPERIMENTAL,
  PROVENANCE_SOURCE_MANUAL,
} from './islTypes.js';
import { ISL_VOCABULARY, VOCABULARY_MAP } from './islVocabulary.js';
import {
  extractHandFeatures,
  classifySingleHand,
  classifyTwoHands,
} from './islGeometryClassifier.js';

export class ISLRecognitionAdapter {
  constructor(options = {}) {
    // Conservative 0.90 matchScore gate — any result below this is treated as UNKNOWN
    this.minMatchScore = options.minMatchScore ?? CANDIDATE_MIN_SCORE;
    this.holdDurationMs = options.holdDurationMs || 700;

    this.modelStatus = MODEL_STATUS.UNINITIALIZED;
    this.state = RECOGNITION_STATE.IDLE;
    this.handLandmarker = null;
    this.isProcessing = false;
    this.animationFrameId = null;

    // Callbacks
    this.onStateChange           = options.onStateChange          || (() => {});
    this.onModelStatusChange     = options.onModelStatusChange     || (() => {});
    this.onLandmarks             = options.onLandmarks             || (() => {});
    this.onSignDetected          = options.onSignDetected          || (() => {});
    this.onHoldProgress          = options.onHoldProgress          || (() => {});
    this.onTokenRecognized       = options.onTokenRecognized       || (() => {});
    this.onEmergencyCandidate    = options.onEmergencyCandidate    || (() => {});  // new: emergency token needs citizen confirmation
    this.onError                 = options.onError                 || (() => {});

    // Hold debounce state
    this.currentCandidate = null;
    this.candidateStartTime = 0;
    this.lastRecognizedCode = null;
    this.lastRecognizedTime = 0;
    this.cooldownMs = 1200; // Minimum gap before same token can repeat

    // Diagnostics — honest metadata, never fabricated
    this.diagnostics = {
      modelName: 'Experimental ISL Gesture Engine (Rule-based heuristic)',
      isPretrainedBundleLoaded: false,   // this engine has NO pretrained neural bundle
      isPretrained: false,
      engineType: 'rule_based_geometric_heuristic',
      disclaimer: 'This is NOT a trained ISL model. matchScore is geometric fit only.',
      missingRequirements: [],
      activeDelegate: null,
      lastFps: 0,
      framesProcessed: 0,
    };
  }

  /**
   * Initializes the MediaPipe HandLandmarker vision pipeline.
   * NOTE: MediaPipe's hand_landmarker.task is a hand DETECTOR (21 keypoints),
   * NOT an ISL sign classifier. The ISL classification is done by the rule-based
   * geometry engine above. isPretrainedBundleLoaded refers to MediaPipe detector
   * bundle availability only.
   * CPU fallback improves device compatibility, but runtime availability still
   * depends on browser, WebAssembly, model asset accessibility, and network conditions.
   */
  async initialize() {
    this._setModelStatus(MODEL_STATUS.INITIALIZING);
    this._setState(RECOGNITION_STATE.IDLE);

    try {
      const visionModule = await import('@mediapipe/tasks-vision');
      const { FilesetResolver, HandLandmarker } = visionModule;

      const wasmPath = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
      const modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      const vision = await FilesetResolver.forVisionTasks(wasmPath);

      let landmarker = null;
      let activeDelegate = 'GPU';
      let gpuError = null;

      // ── Step 1: Attempt GPU Delegate ──
      try {
        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        activeDelegate = 'GPU';
      } catch (err) {
        gpuError = err;
        console.warn(
          'MediaPipe HandLandmarker GPU delegate failed; falling back to CPU:',
          err?.message || err
        );
      }

      // ── Step 2: Fallback to CPU Delegate if GPU failed ──
      if (!landmarker) {
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            minTrackingConfidence: 0.6,
          });
          activeDelegate = 'CPU';
        } catch (cpuErr) {
          // Both GPU and CPU failed — preserve both failure reasons for honest diagnostics
          const combinedReason = `GPU init failed: ${gpuError?.message || 'unknown'}. CPU init failed: ${cpuErr?.message || 'unknown'}`;
          const finalErr = new Error(combinedReason);
          finalErr.gpuError = gpuError;
          finalErr.cpuError = cpuErr;
          throw finalErr;
        }
      }

      this.handLandmarker = landmarker;
      this.diagnostics.activeDelegate = activeDelegate;
      this.diagnostics.gpuError = gpuError ? (gpuError.message || String(gpuError)) : null;
      this.diagnostics.cpuError = null;
      this.diagnostics.isPretrainedBundleLoaded = true;
      this.diagnostics.missingRequirements = [];
      this._setModelStatus(MODEL_STATUS.READY);
      return { success: true, status: MODEL_STATUS.READY, delegate: activeDelegate };
    } catch (err) {
      const reason = err?.message || 'Unable to load MediaPipe WASM or HandLandmarker task bundle';
      this.diagnostics.activeDelegate = null;
      this.diagnostics.isPretrainedBundleLoaded = false;
      this.diagnostics.missingRequirements = [
        'MediaPipe hand_landmarker.task bundle could not be loaded',
        reason,
      ];
      this._setModelStatus(MODEL_STATUS.UNAVAILABLE);
      this._setState(RECOGNITION_STATE.MODEL_UNAVAILABLE);
      return { success: false, status: MODEL_STATUS.UNAVAILABLE, reason };
    }
  }

  /**
   * Starts real-time recognition loop on the active webcam video and overlay canvas.
   */
  start(videoElement, canvasElement) {
    if (!videoElement) throw new Error('videoElement is required to start ISL recognition');

    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.isProcessing = true;
    this._setState(RECOGNITION_STATE.DETECTING_HANDS);

    let lastVideoTime = -1;
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const processLoop = () => {
      if (!this.isProcessing) return;

      const now = performance.now();
      frameCount++;
      if (now - lastFpsTime >= 1000) {
        this.diagnostics.lastFps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
      }

      if (
        this.handLandmarker &&
        this.videoElement &&
        this.videoElement.readyState >= 2 &&
        !this.videoElement.paused
      ) {
        if (this.videoElement.currentTime !== lastVideoTime) {
          lastVideoTime = this.videoElement.currentTime;
          const detections = this.handLandmarker.detectForVideo(this.videoElement, now);
          this._handleDetections(detections, now);
        }
      }

      this.animationFrameId = requestAnimationFrame(processLoop);
    };

    this.animationFrameId = requestAnimationFrame(processLoop);
  }

  /**
   * Stops the recognition loop and clears canvas.
   */
  stop() {
    this.isProcessing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this._clearCanvas();
    this.currentCandidate = null;
    this._setState(RECOGNITION_STATE.IDLE);
  }

  /**
   * Releases all resources.
   */
  dispose() {
    this.stop();
    if (this.handLandmarker) {
      try { this.handLandmarker.close(); } catch (_) {}
      this.handLandmarker = null;
    }
    this._setModelStatus(MODEL_STATUS.UNINITIALIZED);
  }

  /**
   * Processes landmark results from a video frame.
   * Filters out UNKNOWN gestures and any result with matchScore < 0.90.
   */
  _handleDetections(results, timestamp) {
    const landmarksList = results?.landmarks || [];
    this.diagnostics.framesProcessed++;

    this._drawLandmarks(landmarksList);
    this.onLandmarks(landmarksList);

    if (landmarksList.length === 0) {
      this._resetCandidate();
      this._setState(RECOGNITION_STATE.DETECTING_HANDS);
      this.onSignDetected(null);
      this.onHoldProgress(0);
      return;
    }

    const hand1 = landmarksList[0] ? extractHandFeatures(landmarksList[0]) : null;
    const hand2 = landmarksList[1] ? extractHandFeatures(landmarksList[1]) : null;

    let detectedSign = null;
    if (hand1 && hand2) {
      detectedSign = classifyTwoHands(hand1, hand2);
    } else if (hand1) {
      detectedSign = classifySingleHand(hand1);
    }

    // Gate 1: filter UNKNOWN results
    if (!detectedSign || detectedSign.code === 'UNKNOWN') {
      this._resetCandidate();
      this._setState(RECOGNITION_STATE.DETECTING_HANDS);
      this.onSignDetected(null);
      this.onHoldProgress(0);
      return;
    }

    // Gate 2: conservative matchScore threshold (0.90)
    if (detectedSign.matchScore < this.minMatchScore) {
      this._resetCandidate();
      this._setState(RECOGNITION_STATE.DETECTING_HANDS);
      this.onSignDetected(null);
      this.onHoldProgress(0);
      return;
    }

    // Cooldown: prevent duplicate triggers of same token within cooldownMs
    if (
      detectedSign.code === this.lastRecognizedCode &&
      timestamp - this.lastRecognizedTime < this.cooldownMs
    ) {
      this.onSignDetected(detectedSign);
      this.onHoldProgress(0);
      return;
    }

    // Hold-to-confirm debounce
    this.onSignDetected(detectedSign);

    if (!this.currentCandidate || this.currentCandidate.code !== detectedSign.code) {
      this.currentCandidate = detectedSign;
      this.candidateStartTime = timestamp;
      this._setState(RECOGNITION_STATE.SIGN_DETECTED);
      this.onHoldProgress(0.05);
    } else {
      const elapsed = timestamp - this.candidateStartTime;
      const targetDuration = detectedSign.holdDurationMs || this.holdDurationMs;
      const progress = Math.min(1.0, elapsed / targetDuration);

      this.onHoldProgress(progress);
      this._setState(RECOGNITION_STATE.HOLDING_SIGN);

      if (progress >= 1.0) {
        this._confirmToken(this.currentCandidate, timestamp);
      }
    }
  }

  /**
   * Fires when a gesture has been held long enough to confirm.
   * Emergency tokens (HELP, POLICE, ACCIDENT, THEFT, STOP) are routed to
   * onEmergencyCandidate for explicit citizen dialog confirmation.
   * Non-emergency tokens are immediately emitted via onTokenRecognized.
   */
  _confirmToken(sign, timestamp) {
    this.lastRecognizedCode = sign.code;
    this.lastRecognizedTime = timestamp;
    this._resetCandidate();
    this.onHoldProgress(0);

    const tokenPayload = {
      ...sign,
      id: `${sign.code}-${Date.now()}`,
      confirmedAt: new Date().toISOString(),
      source: PROVENANCE_SOURCE_EXPERIMENTAL,
      verified: false,
    };

    if (EMERGENCY_TOKENS.includes(sign.code)) {
      // Emergency token: requires citizen explicit confirmation before token is added
      this._setState(RECOGNITION_STATE.EMERGENCY_CONFIRMATION);
      this.onEmergencyCandidate(tokenPayload);
    } else {
      this._setState(RECOGNITION_STATE.TOKEN_CONFIRMED);
      this.onTokenRecognized(tokenPayload);
    }
  }

  /**
   * Called by the UI when a citizen CONFIRMS an emergency token via the dialog.
   * Only after this call does the emergency token enter the draft statement.
   */
  confirmEmergencyToken(tokenPayload) {
    this._setState(RECOGNITION_STATE.TOKEN_CONFIRMED);
    this.onTokenRecognized({ ...tokenPayload, citizenConfirmed: true });
  }

  /**
   * Called by the UI when a citizen REJECTS an emergency token.
   * The candidate is discarded immediately without any token emission.
   */
  rejectEmergencyToken() {
    this._setState(RECOGNITION_STATE.DETECTING_HANDS);
  }

  _resetCandidate() {
    this.currentCandidate = null;
    this.candidateStartTime = 0;
  }

  /**
   * Draws 21 hand landmarks and bones onto the overlay canvas.
   */
  _drawLandmarks(landmarksList) {
    if (!this.canvasElement || !this.videoElement) return;
    const canvas = this.canvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width  = this.videoElement.videoWidth  || canvas.clientWidth  || 640;
    const height = this.videoElement.videoHeight || canvas.clientHeight || 480;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width  = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    for (const landmarks of landmarksList) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#10b981';
      for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x * width, p1.y * height);
          ctx.lineTo(p2.x * width, p2.y * height);
          ctx.stroke();
        }
      }

      for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i];
        const isTip = [4, 8, 12, 16, 20].includes(i);
        ctx.beginPath();
        ctx.arc(pt.x * width, pt.y * height, isTip ? 6 : 4, 0, 2 * Math.PI);
        ctx.fillStyle  = isTip ? '#f59e0b' : '#3b82f6';
        ctx.fill();
        ctx.lineWidth  = 1.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }
  }

  _clearCanvas() {
    if (!this.canvasElement) return;
    const ctx = this.canvasElement.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
  }

  _setState(nextState) {
    if (this.state !== nextState) {
      this.state = nextState;
      this.onStateChange(nextState);
    }
  }

  _setModelStatus(nextStatus) {
    if (this.modelStatus !== nextStatus) {
      this.modelStatus = nextStatus;
      this.onModelStatusChange(nextStatus);
    }
  }

  /**
   * Assembles a draft text fragment from a sequence of confirmed tokens.
   * Returns draft text only — NEVER legal determinations or official FIR numbers.
   */
  assembleStatement(tokens = []) {
    if (!tokens || tokens.length === 0) return '';
    const fragments = [];
    for (const token of tokens) {
      const vocab = VOCABULARY_MAP.get(token.code);
      if (vocab?.statementFragment) {
        fragments.push(vocab.statementFragment);
      } else if (token.label && token.label !== 'Unrecognized Gesture') {
        fragments.push(token.label);
      }
    }
    return fragments.join(' ');
  }

  getVocabulary() {
    return ISL_VOCABULARY;
  }

  /**
   * Returns honest metadata about the engine.
   * Explicitly declares that this is a rule-based heuristic, not a neural model.
   */
  getModelMetadata() {
    return {
      name:                    this.diagnostics.modelName,
      engineType:              this.diagnostics.engineType,
      isPretrained:            false,
      isPretrainedBundleLoaded: this.diagnostics.isPretrainedBundleLoaded,
      disclaimer:              this.diagnostics.disclaimer,
      status:                  this.modelStatus,
      isLoaded:                this.diagnostics.isPretrainedBundleLoaded,
      missingRequirements:     this.diagnostics.missingRequirements,
      minMatchScore:           this.minMatchScore,
      vocabularyCount:         ISL_VOCABULARY.length,
      fps:                     this.diagnostics.lastFps,
      framesProcessed:         this.diagnostics.framesProcessed,
      provenanceSource:        PROVENANCE_SOURCE_EXPERIMENTAL,
    };
  }
}
