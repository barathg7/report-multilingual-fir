// src/components/police/SOSCommandAlert.jsx
// Stage 6.3: High-Priority Realtime SOS Command Alert for Police Dashboard

import React from "react";
import { AlertTriangle, MapPin, ExternalLink, Check, ShieldAlert, Radio } from "lucide-react";

export default function SOSCommandAlert({
  alerts = [],
  station,
  onAcknowledge,
  onResolve,
  loadingId,
}) {
  if (!alerts || alerts.length === 0) return null;

  const currentStationCode = (station?.code || station?.station_code || "").trim().toUpperCase();

  // Strict Jurisdictional Isolation: Ensure only alerts for this station are displayed
  const authorizedAlerts = alerts.filter(
    (a) => (a.nearest_station_code || "").trim().toUpperCase() === currentStationCode
  );

  if (authorizedAlerts.length === 0) return null;

  return (
    <section
      id="police-sos-command-alerts"
      aria-label="Active Citizen SOS Alerts"
      className="space-y-3"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
          </span>
          <h2 className="text-xs font-black tracking-wider uppercase text-red-600 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            HIGH-PRIORITY CITIZEN SOS DISPATCH ({authorizedAlerts.length})
          </h2>
        </div>
        <span className="text-[11px] font-mono font-bold text-slate-500">
          STATION: {currentStationCode}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {authorizedAlerts.map((alert) => {
          const isPending = alert.status === "active";
          const isAck = alert.status === "acknowledged";
          const isLoading = loadingId === alert.id;

          const timeFormatted = alert.created_at
            ? new Date(alert.created_at).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "Just now";

          return (
            <div
              key={alert.id}
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-md transition-all ${
                isPending
                  ? "border-red-500/80 bg-red-50/90 text-red-950 shadow-red-500/10"
                  : "border-blue-500/60 bg-blue-50/90 text-blue-950"
              }`}
            >
              {/* Status Header */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      isPending
                        ? "bg-red-600 text-white animate-pulse"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    {alert.status}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-600">
                    🕒 {timeFormatted}
                  </span>
                </div>

                <a
                  href={alert.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Location & Accuracy */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>
                    Location:{" "}
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
                  <span>Nearest Station:</span>
                  <span className="font-semibold text-slate-800">
                    {alert.nearest_station_name} ({alert.nearest_station_code})
                  </span>
                </div>
              </div>

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
                    <span>Acknowledge</span>
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
                  <span>Resolve Alert</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
