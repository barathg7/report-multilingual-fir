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

/**
 * State machine & protocol processor for SafeTag BLE events.
 * Enforces:
 * 1. Monotonic sequence validation & replay protection
 * 2. Idempotency on duplicate event_id
 * 3. Software debounce filtering (<50ms)
 * 4. Accidental trigger cancellation within grace window
 * 5. Clear separation between DEMO SIMULATOR and physical hardware
 */
export class SafeTagProtocolEngine {
  constructor() {
    this.devices = new Map(); // device_id -> { lastSequence, lastTimestamp, lastEventId, activeTriggerTime }
    this.seenEventIds = new Set();
  }

  /**
   * Resets engine state (useful for tests).
   */
  reset() {
    this.devices.clear();
    this.seenEventIds.clear();
  }

  /**
   * Ingests and validates an incoming SafeTag BLE packet.
   *
   * @param {Object} packet
   * @returns {{ accepted: boolean, status: string, packet?: Object, error?: string, errors?: string[], duplicate?: boolean, isSimulated?: boolean }}
   */
  processPacket(packet) {
    // 1. Packet schema validation
    const validation = validateSafeTagPacket(packet);
    if (!validation.valid) {
      return {
        accepted: false,
        status: "MALFORMED_REJECTED",
        errors: validation.errors,
      };
    }

    const { device_id, event_id, sequence_number, event_type, timestamp } = packet;
    const now = Date.now();
    const packetTime = new Date(timestamp).getTime();

    const isSimulated = device_id.startsWith("SIM-") || device_id.includes("DEMO");

    // 2. Idempotency Check: Exact duplicate event_id
    if (this.seenEventIds.has(event_id)) {
      return {
        accepted: false,
        status: "IDEMPOTENT_DUPLICATE",
        duplicate: true,
        packet,
        isSimulated,
        error: `Duplicate event ${event_id} already ingested`,
      };
    }

    // 3. Device state check
    const deviceState = this.devices.get(device_id) || {
      lastSequence: -1,
      lastTimestamp: 0,
      activeTriggerTime: null,
      lastEventId: null,
    };

    // 4. Sequence Replay Protection
    if (sequence_number <= deviceState.lastSequence) {
      return {
        accepted: false,
        status: "REPLAY_REJECTED",
        error: `Sequence replay detected: received seq ${sequence_number}, last valid was ${deviceState.lastSequence}`,
      };
    }

    // 5. Debounce Check (filters rapid mechanical switch contact bounce <50ms on same switch)
    if (
      event_type !== SAFETAG_EVENT_TYPES.CANCEL &&
      deviceState.lastEventType === event_type &&
      deviceState.lastTimestamp &&
      Math.abs(now - deviceState.lastTimestamp) < SAFETAG_TIMINGS.DEBOUNCE_MS
    ) {
      return {
        accepted: false,
        status: "DEBOUNCED",
        error: `Debounce threshold (${SAFETAG_TIMINGS.DEBOUNCE_MS}ms) active for device ${device_id}`,
      };
    }

    // 6. Accidental Trigger Cancellation
    if (event_type === SAFETAG_EVENT_TYPES.CANCEL) {
      if (!deviceState.activeTriggerTime) {
        return {
          accepted: false,
          status: "CANCEL_REJECTED",
          error: "No active emergency trigger to cancel for this device",
        };
      }

      const elapsed = now - deviceState.activeTriggerTime;
      if (elapsed > SAFETAG_TIMINGS.CANCELLATION_WINDOW_MS) {
        return {
          accepted: false,
          status: "CANCEL_WINDOW_EXPIRED",
          error: `Cancellation window of ${SAFETAG_TIMINGS.CANCELLATION_WINDOW_MS / 1000}s has expired`,
        };
      }

      // Valid cancellation
      deviceState.activeTriggerTime = null;
      deviceState.lastSequence = sequence_number;
      deviceState.lastTimestamp = now;
      deviceState.lastEventId = event_id;
      this.seenEventIds.add(event_id);
      this.devices.set(device_id, deviceState);

      return {
        accepted: true,
        status: "CANCELLED",
        packet,
        isSimulated,
      };
    }

    // 7. Successful emergency or status event
    deviceState.lastSequence = sequence_number;
    deviceState.lastTimestamp = now;
    deviceState.lastEventId = event_id;
    deviceState.lastEventType = event_type;
    if (event_type !== SAFETAG_EVENT_TYPES.STATUS) {
      deviceState.activeTriggerTime = now;
    }

    this.seenEventIds.add(event_id);
    this.devices.set(device_id, deviceState);

    return {
      accepted: true,
      status: "INGESTED",
      packet,
      isSimulated,
    };
  }
}

export const safeTagProtocolEngine = new SafeTagProtocolEngine();


