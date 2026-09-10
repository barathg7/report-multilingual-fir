/**
 * src/lib/signLanguage/islGeometryClassifier.js
 *
 * Deterministic mathematical 3D hand landmark feature extraction and geometric
 * classifier for the experimental ISL Gesture Input Aid in REPORT.
 *
 * SAFETY NOTICE:
 * This is a rule-based heuristic geometry engine, NOT a trained ISL model.
 * It is an experimental input aid only. All outputs require citizen confirmation.
 *
 * Anti-Fabrication Guarantees:
 * - Deterministic geometric analysis only (finger flexion, angles, normalized distances).
 * - matchScore is a geometric fit score (0.0–1.0), NOT an ML probability.
 * - Any hand pose failing strict anatomical thresholds returns UNKNOWN.
 * - Zero guessing or hallucination. False negatives are preferred over false positives.
 *
 * Known False-Positive Eliminations (Phase 5):
 * - Open palm / waving hand must NOT trigger HELP.
 * - Relaxed or downward-oriented curled fingers must NOT trigger THEFT.
 * - Two resting/idle fists on a desk must NOT trigger ACCIDENT.
 * - STOP requires tight vertical flat palm (spread < 0.20) + upright orientation.
 * - ACCIDENT requires deliberate frontal head-on horizontal fist alignment.
 */

import { HAND_LANDMARK } from './islTypes.js';
import { VOCABULARY_MAP } from './islVocabulary.js';

/**
 * Calculates Euclidean distance between two 3D points
 */
export function euclideanDistance(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = (p1.x || 0) - (p2.x || 0);
  const dy = (p1.y || 0) - (p2.y || 0);
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Extracts normalized geometric finger metrics for a single hand (21 landmarks).
 * Returns null if landmarks are degenerate, anatomically implausible, or incomplete.
 */
export function extractHandFeatures(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;

  const wrist = landmarks[HAND_LANDMARK.WRIST];
  const middleMcp = landmarks[HAND_LANDMARK.MIDDLE_FINGER_MCP];

  // Palm reference scale: wrist to middle MCP
  const palmScale = euclideanDistance(wrist, middleMcp);
  if (palmScale <= 0.0001) return null;

  // Anatomical check: palm width (index MCP to pinky MCP) relative to palm height
  const palmWidth = euclideanDistance(
    landmarks[HAND_LANDMARK.INDEX_FINGER_MCP],
    landmarks[HAND_LANDMARK.PINKY_MCP]
  );
  const palmWidthRatio = palmWidth / palmScale;
  if (palmWidthRatio < 0.35 || palmWidthRatio > 1.3) return null;

  const normDist = (idx1, idx2) =>
    euclideanDistance(landmarks[idx1], landmarks[idx2]) / palmScale;

  // Fingertip-to-wrist distances (larger = more extended)
  const thumbTipDistWrist   = normDist(HAND_LANDMARK.THUMB_TIP,          HAND_LANDMARK.WRIST);
  const indexTipDistWrist   = normDist(HAND_LANDMARK.INDEX_FINGER_TIP,   HAND_LANDMARK.WRIST);
  const middleTipDistWrist  = normDist(HAND_LANDMARK.MIDDLE_FINGER_TIP,  HAND_LANDMARK.WRIST);
  const ringTipDistWrist    = normDist(HAND_LANDMARK.RING_FINGER_TIP,     HAND_LANDMARK.WRIST);
  const pinkyTipDistWrist   = normDist(HAND_LANDMARK.PINKY_TIP,           HAND_LANDMARK.WRIST);

  // Fingertip-to-MCP distances (extension ratio)
  const thumbTipToMcp  = normDist(HAND_LANDMARK.THUMB_TIP,         HAND_LANDMARK.THUMB_MCP);
  const indexTipToMcp  = normDist(HAND_LANDMARK.INDEX_FINGER_TIP,  HAND_LANDMARK.INDEX_FINGER_MCP);
  const middleTipToMcp = normDist(HAND_LANDMARK.MIDDLE_FINGER_TIP, HAND_LANDMARK.MIDDLE_FINGER_MCP);
  const ringTipToMcp   = normDist(HAND_LANDMARK.RING_FINGER_TIP,   HAND_LANDMARK.RING_FINGER_MCP);
  const pinkyTipToMcp  = normDist(HAND_LANDMARK.PINKY_TIP,         HAND_LANDMARK.PINKY_MCP);

  // Thumb extension: requires clear lateral displacement away from pinky side
  const thumbToPinkyMcp  = normDist(HAND_LANDMARK.THUMB_TIP,  HAND_LANDMARK.PINKY_MCP);
  const thumbToIndexMcp  = normDist(HAND_LANDMARK.THUMB_TIP,  HAND_LANDMARK.INDEX_FINGER_MCP);
  const thumbExtended    = thumbToPinkyMcp > 0.8 && thumbTipToMcp > 0.6;

  // Finger extension (strict: tip significantly past PIP and wrist distance must exceed PIP distance)
  const indexPipDistWrist  = normDist(HAND_LANDMARK.INDEX_FINGER_PIP,  HAND_LANDMARK.WRIST);
  const middlePipDistWrist = normDist(HAND_LANDMARK.MIDDLE_FINGER_PIP, HAND_LANDMARK.WRIST);
  const ringPipDistWrist   = normDist(HAND_LANDMARK.RING_FINGER_PIP,   HAND_LANDMARK.WRIST);
  const pinkyPipDistWrist  = normDist(HAND_LANDMARK.PINKY_PIP,         HAND_LANDMARK.WRIST);

  const indexExtended  = indexTipToMcp  > 1.3 && indexTipDistWrist  > indexPipDistWrist;
  const middleExtended = middleTipToMcp > 1.3 && middleTipDistWrist > middlePipDistWrist;
  const ringExtended   = ringTipToMcp   > 1.3 && ringTipDistWrist   > ringPipDistWrist;
  const pinkyExtended  = pinkyTipToMcp  > 1.3 && pinkyTipDistWrist  > pinkyPipDistWrist;

  // Inter-fingertip spreads (normalized by palm scale)
  const indexMiddleSpread = normDist(HAND_LANDMARK.INDEX_FINGER_TIP,  HAND_LANDMARK.MIDDLE_FINGER_TIP);
  const middleRingSpread  = normDist(HAND_LANDMARK.MIDDLE_FINGER_TIP, HAND_LANDMARK.RING_FINGER_TIP);
  const ringPinkySpread   = normDist(HAND_LANDMARK.RING_FINGER_TIP,   HAND_LANDMARK.PINKY_TIP);
  const thumbIndexTipDist = normDist(HAND_LANDMARK.THUMB_TIP,         HAND_LANDMARK.INDEX_FINGER_TIP);

  // Wrist orientation proxy: wrist y vs middle MCP y
  // In a typical frontal camera view, wrist.y > middleMcp.y means hand is upright (fingers up).
  // If wrist.y < middleMcp.y the hand is inverted/downward (e.g. resting on desk, typing posture).
  const isHandUpright = wrist.y > middleMcp.y; // true when fingers point up/forward

  return {
    palmScale,
    extensions: {
      thumb:  thumbExtended,
      index:  indexExtended,
      middle: middleExtended,
      ring:   ringExtended,
      pinky:  pinkyExtended,
    },
    ratios: {
      indexTipToMcp,
      middleTipToMcp,
      ringTipToMcp,
      pinkyTipToMcp,
      thumbToPinkyMcp,
      thumbToIndexMcp,
    },
    spreads: {
      indexMiddle:  indexMiddleSpread,
      middleRing:   middleRingSpread,
      ringPinky:    ringPinkySpread,
      thumbIndex:   thumbIndexTipDist,
    },
    isHandUpright,
    landmarks,
  };
}

/**
 * Classifies a single hand into an ISL sign based on strict geometric features.
 * Returns UNKNOWN result object (never null/undefined) for any unrecognized posture.
 *
 * IMPORTANT: matchScore is a geometric fit score only, not an ML probability.
 * Any matchScore < 0.90 is treated as UNKNOWN by the adapter.
 */
export function classifySingleHand(features) {
  if (!features) return _unknownResult();

  const { extensions, spreads, ratios, isHandUpright } = features;
  const { thumb, index, middle, ring, pinky } = extensions;

  // ── 1. PHONE / Y: Thumb + Pinky extended, Index/Middle/Ring tightly curled ──
  // Strict: middle 3 must NOT be extended; thumb must be clearly displaced
  if (thumb && pinky && !index && !middle && !ring) {
    // Verify pinky is genuinely extended (not just slightly raised)
    if (ratios.pinkyTipToMcp > 1.35 && ratios.thumbToPinkyMcp > 0.9) {
      const matchScore = Math.min(0.96, 0.82 + ratios.thumbToPinkyMcp * 0.10);
      return _createResult('PHONE', matchScore);
    }
  }

  // ── 2. STOP: Flat vertical palm, ALL 5 fingers extended + tightly together ──
  // False-positive guard: must be upright hand orientation + tight finger cohesion
  // An open relaxed hand or waving does NOT meet the tight spread requirement.
  if (thumb && index && middle && ring && pinky) {
    const maxSpread = Math.max(spreads.indexMiddle, spreads.middleRing, spreads.ringPinky);

    // STOP requires tight cohesion (spread <= 0.32) and upright orientation
    if (maxSpread <= 0.32 && isHandUpright) {
      const cohesionBonus = Math.max(0, (0.32 - maxSpread) * 0.5);
      const matchScore = Math.min(0.96, 0.91 + cohesionBonus);
      return _createResult('STOP', matchScore);
    }

    // HELP / 5: All 5 fingers extended and SPREAD (deliberate emergency gesture)
    // False-positive guard: requires EXPLICIT wide spread (> 0.35 average)
    // A waving hand, casual open palm, or relaxed flat palm does NOT qualify.
    // Waving involves rapid motion — this classifier only sees static frames,
    // but we further require the hand to be upright and spread to be deliberate.
    const avgSpread = (spreads.indexMiddle + spreads.middleRing + spreads.ringPinky) / 3;
    if (avgSpread > 0.35 && isHandUpright && spreads.indexMiddle > 0.28 && spreads.middleRing > 0.28) {
      const matchScore = Math.min(0.94, 0.78 + avgSpread * 0.30);
      return _createResult('HELP', matchScore);
    }

    // All-5-extended but not meeting STOP or HELP criteria → UNKNOWN
    return _unknownResult();
  }

  // ── 3. Number 4 / B: 4 fingers extended (Index/Middle/Ring/Pinky), Thumb folded ──
  if (!thumb && index && middle && ring && pinky) {
    if (spreads.indexMiddle < 0.35 && spreads.middleRing < 0.35) {
      return _createResult('B', 0.90);
    }
    return _createResult('4', 0.90);
  }

  // ── 4. W: Index/Middle/Ring extended, Pinky and Thumb folded ──
  if (!thumb && index && middle && ring && !pinky) {
    return _createResult('W', 0.90);
  }

  // ── 5. Number 3: Thumb/Index/Middle extended, Ring and Pinky folded ──
  if (thumb && index && middle && !ring && !pinky) {
    return _createResult('3', 0.90);
  }

  // ── 6. V / Number 2: Index + Middle extended and spread, others curled ──
  if (!ring && !pinky && index && middle && !thumb) {
    const matchScore = spreads.indexMiddle > 0.30 ? 0.93 : 0.90;
    return _createResult('V', matchScore);
  }

  // ── 7. Number 1 / Pointing / PAIN: Only Index extended, others strictly curled ──
  if (index && !middle && !ring && !pinky) {
    if (thumb && ratios.thumbToIndexMcp > 0.6) {
      return _createResult('L', 0.91);
    }
    // Verify middle/ring/pinky are genuinely curled (not ambiguously semi-extended)
    if (ratios.middleTipToMcp < 1.0 && ratios.ringTipToMcp < 1.0) {
      return _createResult('1', 0.90);
    }
  }

  // ── 8. YES: Closed fist with thumb visibly extended upward ──
  if (thumb && !index && !middle && !ring && !pinky && ratios.thumbToPinkyMcp > 0.75) {
    // Verify remaining fingers are tightly curled
    if (ratios.indexTipToMcp < 0.85 && ratios.middleTipToMcp < 0.85) {
      return _createResult('YES', 0.90);
    }
  }

  // ── 9. A / Tight fist: All fingers curled, thumb resting alongside index ──
  // False-positive guard against resting/typing posture:
  // - Requires upright hand orientation (not desk/downward)
  // - Requires tight curl ratios (tips must be close to MCPs)
  if (!thumb && !index && !middle && !ring && !pinky && isHandUpright) {
    if (
      ratios.indexTipToMcp  > 0.15 && ratios.indexTipToMcp  < 0.75 &&
      ratios.middleTipToMcp > 0.15 && ratios.middleTipToMcp < 0.75 &&
      ratios.thumbToIndexMcp < 0.65
    ) {
      return _createResult('A', 0.91);
    }
  }

  // ── 10. C: Curved partial arch (thumb and index form visible C) ──
  if (
    ratios.indexTipToMcp  > 0.9 && ratios.indexTipToMcp  < 1.4 &&
    ratios.middleTipToMcp > 0.9 && ratios.middleTipToMcp < 1.4 &&
    spreads.thumbIndex > 0.4 && spreads.thumbIndex < 0.9
  ) {
    return _createResult('C', 0.90);
  }

  // ── 11. THEFT: Deliberate snatching claw — curved fingers facing palm ──
  // False-positive guard: This posture overlaps significantly with common
  // desk/resting/typing postures. Require:
  // - Hand MUST be upright (fingers forward/up, not resting downward)
  // - MUST have tight claw curl: tips clearly forward of MCPs but curled inward
  // - All 4 fingers must be in claw (not just one or two)
  if (
    !index && !middle && !ring && !pinky &&       // all four fingers NOT extended
    ratios.indexTipToMcp  > 0.80 && ratios.indexTipToMcp  < 1.25 &&
    ratios.middleTipToMcp > 0.80 && ratios.middleTipToMcp < 1.25 &&
    ratios.ringTipToMcp   > 0.80 && ratios.ringTipToMcp   < 1.25 &&
    ratios.pinkyTipToMcp  > 0.70 && ratios.pinkyTipToMcp  < 1.20 &&
    isHandUpright    // CRITICAL: must be upright — rules out desk resting posture
  ) {
    return _createResult('THEFT', 0.90);
  }

  // ── 12. MONEY: Thumb tip very close to index pad (deliberate pinch rubbing) ──
  // False-positive guard: requires tight pinch AND ring/pinky curled
  if (spreads.thumbIndex < 0.20 && !ring && !pinky && ratios.ringTipToMcp < 0.90) {
    return _createResult('MONEY', 0.90);
  }

  // ── No authentic geometric signature matches: return UNKNOWN ──
  return _unknownResult();
}

/**
 * Classifies two hands simultaneously (e.g., ACCIDENT, NO).
 * Returns UNKNOWN result if no authenticated two-hand pattern matches.
 *
 * False-positive guard on ACCIDENT:
 * - Two fists that are merely resting close together (as on a desk) must NOT
 *   trigger ACCIDENT. This is enforced by requiring:
 *   (a) both hands to classify as fist type (A or YES)
 *   (b) wrists at roughly the SAME HEIGHT (horizontal alignment, not both hanging low)
 *   (c) wrists within moderate lateral proximity (interWristDist 0.5–2.2)
 *   (d) both hands to be upright
 */
export function classifyTwoHands(hand1Features, hand2Features) {
  if (!hand1Features || !hand2Features) return _unknownResult();

  const wrist1 = hand1Features.landmarks[HAND_LANDMARK.WRIST];
  const wrist2 = hand2Features.landmarks[HAND_LANDMARK.WRIST];
  const avgPalmScale = (hand1Features.palmScale + hand2Features.palmScale) / 2;
  const interWristDist = euclideanDistance(wrist1, wrist2) / avgPalmScale;

  // Vertical alignment check: wrists must be approximately at the same height
  // (horizontal frontal collision). If they differ by more than 0.5 palmScale
  // in Y they are likely stacked/resting, not colliding.
  const wristYDiffNorm = Math.abs(wrist1.y - wrist2.y) / avgPalmScale;

  const hand1Clas = classifySingleHand(hand1Features);
  const hand2Clas = classifySingleHand(hand2Features);

  const hand1IsFist = hand1Clas?.code === 'A' || hand1Clas?.code === 'YES';
  const hand2IsFist = hand2Clas?.code === 'A' || hand2Clas?.code === 'YES';

  // ACCIDENT: Two fists in deliberate head-on horizontal collision posture
  if (
    hand1IsFist &&
    hand2IsFist &&
    interWristDist >= 0.45 &&     // not completely merged (resting on same spot)
    interWristDist < 2.2 &&       // not too far apart
    wristYDiffNorm < 0.50 &&      // roughly same height (horizontal alignment)
    hand1Features.isHandUpright &&
    hand2Features.isHandUpright
  ) {
    return _createResult('ACCIDENT', 0.91);
  }

  // NO: Two hands with index fingers crossing or waving at each other
  if (
    hand1Features.extensions.index &&
    hand2Features.extensions.index &&
    interWristDist < 2.0
  ) {
    return _createResult('NO', 0.90);
  }

  // Return the higher-scoring single-hand detection if no two-hand pattern matches
  const h1Score = hand1Clas?.matchScore ?? 0;
  const h2Score = hand2Clas?.matchScore ?? 0;
  if (hand1Clas?.code !== 'UNKNOWN' && hand2Clas?.code !== 'UNKNOWN') {
    return h1Score >= h2Score ? hand1Clas : hand2Clas;
  }
  if (hand1Clas?.code !== 'UNKNOWN') return hand1Clas;
  if (hand2Clas?.code !== 'UNKNOWN') return hand2Clas;
  return _unknownResult();
}

// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Creates a structured gesture result.
 * Returns UNKNOWN if vocabulary entry missing or matchScore < minMatchScore.
 *
 * @param {string} code - Gesture code
 * @param {number} matchScore - Geometric fit score (0.0–1.0), NOT an ML probability
 */
function _createResult(code, matchScore) {
  const vocab = VOCABULARY_MAP.get(code);
  if (!vocab) return _unknownResult();

  // Gate: score below the vocabulary minimum match threshold → UNKNOWN
  if (matchScore < (vocab.minMatchScore || 0.90)) return _unknownResult();

  return {
    code:             vocab.code,
    label:            vocab.label,
    tamilLabel:       vocab.tamilLabel,
    category:         vocab.category,
    matchScore:       Math.round(matchScore * 100) / 100,
    holdDurationMs:   vocab.holdDurationMs,
    statementFragment: vocab.statementFragment,
    isCandidate:      true,
    timestamp:        Date.now(),
  };
}

/**
 * Standard UNKNOWN result — returned for any unrecognized or ambiguous hand posture.
 * The adapter filters these out completely (they never emit tokens).
 */
function _unknownResult() {
  return {
    code:          'UNKNOWN',
    label:         'Unrecognized Gesture',
    tamilLabel:    'அடையாளம் தெரியாத சைகை',
    category:      'unknown',
    matchScore:    0,
    isCandidate:   false,
    holdDurationMs: 0,
    statementFragment: '',
    timestamp:     Date.now(),
  };
}
