/**
 * src/lib/signLanguage/islTypes.js
 *
 * Formal data types, enums, and constants for Indian Sign Language (ISL) recognition in REPORT.
 */

export const RECOGNITION_STATE = {
  IDLE: 'idle',
  REQUESTING_CAMERA: 'requesting_camera',
  CAMERA_ACTIVE: 'camera_active',
  DETECTING_HANDS: 'detecting_hands',
  SIGN_DETECTED: 'sign_detected',
  HOLDING_SIGN: 'holding_sign',
  EMERGENCY_CONFIRMATION: 'emergency_confirmation',
  TOKEN_CONFIRMED: 'token_confirmed',
  MODEL_UNAVAILABLE: 'model_unavailable',
  ERROR: 'error',
};

export const MODEL_STATUS = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
};

export const GESTURE_CATEGORIES = {
  EMERGENCY: 'emergency',
  CRIME: 'crime',
  ACTION: 'action',
  NUMBER: 'number',
  ALPHABET: 'alphabet',
  RESPONSE: 'response',
  UNKNOWN: 'unknown',
};

/**
 * Standard gesture code constants including explicit UNKNOWN / NONE
 */
export const GESTURE_CODE = {
  UNKNOWN: 'UNKNOWN',
  NONE: 'NONE',
  HELP: 'HELP',
  POLICE: 'POLICE',
  ACCIDENT: 'ACCIDENT',
  THEFT: 'THEFT',
  STOP: 'STOP',
  PHONE: 'PHONE',
  MONEY: 'MONEY',
  PAIN: 'PAIN',
  YES: 'YES',
  NO: 'NO',
};

/**
 * Tokens that require explicit citizen dialog confirmation before addition
 */
export const EMERGENCY_TOKENS = ['HELP', 'POLICE', 'ACCIDENT', 'THEFT', 'STOP', 'PAIN'];

/**
 * Conservative heuristic candidate match score gate.
 * Any matchScore < 0.90 is treated as UNKNOWN.
 * matchScore >= 0.90 marks a candidate only (NOT verified).
 */
export const CANDIDATE_MIN_SCORE = 0.90;

export const PROVENANCE_SOURCE_EXPERIMENTAL = 'sign_language_experimental';
export const PROVENANCE_SOURCE_MANUAL = 'sign_language_manual';

/**
 * Standard 21 MediaPipe Hand Landmarks Indices
 */
export const HAND_LANDMARK = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_FINGER_MCP: 5,
  INDEX_FINGER_PIP: 6,
  INDEX_FINGER_DIP: 7,
  INDEX_FINGER_TIP: 8,
  MIDDLE_FINGER_MCP: 9,
  MIDDLE_FINGER_PIP: 10,
  MIDDLE_FINGER_DIP: 11,
  MIDDLE_FINGER_TIP: 12,
  RING_FINGER_MCP: 13,
  RING_FINGER_PIP: 14,
  RING_FINGER_DIP: 15,
  RING_FINGER_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
};

/**
 * Skeletal connections for drawing hand landmarks on HTML canvas
 */
export const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base
  [5, 9], [9, 13], [13, 17],
];
