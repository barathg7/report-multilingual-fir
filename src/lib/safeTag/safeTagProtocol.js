/**
 * src/lib/safeTag/safeTagProtocol.js
 *
 * REPORT SafeTag BLE Hardware Protocol Specification.
 * Defines the GATT profile, packet structures, input debounce timings,
 * and downstream police acknowledgement vibration patterns for ESP32 hardware integration.
 *
 * ARCHITECTURAL CLASSIFICATION:
 * A. Implemented Web Functionality:
 *    - BLE packet parser and validator
 *    - Protocol state machine
 *    - Interactive browser hardware simulator ("SAFE TAG SIMULATOR — DEMO HARDWARE")
 *    - CIE incident dispatch and 2-pulse simulated vibration acknowledgement
 * B. Android Companion Architecture (Required for physical background lockscreen BLE):
 *    - Android Foreground Service with BluetoothLeScanner
 *    - Automatic GPS acquisition & HTTPS dispatch to REPORT backend
 * C. Future Standalone Device:
 *    - Cellular LTE-M / NB-IoT + GNSS direct hardware module (no phone intermediary)
 */

export const SAFETAG_BLE_UUIDS = Object.freeze({
  SERVICE_EMERGENCY: "0000ffe0-0000-1000-8000-00805f9b34fb",
  CHAR_TRIGGER_EVENT: "0000ffe1-0000-1000-8000-00805f9b34fb",   // Notify (Uplink to phone)
  CHAR_POLICE_ACK: "0000ffe2-0000-1000-8000-00805f9b34fb",      // Write/Indicate (Downlink to SafeTag)
  CHAR_DEVICE_TELEMETRY: "0000ffe3-0000-1000-8000-00805f9b34fb", // Read/Notify (Battery, status)
});

export const SAFETAG_EVENT_TYPES = Object.freeze({
  SOS_GENERAL: "SOS_GENERAL",
  SOS_PHYSICAL_THREAT: "SOS_PHYSICAL_THREAT",
  SOS_MEDICAL: "SOS_MEDICAL",
  CANCEL: "CANCEL",
  STATUS: "STATUS",
});

export const SAFETAG_TIMINGS = Object.freeze({
  DEBOUNCE_MS: 50,
  LONG_PRESS_THRESHOLD_MS: 3000,
  DOUBLE_PRESS_MAX_INTERVAL_MS: 400,
  CANCELLATION_WINDOW_MS: 10000,
  CANCELLATION_HOLD_MS: 5000,
  ACK_VIBRATION_PULSES: 2,
  ACK_VIBRATION_PATTERN_MS: [300, 150, 300], // 2 pulses: 300ms buzz, 150ms pause, 300ms buzz
});

/**
 * Validates a SafeTag BLE packet against the official protocol schema.
 * @param {Object} packet
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSafeTagPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object") {
    return { valid: false, errors: ["Packet must be a valid JSON object"] };
  }

  if (!packet.device_id || typeof packet.device_id !== "string" || !packet.device_id.trim()) {
    errors.push("Missing or invalid device_id");
  }

  if (!packet.firmware_version || typeof packet.firmware_version !== "string") {
    errors.push("Missing or invalid firmware_version");
  }

  if (typeof packet.battery_level !== "number" || packet.battery_level < 0 || packet.battery_level > 100) {
    errors.push("battery_level must be an integer between 0 and 100");
  }

  if (!packet.event_type || !SAFETAG_EVENT_TYPES[packet.event_type]) {
    errors.push(`Invalid event_type: ${packet.event_type}. Allowed: ${Object.keys(SAFETAG_EVENT_TYPES).join(", ")}`);
  }

  if (!packet.event_id || typeof packet.event_id !== "string" || !packet.event_id.trim()) {
    errors.push("Missing or invalid event_id UUID");
  }

  if (!packet.timestamp || isNaN(Date.parse(packet.timestamp))) {
    errors.push("Missing or invalid ISO-8601 timestamp");
  }

  if (typeof packet.sequence_number !== "number" || packet.sequence_number < 0) {
    errors.push("sequence_number must be a non-negative integer");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Encodes a SafeTag event into a normalized JSON payload.
 * @param {Object} params
 * @param {string} params.deviceId
 * @param {string} params.eventType
 * @param {number} [params.batteryLevel=100]
 * @param {number} [params.sequenceNumber=1]
 * @param {string} [params.firmwareVersion='1.0.0-ESP32']
 * @returns {Object} Canonical SafeTag Packet
 */
export function buildSafeTagPacket({
  deviceId = "SAFETAG-ESP32-DEMO",
  eventType = SAFETAG_EVENT_TYPES.SOS_GENERAL,
  batteryLevel = 95,
  sequenceNumber = 1,
  firmwareVersion = "1.0.0-ESP32",
}) {
  const eventId = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `stag_evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const packet = {
    device_id: deviceId,
    firmware_version: firmwareVersion,
    battery_level: Math.max(0, Math.min(100, Math.round(batteryLevel))),
    event_type: eventType,
    event_id: eventId,
    timestamp: new Date().toISOString(),
    sequence_number: Math.max(0, Math.round(sequenceNumber)),
  };

  const validation = validateSafeTagPacket(packet);
  if (!validation.valid) {
    throw new Error(`Invalid SafeTag packet: ${validation.errors.join(", ")}`);
  }

  return packet;
}

/**
 * Constructs the downlink police acknowledgement payload.
 * @param {Object} params
 * @param {string} params.sosId
 * @param {string} params.stationCode
 * @param {string} params.stationName
 * @param {string} params.officerBadge
 * @returns {Object}
 */
export function buildDownlinkAckPayload({
  sosId,
  stationCode,
  stationName,
  officerBadge = "OFFICER",
}) {
  return {
    ack: true,
    sos_id: sosId,
    station_code: stationCode,
    station_name: stationName,
    officer_badge: officerBadge,
    vibration_pulses: SAFETAG_TIMINGS.ACK_VIBRATION_PULSES,
    vibration_pattern_ms: SAFETAG_TIMINGS.ACK_VIBRATION_PATTERN_MS,
    timestamp: new Date().toISOString(),
  };
}

