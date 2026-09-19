# REPORT Crisis Intelligence Engine (CIE) — Technical Specification

## 1. Overview & Purpose

The **Crisis Intelligence Engine (CIE)** transforms traditional static SOS panic signals into **structured, living, evolving incidents**. A real-world emergency is fluid:
- A victim may initially press an alert without speaking.
- Thirty seconds later, the victim may observe an assailant carrying a knife.
- A minute later, the victim may reach a locked room or lose consciousness.
- Police control rooms need real-time situational awareness as these facts develop, without having their initial logs wiped or overwritten.

---

## 2. Living Incident Data Model

CIE incidents are persisted in the extended `sos_records` table:

```sql
ALTER TABLE sos_records
  ADD COLUMN IF NOT EXISTS emergency_type TEXT DEFAULT 'OTHER_CRITICAL_EMERGENCY',
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'HIGH',
  ADD COLUMN IF NOT EXISTS threat_level TEXT DEFAULT 'ACTIVE_THREAT',
  ADD COLUMN IF NOT EXISTS victim_status TEXT DEFAULT 'REQUIRES_ASSISTANCE',
  ADD COLUMN IF NOT EXISTS incident_facts JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS incident_timeline JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'WEB_QUICKSHIELD',
  ADD COLUMN IF NOT EXISTS safetag_device_id TEXT,
  ADD COLUMN IF NOT EXISTS safetag_event_id TEXT;
```

---

## 3. Append-Only Incident Timeline

The `incident_timeline` is an append-only JSONB array where every significant event is stamped with:
- `event_id`: Unique UUID
- `event_type`: Categorical event code (`EMERGENCY_ACTIVATED`, `FACTS_UPDATED`, `THREAT_ESCALATED`, `POLICE_ACKNOWLEDGED`, `RESOLVED`, `CANCELLED`)
- `description`: Plain-text factual summary
- `actor`: Entity initiating the event (`CITIZEN`, `OFFICER_[STATION]`, `SYSTEM`, `SAFETAG`)
- `source`: Trigger channel provenance
- `timestamp`: ISO-8601 UTC timestamp
- `metadata`: Contextual key-value payload

### Append Event RPC (`append_incident_event`)
```sql
CREATE OR REPLACE FUNCTION append_incident_event(
  p_sos_id UUID,
  p_event_type TEXT,
  p_description TEXT,
  p_actor TEXT DEFAULT 'CITIZEN',
  p_source TEXT DEFAULT 'WEB_QUICKSHIELD',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
...
$$;
```

---

## 4. Structured Facts Aggregation

Facts gathered via the **Adaptive Emergency Interview**, telemetry, or hardware are stored in `incident_facts`:

```json
{
  "weapons": "knife",
  "suspectsCount": 2,
  "safeShelter": false,
  "victimStatus": "UNINJURED",
  "provenance": {
    "source": "ADAPTIVE_INTERVIEW",
    "user_confirmed": true,
    "confidence": 1.0,
    "timestamp": "2026-09-19T07:15:00.000Z",
    "location": { "lat": 13.0012, "lng": 80.2565, "accuracy": 8 }
  }
}
```

Updating facts triggers `update_incident_facts` which merges new keys into the JSONB object and simultaneously appends a `FACTS_UPDATED` event to the timeline.

---

## 5. Non-Downgrading Threat State Machine

To prevent catastrophic misunderstandings where an officer or algorithm prematurely de-escalates an active hostage or armed threat situation, CIE enforces strict anti-downgrade logic:

1. Threat progression levels:
   `UNKNOWN` $\to$ `SUSPICIOUS_ACTIVITY` $\to$ `ACTIVE_THREAT` $\to$ `CRITICAL_THREAT`
2. **Citizen inputs can escalate threats at any time.**
3. De-escalation to `ACKNOWLEDGED` or `RESOLVED` requires authenticated police command action via `acknowledge_sos_secure` or `resolve_sos_secure`.
4. Threat levels are never downgraded by automated timeout.

---

## 6. Realtime Police Station Synchronization

Police stations subscribe to Supabase Postgres changes for `sos_records` filtered by their `nearest_station_code`:

```javascript
const channel = supabase
  .channel('police-sos-realtime')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'sos_records' },
    (payload) => {
      // Updates command center alert cards and timeline live
    }
  )
  .subscribe();
```
When an officer claims an alert, `acknowledge_sos_secure` updates `threat_level = 'ACKNOWLEDGED'` and appends a `POLICE_ACKNOWLEDGED` event to the timeline. The citizen device immediately receives this update via WebSocket, triggering the downstream 2-pulse haptic confirmation.
