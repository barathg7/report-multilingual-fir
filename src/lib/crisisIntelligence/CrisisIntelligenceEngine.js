/**
 * src/lib/crisisIntelligence/CrisisIntelligenceEngine.js
 *
 * Crisis Intelligence Engine (CIE) for REPORT Universal Emergency System.
 *
 * Converts discrete emergency alerts into structured, living, evolving incidents.
 * Maintains an append-only timeline, aggregates known facts, prevents threat downgrades,
 * preserves provenance, and keeps police command updated in real time.
 */

import { supabase } from "../supabaseClient.js";
import {
  EMERGENCY_CATEGORIES,
  THREAT_LEVELS,
  INCIDENT_PRIORITY,
  PROVENANCE_SOURCES,
  EMERGENCY_TAXONOMY_METADATA,
  computeDeterministicPriority,
  buildProvenanceRecord,
  isValidEmergencyCategory,
} from "./emergencyTaxonomy.js";
import { loadFromStorage, saveToStorage } from "../../utils/index.js";
import { buildCanonicalSosMessage, buildMapsUrl } from "../sosClient.js";

const LOCAL_INCIDENTS_KEY = "report_cie_local_incidents";

export class CrisisIntelligenceEngine {
  /**
   * Creates a structured emergency incident.
   *
   * @param {Object} params
   * @param {{ lat: number, lng: number, accuracy?: number }} params.location
   * @param {Object} params.nearestStation
   * @param {string} [params.emergencyType]
   * @param {string} [params.source]
   * @param {Object} [params.initialFacts]
   * @param {string} [params.userNotes]
   * @param {string} [params.userId]
   * @param {string} [params.safetagDeviceId]
   * @param {string} [params.safetagEventId]
   * @returns {Promise<Object>} Created incident record
   */
  static async createIncident({
    location,
    nearestStation,
    emergencyType = EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY,
    source = PROVENANCE_SOURCES.WEB_QUICKSHIELD,
    initialFacts = {},
    userNotes = "",
    userId = null,
    safetagDeviceId = null,
    safetagEventId = null,
  }) {
    const validCategory = isValidEmergencyCategory(emergencyType)
      ? emergencyType
      : EMERGENCY_CATEGORIES.OTHER_CRITICAL_EMERGENCY;

    const categoryMeta = EMERGENCY_TAXONOMY_METADATA[validCategory];
    const computedPriority = computeDeterministicPriority(validCategory, initialFacts);
    const initialThreatLevel = categoryMeta.defaultThreatLevel || THREAT_LEVELS.ACTIVE_THREAT;

    const lat = location ? Number(location.lat) : 0;
    const lng = location ? Number(location.lng) : 0;
    const accuracy = location?.accuracy ? Math.round(Number(location.accuracy)) : null;
    const mapsUrl = buildMapsUrl(lat, lng);

    const stnCode = (nearestStation?.station_code || nearestStation?.code || "ONLINE").trim().toUpperCase();
    const stnName = (nearestStation?.station_name || nearestStation?.name || "Jurisdictional Police").trim();

    const timestamp = new Date().toISOString();
    const incidentId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inc_${Date.now()}`;

    // Provenance entry
    const provenance = buildProvenanceRecord({
      source,
      userConfirmed: true,
      confidence: 1.0,
      location,
      emergencyType: validCategory,
      threatLevel: initialThreatLevel,
    });

    // Initial timeline event: Emergency Activated
    const initialTimeline = [
      {
        event_id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt_init_${Date.now()}`,
        event_type: "EMERGENCY_ACTIVATED",
        description: `Emergency incident initiated: ${categoryMeta.label}`,
        actor: "CITIZEN",
        source,
        timestamp,
        metadata: {
          emergency_type: validCategory,
          threat_level: initialThreatLevel,
          priority: computedPriority,
          location: { lat, lng, accuracy },
        },
      },
    ];

    if (userNotes && userNotes.trim()) {
      initialTimeline.push({
        event_id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt_note_${Date.now()}`,
        event_type: "CITIZEN_DESCRIPTION",
        description: `Victim statement: "${userNotes.trim().slice(0, 280)}"`,
        actor: "CITIZEN",
        source,
        timestamp: new Date().toISOString(),
      });
    }

    const canonicalMsg = buildCanonicalSosMessage({
      location,
      nearestStation,
      timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    });

    const payload = {
      id: incidentId,
      user_id: userId,
      latitude: lat,
      longitude: lng,
      accuracy,
      nearest_station_code: stnCode,
      nearest_station_name: stnName,
      maps_url: mapsUrl,
      message: canonicalMsg,
      status: "active",
      emergency_type: validCategory,
      priority: computedPriority,
      threat_level: initialThreatLevel,
      victim_status: "REQUIRES_ASSISTANCE",
      incident_facts: {
        ...initialFacts,
        description: userNotes ? userNotes.slice(0, 280) : undefined,
        provenance,
      },
      incident_timeline: initialTimeline,
      source,
      safetag_device_id: safetagDeviceId,
      safetag_event_id: safetagEventId,
      created_at: timestamp,
    };

    // Insert into Supabase with fallback to local storage
    try {
      let isAuthed = false;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        isAuthed = Boolean(sessionData?.session?.user);
      } catch (_) {}

      if (isAuthed) {
        const { data, error } = await supabase
          .from("sos_records")
          .insert(payload)
          .select()
          .single();

        if (error) {
          console.warn("[CIE] Supabase insert error, saving to local store:", error.message);
        } else if (data) {
          const record = { ...data, _supabase_inserted: true, _local_only: false };
          CrisisIntelligenceEngine._saveLocalIncident(record);
          return record;
        }
      } else {
        const { error } = await supabase.from("sos_records").insert(payload);
        if (error) {
          console.warn("[CIE] Supabase anon insert error, saving to local store:", error.message);
        } else {
          const createdRecord = {
            ...payload,
            _supabase_inserted: true,
            _local_only: false,
          };
          CrisisIntelligenceEngine._saveLocalIncident(createdRecord);
          return createdRecord;
        }
      }
    } catch (err) {
      console.warn("[CIE] Network error creating incident, using local fallback:", err.message);
    }

    // Local fallback
    const fallbackRecord = {
      ...payload,
      _supabase_inserted: false,
      _local_only: true,
    };
    CrisisIntelligenceEngine._saveLocalIncident(fallbackRecord);
    return fallbackRecord;
  }

  /**
   * Appends an immutable timeline event to an incident.
   *
   * @param {string} incidentId
   * @param {Object} eventParams
   * @param {string} eventParams.eventType
   * @param {string} eventParams.description
   * @param {string} [eventParams.actor='CITIZEN']
   * @param {string} [eventParams.source='WEB_QUICKSHIELD']
   * @param {Object} [eventParams.metadata={}]
   * @returns {Promise<Object>}
   */
  static async appendTimelineEvent(incidentId, {
    eventType,
    description,
    actor = "CITIZEN",
    source = PROVENANCE_SOURCES.WEB_QUICKSHIELD,
    metadata = {},
  }) {
    if (!incidentId) throw new Error("incidentId is required");

    const newEvent = {
      event_id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt_${Date.now()}`,
      event_type: eventType,
      description,
      actor,
      source,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // 1. Attempt database RPC
    try {
      const { data, error } = await supabase.rpc("append_incident_event", {
        p_sos_id: incidentId,
        p_event_type: eventType,
        p_description: description,
        p_actor: actor,
        p_source: source,
        p_metadata: metadata,
      });

      if (!error && data?.success) {
        CrisisIntelligenceEngine._appendLocalEvent(incidentId, newEvent);
        return { success: true, event: newEvent, remote: true };
      }
    } catch (rpcErr) {
      console.warn("[CIE] append_incident_event RPC unavailable, updating local cache:", rpcErr.message);
    }

    // 2. Direct Supabase update or local cache update
    CrisisIntelligenceEngine._appendLocalEvent(incidentId, newEvent);
    return { success: true, event: newEvent, remote: false };
  }

  /**
   * Updates structured facts (weapons, suspects count, safe shelter, victim status).
   *
   * @param {string} incidentId
   * @param {Object} newFacts
   * @param {string} [actor='CITIZEN']
   * @param {string} [source='ADAPTIVE_INTERVIEW']
   * @returns {Promise<Object>}
   */
  static async updateFacts(incidentId, newFacts, actor = "CITIZEN", source = PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW) {
    if (!incidentId) throw new Error("incidentId is required");

    try {
      const { data, error } = await supabase.rpc("update_incident_facts", {
        p_sos_id: incidentId,
        p_facts: newFacts,
        p_actor: actor,
        p_source: source,
      });

      if (!error && data?.success) {
        CrisisIntelligenceEngine._updateLocalFacts(incidentId, newFacts);
        return data;
      }
    } catch (rpcErr) {
      console.warn("[CIE] update_incident_facts RPC error, updating local cache:", rpcErr.message);
    }

    CrisisIntelligenceEngine._updateLocalFacts(incidentId, newFacts);
    return { success: true, incidentId, facts: newFacts, remote: false };
  }

  /**
   * Alias for updateFacts
   */
  static async updateStructuredFacts(incidentId, newFacts, actor = "CITIZEN", source = PROVENANCE_SOURCES.ADAPTIVE_INTERVIEW) {
    return CrisisIntelligenceEngine.updateFacts(incidentId, newFacts, actor, source);
  }

  /**
   * Evolves threat level with strict anti-downgrade governance.
   *
   * @param {string} incidentId
   * @param {string} targetLevel - One of THREAT_LEVELS
   * @param {string} reason
   * @param {string} [actor='SYSTEM']
   * @param {string} [source='CRISIS_INTELLIGENCE_ENGINE']
   * @returns {Promise<Object>}
   */
  static async evolveThreatLevel(
    incidentId,
    targetLevel,
    reason,
    actor = "SYSTEM",
    source = PROVENANCE_SOURCES.WEB_QUICKSHIELD
  ) {
    if (!incidentId || !targetLevel) throw new Error("incidentId and targetLevel are required");

    try {
      const { data, error } = await supabase.rpc("evolve_threat_level", {
        p_sos_id: incidentId,
        p_new_level: targetLevel,
        p_reason: reason,
        p_actor: actor,
        p_source: source,
      });

      if (!error && data?.success) {
        CrisisIntelligenceEngine._updateLocalThreat(incidentId, targetLevel, reason, actor);
        return data;
      }
      if (data?.error) {
        return { success: false, error: data.error };
      }
    } catch (rpcErr) {
      console.warn("[CIE] evolve_threat_level RPC error:", rpcErr.message);
    }

    CrisisIntelligenceEngine._updateLocalThreat(incidentId, targetLevel, reason, actor);
    return { success: true, incidentId, new_level: targetLevel, remote: false };
  }

  /**
   * Subscribes to realtime updates for an incident.
   *
   * @param {string} incidentId
   * @param {Function} onUpdate
   * @returns {Object} Subscription handle with unsubscribe method
   */
  static subscribeIncident(incidentId, onUpdate) {
    if (!incidentId) return { unsubscribe: () => {} };

    const channel = supabase
      .channel(`incident-live-${incidentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sos_records",
          filter: `id=eq.${incidentId}`,
        },
        (payload) => {
          if (payload.new && payload.new.id === incidentId) {
            onUpdate?.(payload.new);
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // ── Local Storage Helpers ───────────────────────────────────────────────────

  static _saveLocalIncident(incident) {
    const list = loadFromStorage(LOCAL_INCIDENTS_KEY, []);
    const filtered = list.filter((i) => i.id !== incident.id);
    saveToStorage(LOCAL_INCIDENTS_KEY, [incident, ...filtered.slice(0, 49)]);
  }

  static _appendLocalEvent(incidentId, event) {
    const list = loadFromStorage(LOCAL_INCIDENTS_KEY, []);
    const updated = list.map((i) => {
      if (i.id === incidentId) {
        const timeline = Array.isArray(i.incident_timeline) ? i.incident_timeline : [];
        return {
          ...i,
          incident_timeline: [...timeline, event],
          updated_at: new Date().toISOString(),
        };
      }
      return i;
    });
    saveToStorage(LOCAL_INCIDENTS_KEY, updated);
  }

  static _updateLocalFacts(incidentId, facts) {
    const list = loadFromStorage(LOCAL_INCIDENTS_KEY, []);
    const updated = list.map((i) => {
      if (i.id === incidentId) {
        const currentFacts = i.incident_facts || {};
        const merged = { ...currentFacts, ...facts };
        const newPriority = computeDeterministicPriority(i.emergency_type, merged);
        return {
          ...i,
          incident_facts: merged,
          priority: newPriority,
          updated_at: new Date().toISOString(),
        };
      }
      return i;
    });
    saveToStorage(LOCAL_INCIDENTS_KEY, updated);
  }

  static _updateLocalThreat(incidentId, newLevel, reason, actor) {
    const list = loadFromStorage(LOCAL_INCIDENTS_KEY, []);
    const updated = list.map((i) => {
      if (i.id === incidentId) {
        const timeline = Array.isArray(i.incident_timeline) ? i.incident_timeline : [];
        const event = {
          event_id: `evt_thr_${Date.now()}`,
          event_type: "THREAT_EVOLVED",
          description: `Threat evolved to ${newLevel}: ${reason}`,
          actor,
          timestamp: new Date().toISOString(),
          new_level: newLevel,
        };
        return {
          ...i,
          threat_level: newLevel,
          incident_timeline: [...timeline, event],
          updated_at: new Date().toISOString(),
        };
      }
      return i;
    });
    saveToStorage(LOCAL_INCIDENTS_KEY, updated);
  }
}
