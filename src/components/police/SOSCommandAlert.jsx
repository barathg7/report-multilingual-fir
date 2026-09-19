// src/components/police/SOSCommandAlert.jsx
// Stage 6.3 / Phase 13: High-Priority Realtime Crisis Intelligence & SOS Command Alert for Police Dashboard

import React, { useState } from "react";
import {
  AlertTriangle,
  MapPin,
  ExternalLink,
  Check,
  ShieldAlert,
  Radio,
  Clock,
  Crosshair,
  User,
  Users,
  Shield,
  ChevronDown,
  ChevronUp,
  Cpu,
  Flame,
  HeartPulse,
  Lock,
  Volume2,
  FileText
} from "lucide-react";

export default function SOSCommandAlert({
  alerts = [],
  station,
  onAcknowledge,
  onResolve,
  loadingId,
}) {
  const [expandedTimelines, setExpandedTimelines] = useState({});

  if (!alerts || alerts.length === 0) return null;

  const currentStationCode = (station?.code || station?.station_code || "").trim().toUpperCase();

  // Strict Jurisdictional Isolation: Ensure only alerts for this station are displayed
  const authorizedAlerts = alerts.filter(
    (a) => (a.nearest_station_code || "").trim().toUpperCase() === currentStationCode
  );

  if (authorizedAlerts.length === 0) return null;

  const toggleTimeline = (id) => {
    setExpandedTimelines((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPriorityStyle = (priority) => {
    switch ((priority || "").toUpperCase()) {
      case "CRITICAL":
        return "bg-red-700 text-white border-red-800 animate-pulse";
      case "HIGH":
        return "bg-amber-600 text-white border-amber-700";
      case "MEDIUM":
        return "bg-blue-600 text-white border-blue-700";
      case "LOW":
        return "bg-slate-600 text-white border-slate-700";
      default:
        return "bg-red-600 text-white border-red-700";
    }
  };

  const getThreatStyle = (threat) => {
    switch ((threat || "").toUpperCase()) {
      case "CRITICAL_THREAT":
      case "ACTIVE_THREAT":
      case "WEAPONS_INVOLVED":
      case "HOSTAGE_SITUATION":
        return "text-red-700 bg-red-100 border-red-300";
      case "SUSPICIOUS_ACTIVITY":
      case "SUSPECT_ON_SCENE":
      case "IMMINENT_DANGER":
        return "text-amber-800 bg-amber-100 border-amber-300";
      case "CONTAINED":
      case "ACKNOWLEDGED":
        return "text-blue-800 bg-blue-100 border-blue-300";
      case "RESOLVED":
        return "text-emerald-800 bg-emerald-100 border-emerald-300";
      default:
        return "text-slate-700 bg-slate-100 border-slate-300";
    }
  };

  const getTypeIcon = (type) => {
    const t = (type || "").toUpperCase();
    if (t.includes("ATTACK") || t.includes("ASSAULT")) return <Crosshair className="w-3.5 h-3.5 text-red-600" />;
    if (t.includes("HOSTAGE") || t.includes("INTRUSION")) return <Lock className="w-3.5 h-3.5 text-purple-600" />;
    if (t.includes("MEDICAL")) return <HeartPulse className="w-3.5 h-3.5 text-rose-600" />;
    if (t.includes("FIRE")) return <Flame className="w-3.5 h-3.5 text-orange-600" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
  };

  return (
    <section
      id="police-sos-command-alerts"
      aria-label="Active Citizen Crisis & SOS Alerts"
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600" />
          </span>
          <h2 className="text-xs font-black tracking-wider uppercase text-red-600 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            CRISIS INTELLIGENCE & CITIZEN SOS DISPATCH ({authorizedAlerts.length})
          </h2>
        </div>
        <span className="text-[11px] font-mono font-bold text-slate-500">
          STATION: {currentStationCode}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {authorizedAlerts.map((alert) => {
          const isPending = alert.status === "active";
          const isAck = alert.status === "acknowledged";
          const isLoading = loadingId === alert.id;
          const isTimelineOpen = !!expandedTimelines[alert.id];

          const facts = alert.incident_facts || {};
          const timeline = Array.isArray(alert.incident_timeline) ? alert.incident_timeline : [];

          const timeFormatted = alert.created_at
            ? new Date(alert.created_at).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Just now";

          return (
            <article
              key={alert.id}
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-md transition-all ${
                isPending
                  ? "border-red-500/80 bg-red-50/90 text-red-950 shadow-red-500/10"
                  : "border-blue-500/60 bg-blue-50/90 text-blue-950"
              }`}
            >
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isPending
                        ? "bg-red-600 text-white animate-pulse"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    {isAck ? "CLAIMED / IN PROGRESS" : alert.status}
                  </span>

                  {alert.priority && (
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${getPriorityStyle(
                        alert.priority
                      )}`}
                    >
                      PRIORITY: {alert.priority}
                    </span>
                  )}

                  {alert.threat_level && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${getThreatStyle(
                        alert.threat_level
                      )}`}
                    >
                      {alert.threat_level.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-600">
                    🕒 {timeFormatted}
                  </span>
                  <a
                    href={alert.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    <span>Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Emergency Category & Source */}
              <div className="bg-white/80 border border-slate-200/80 rounded-xl p-2.5 mb-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900">
                    {getTypeIcon(alert.emergency_type)}
                    <span>{alert.emergency_type || "CITIZEN_SOS"}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {alert.source && (
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-300">
                        SRC: {alert.source}
                      </span>
                    )}
                    {alert.safetag_device_id && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded border border-indigo-300">
                        <Cpu className="w-3 h-3" />
                        SafeTag: {alert.safetag_device_id}
                      </span>
                    )}
                  </div>
                </div>

                {/* Structured Incident Facts */}
                {(facts.weapons || facts.suspectsCount !== undefined || facts.safeShelter !== undefined || alert.victim_status) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-200/70 text-[11px]">
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Weapons</span>
                      <strong className="text-slate-800 capitalize font-medium">{facts.weapons || "None reported"}</strong>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Suspects</span>
                      <strong className="text-slate-800 font-medium">{facts.suspectsCount ?? "Unknown"}</strong>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Safe Shelter</span>
                      <strong className="text-slate-800 capitalize font-medium">
                        {facts.safeShelter === true ? "Yes" : facts.safeShelter === false ? "No" : "Unknown"}
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200">
                      <span className="block text-[9px] text-slate-500 font-semibold uppercase">Victim Status</span>
                      <strong className="text-slate-800 capitalize font-medium">{alert.victim_status || facts.victimStatus || "Pending"}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Location & Accuracy */}
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>
                    GPS:{" "}
                    <strong className="font-mono">
                      {Number(alert.latitude).toFixed(5)}, {Number(alert.longitude).toFixed(5)}
                    </strong>
                    {alert.accuracy != null && (
                      <span className="text-slate-600 font-normal">
                        {" "}
                        (±{Math.round(alert.accuracy)}m)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1 border-t border-slate-200/80">
                  <span>Assigned Jurisdiction:</span>
                  <span className="font-semibold text-slate-800">
                    {alert.nearest_station_name} ({alert.nearest_station_code})
                  </span>
                </div>
              </div>

              {/* Incident Timeline Collapsible */}
              {timeline.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => toggleTimeline(alert.id)}
                    className="flex items-center justify-between w-full text-left text-[11px] font-bold text-slate-700 hover:text-slate-900 py-1"
                  >
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Incident Timeline ({timeline.length} events)
                    </span>
                    {isTimelineOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isTimelineOpen && (
                    <div className="mt-1.5 space-y-1.5 max-h-36 overflow-y-auto pr-1 bg-white/70 p-2 rounded-lg border border-slate-200 text-[10px]">
                      {timeline.map((evt, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 pb-1 border-b border-slate-100 last:border-0 last:pb-0">
                          <span className="font-mono text-slate-400 shrink-0">
                            {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : `#${idx + 1}`}
                          </span>
                          <div className="flex-1">
                            <span className="font-bold text-slate-800 mr-1">{evt.event_type || evt.type || "EVENT"}:</span>
                            <span className="text-slate-600">{evt.description || JSON.stringify(evt.payload || {})}</span>
                            {evt.actor && <span className="ml-1 text-slate-400 font-mono">[{evt.actor}]</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-200/80">
                {isPending && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => onAcknowledge?.(alert.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Claim & Acknowledge</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => onResolve?.(alert.id)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50 ${
                    isPending
                      ? "bg-slate-800 hover:bg-slate-900 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Resolve Incident</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
