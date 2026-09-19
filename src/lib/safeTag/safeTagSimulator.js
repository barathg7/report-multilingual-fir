/**
 * src/lib/safeTag/safeTagSimulator.js
 *
 * REPORT SafeTag Hardware Simulator Engine.
 * Allows interactive evaluation of ESP32 BLE emergency triggers in browser / demo environments
 * without physical hardware.
 *
 * CRITICAL TRUTHFULNESS SAFEGUARDS:
 * 1. Explicit provenance: `source: 'SAFETAG_BLE_SIMULATOR'`.
 * 2. Visual disclaimer: "SAFE TAG SIMULATOR — DEMO HARDWARE".
 * 3. Never claims physical BLE peripheral is connected unless Web Bluetooth / Companion exists.
 * 4. Simulates downstream police acknowledgement: "2× vibration acknowledgement simulated".
 */

import {
  SAFETAG_EVENT_TYPES,
  SAFETAG_TIMINGS,
  buildSafeTagPacket,
} from "./safeTagProtocol.js";
import { CrisisIntelligenceEngine } from "../crisisIntelligence/CrisisIntelligenceEngine.js";
import { EMERGENCY_CATEGORIES, PROVENANCE_SOURCES } from "../crisisIntelligence/emergencyTaxonomy.js";
import { getNearestPoliceStations } from "../findNearestStation.js";

export class SafeTagSimulator {
  constructor({
    deviceId = "SIM-SAFETAG-001",
    batteryLevel = 92,
    onStateChange = null,
    onVibrationSimulated = null,
  } = {}) {
    this.deviceId = deviceId;
    this.batteryLevel = batteryLevel;
    this.sequenceNumber = 0;
    this.activeIncident = null;
    this.policeAckReceived = false;
    this.isVibrating = false;
    this.lastVibrationMessage = "";
    this.onStateChange = onStateChange;
    this.onVibrationSimulated = onVibrationSimulated;
    this.realtimeSub = null;
  }

  /**
   * Triggers a simulated SafeTag physical input event.
   *
   * @param {string} inputType - 'LONG_PRESS' | 'DOUBLE_PRESS' | 'SECONDARY' | 'CANCEL'
   * @param {{ lat: number, lng: number, accuracy?: number }} location
   * @returns {Promise<Object>} Trigger outcome
   */
  async triggerInput(inputType, location = { lat: 13.0827, lng: 80.2707, accuracy: 8 }) {
    this.sequenceNumber += 1;

    let eventType;
    let emergencyCategory;

    switch (inputType) {
      case "DOUBLE_PRESS":
        eventType = SAFETAG_EVENT_TYPES.SOS_PHYSICAL_THREAT;
        emergencyCategory = EMERGENCY_CATEGORIES.IMMEDIATE_PHYSICAL_THREAT;
        break;
      case "SECONDARY":
        eventType = SAFETAG_EVENT_TYPES.SOS_MEDICAL;
        emergencyCategory = EMERGENCY_CATEGORIES.MEDICAL_EMERGENCY;
        break;
      case "CANCEL":
        eventType = SAFETAG_EVENT_TYPES.CANCEL;
        return this._handleCancellation();
      case "LONG_PRESS":
      default:
        eventType = SAFETAG_EVENT_TYPES.SOS_GENERAL;
        emergencyCategory = EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY;
        break;
    }

    const packet = buildSafeTagPacket({
      deviceId: this.deviceId,
      eventType,
      batteryLevel: this.batteryLevel,
      sequenceNumber: this.sequenceNumber,
    });

    // Find nearest station
    let nearestStation = null;
    try {
      const stations = await getNearestPoliceStations(location.lat, location.lng, 1);
      if (stations && stations.length > 0) {
        nearestStation = stations[0];
      }
    } catch (_) {}

    // Dispatch into Crisis Intelligence Engine
    const incident = await CrisisIntelligenceEngine.createIncident({
      location,
      nearestStation,
      emergencyType: emergencyCategory,
      source: PROVENANCE_SOURCES.SAFETAG_BLE_SIMULATOR,
      initialFacts: {
        safetag_device_id: this.deviceId,
        safetag_event_type: eventType,
        safetag_battery: this.batteryLevel,
        input_mechanism: inputType,
        simulated_hardware: true,
      },
      userNotes: `Triggered via SafeTag Hardware Simulator [${inputType}]`,
      safetagDeviceId: this.deviceId,
      safetagEventId: packet.event_id,
    });

    this.activeIncident = incident;
    this.policeAckReceived = false;
    this._notifyStateChange();

    // Subscribe to police realtime acknowledgement
    if (incident.id) {
      if (this.realtimeSub) this.realtimeSub.unsubscribe();
      this.realtimeSub = CrisisIntelligenceEngine.subscribeIncident(incident.id, (updated) => {
        if (updated.status === "acknowledged" || updated.threat_level === "ACKNOWLEDGED") {
          this.handlePoliceAcknowledgement();
        }
      });
    }

    return {
      success: true,
      packet,
      incident,
      simulated: true,
    };
  }

  /**
   * Handles police acknowledgement downstream notification.
   * Triggers simulated 2-pulse vibration pattern.
   */
  handlePoliceAcknowledgement() {
    if (this.policeAckReceived) return;
    this.policeAckReceived = true;
    this.isVibrating = true;
    this.lastVibrationMessage = "2× vibration acknowledgement simulated";

    // Trigger physical device vibration if browser supports it
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(SAFETAG_TIMINGS.ACK_VIBRATION_PATTERN_MS);
      } catch (_) {}
    }

    this.onVibrationSimulated?.({
      pattern: SAFETAG_TIMINGS.ACK_VIBRATION_PATTERN_MS,
      pulses: SAFETAG_TIMINGS.ACK_VIBRATION_PULSES,
      message: this.lastVibrationMessage,
    });

    this._notifyStateChange();

    setTimeout(() => {
      this.isVibrating = false;
      this._notifyStateChange();
    }, 1000);
  }

  /**
   * Cancels active emergency within grace window.
   */
  async _handleCancellation() {
    if (!this.activeIncident) {
      return { success: false, error: "No active incident to cancel" };
    }

    await CrisisIntelligenceEngine.appendTimelineEvent(this.activeIncident.id, {
      eventType: "SAFETAG_CANCELLED",
      description: "Emergency trigger cancelled via SafeTag hardware input",
      actor: "CITIZEN",
      source: PROVENANCE_SOURCES.SAFETAG_BLE_SIMULATOR,
    });

    this.activeIncident = null;
    this._notifyStateChange();

    return { success: true, cancelled: true };
  }

  _notifyStateChange() {
    this.onStateChange?.({
      deviceId: this.deviceId,
      batteryLevel: this.batteryLevel,
      sequenceNumber: this.sequenceNumber,
      activeIncident: this.activeIncident,
      policeAckReceived: this.policeAckReceived,
      isVibrating: this.isVibrating,
      lastVibrationMessage: this.lastVibrationMessage,
    });
  }

  destroy() {
    if (this.realtimeSub) {
      this.realtimeSub.unsubscribe();
      this.realtimeSub = null;
    }
  }
}
