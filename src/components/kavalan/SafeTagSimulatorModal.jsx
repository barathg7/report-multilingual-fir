// src/components/kavalan/SafeTagSimulatorModal.jsx
// Interactive ESP32 BLE Hardware Simulator for REPORT Universal Emergency System

import React, { useState, useEffect, useRef } from "react";
import {
  Battery,
  ShieldAlert,
  Activity,
  X,
  Zap,
  RotateCcw,
  Cpu,
} from "lucide-react";
import { SafeTagSimulator } from "../../lib/safeTag/safeTagSimulator";

export default function SafeTagSimulatorModal({ isOpen = false, onClose }) {
  const [simulatorState, setSimulatorState] = useState({
    deviceId: "SIM-SAFETAG-ESP32",
    batteryLevel: 94,
    sequenceNumber: 0,
    activeIncident: null,
    policeAckReceived: false,
    isVibrating: false,
    lastVibrationMessage: "",
  });

  const [lastPacket, setLastPacket] = useState(null);
  const [transmissionStatus, setTransmissionStatus] = useState("IDLE");
  const [simLog, setSimLog] = useState([]);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef(null);
  const simulatorRef = useRef(null);

  useEffect(() => {
    if (isOpen && !simulatorRef.current) {
      simulatorRef.current = new SafeTagSimulator({
        deviceId: "SIM-SAFETAG-ESP32",
        batteryLevel: 94,
        onStateChange: (state) => {
          setSimulatorState({ ...state });
        },
        onVibrationSimulated: (vib) => {
          setSimLog((prev) => [
            `[ACK-DOWNLINK] ${new Date().toLocaleTimeString()}: ${vib.message}`,
            ...prev.slice(0, 15),
          ]);
        },
      });
    }

    return () => {
      if (!isOpen && simulatorRef.current) {
        simulatorRef.current.destroy();
        simulatorRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLongPressStart = () => {
    setIsHolding(true);
    setHoldProgress(0);
    const startTime = Date.now();
    const duration = 1500; // Simulated hold duration

    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, Math.round((elapsed / duration) * 100));
      setHoldProgress(progress);

      if (elapsed >= duration) {
        clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setIsHolding(false);
        setHoldProgress(0);
        triggerAction("LONG_PRESS");
      }
    }, 50);
  };

  const handleLongPressEnd = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  const triggerAction = async (type) => {
    if (!simulatorRef.current) return;
    const res = await simulatorRef.current.triggerInput(type);
    if (res.success) {
      setLastPacket(res.packet);
      setTransmissionStatus(
        res.cancelled ? "SIMULATED_CANCEL_SUCCESS" : "SIMULATED_DISPATCH_SUCCESS"
      );
      const logEntry = `[TX-UPLINK] ${new Date().toLocaleTimeString()}: Event ${
        res.packet?.event_type || type
      } emitted (Seq: ${res.packet?.sequence_number || 1})`;
      setSimLog((prev) => [logEntry, ...prev.slice(0, 15)]);
    } else {
      setTransmissionStatus(`REJECTED: ${res.status || res.error}`);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="REPORT SafeTag Hardware Simulator"
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl">
        {/* Banner: Unmistakable Hardware Simulator Label */}
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-5 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-black tracking-wider uppercase text-amber-400">
              <Cpu className="w-4 h-4" />
              <span>SAFE TAG SIMULATOR</span>
            </div>
            <div className="text-[10px] font-mono font-bold tracking-wide uppercase text-amber-300/80">
              DEMO HARDWARE — NO PHYSICAL DEVICE CONNECTED
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SafeTag Simulator"
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Device Mock Representation */}
          <div className="relative p-5 rounded-2xl border border-slate-700/60 bg-gradient-to-b from-slate-800/80 to-slate-900/90 shadow-inner flex flex-col items-center text-center">
            {/* LED Status & Telemetry Header */}
            <div className="w-full flex items-center justify-between text-xs font-mono text-slate-400 mb-3">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    simulatorState.activeIncident
                      ? "bg-red-500 animate-ping shadow-[0_0_8px_#ef4444]"
                      : "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  }`}
                />
                <span>ESP32-GATT: SIMULATOR CONNECTED</span>
              </span>

              <span className="flex items-center gap-1 text-slate-300">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span>{simulatorState.batteryLevel}%</span>
              </span>
            </div>

            {/* Simulated SafeTag Hardware Button */}
            <div className="my-2">
              <button
                type="button"
                onMouseDown={handleLongPressStart}
                onMouseUp={handleLongPressEnd}
                onTouchStart={handleLongPressStart}
                onTouchEnd={handleLongPressEnd}
                className={`relative w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center gap-1 font-black text-xs uppercase tracking-wider transition-all shadow-xl active:scale-95 select-none cursor-pointer ${
                  isHolding
                    ? "border-amber-400 bg-amber-600/30 text-amber-200 scale-95"
                    : simulatorState.activeIncident
                    ? "border-red-500 bg-red-600/20 text-red-300 animate-pulse"
                    : "border-slate-600 hover:border-red-500 bg-slate-800 hover:bg-slate-700/80 text-slate-200"
                }`}
              >
                <ShieldAlert className="w-8 h-8 text-red-400" />
                <span className="text-[10px]">PRESS & HOLD</span>
                <span className="text-[9px] text-slate-400 font-normal">GENERAL SOS</span>

                {isHolding && (
                  <div
                    className="absolute inset-0 rounded-full border-4 border-amber-400"
                    style={{
                      clipPath: `polygon(50% 50%, -50% -50%, ${holdProgress * 2}% -50%, ${holdProgress * 2}% 150%)`,
                    }}
                  />
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mt-1">
              Hold center dome or use dedicated trigger buttons below:
            </p>

            {/* Downlink Police Vibration Acknowledgment */}
            {simulatorState.isVibrating && (
              <div className="w-full mt-3 p-3 rounded-xl bg-blue-950/90 border border-blue-500/60 text-blue-200 flex flex-col items-center justify-center gap-1 animate-bounce text-center">
                <div className="flex items-center gap-2 text-xs font-bold font-mono">
                  <Zap className="w-4 h-4 text-blue-400" />
                  <span>2× vibration acknowledgement simulated</span>
                </div>
                <span className="text-[10px] text-blue-300/80 font-sans">
                  Simulated software alert — no physical hardware motor connected
                </span>
              </div>
            )}
          </div>

          {/* 4 Explicit Buttons: GENERAL SOS, PHYSICAL THREAT, MEDICAL EMERGENCY, CANCEL */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              id="safetag-btn-general-sos"
              onClick={() => triggerAction("LONG_PRESS")}
              className="p-3 rounded-xl bg-red-950/70 hover:bg-red-900/90 border border-red-500/50 text-red-200 text-left space-y-1 transition-all active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>GENERAL SOS</span>
              </div>
              <p className="text-[10px] text-red-300/80">Simulated 3s hold trigger</p>
            </button>

            <button
              type="button"
              id="safetag-btn-physical-threat"
              onClick={() => triggerAction("DOUBLE_PRESS")}
              className="p-3 rounded-xl bg-red-900/40 hover:bg-red-900/60 border border-red-500/40 text-red-200 text-left space-y-1 transition-all active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>PHYSICAL THREAT</span>
              </div>
              <p className="text-[10px] text-red-300/80">Simulated double-click</p>
            </button>

            <button
              type="button"
              id="safetag-btn-medical"
              onClick={() => triggerAction("SECONDARY")}
              className="p-3 rounded-xl bg-sky-900/40 hover:bg-sky-900/60 border border-sky-500/40 text-sky-200 text-left space-y-1 transition-all active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>MEDICAL EMERGENCY</span>
              </div>
              <p className="text-[10px] text-sky-300/80">Simulated secondary button</p>
            </button>

            <button
              type="button"
              id="safetag-btn-cancel"
              onClick={() => triggerAction("CANCEL")}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700/90 border border-slate-600 text-slate-300 text-left space-y-1 transition-all active:scale-98 cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>CANCEL</span>
              </div>
              <p className="text-[10px] text-slate-400">Accidental trigger protection</p>
            </button>
          </div>

          {/* After Trigger: Event Inspector */}
          {lastPacket && (
            <div
              id="safetag-trigger-inspector"
              className="p-3.5 rounded-xl bg-slate-950 border border-slate-700/80 space-y-2 text-xs font-mono"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Event Telemetry Inspector
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  {transmissionStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">Event ID</span>
                  <span className="text-slate-200 select-all font-mono break-all">{lastPacket.event_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">Event Type</span>
                  <span className="text-amber-300 font-bold">{lastPacket.event_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">Timestamp</span>
                  <span className="text-slate-300">{lastPacket.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">Sequence Number</span>
                  <span className="text-emerald-400 font-bold">#{lastPacket.sequence_number}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">Device ID</span>
                  <span className="text-slate-300">{lastPacket.device_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[9px] uppercase font-semibold">Transmission Status</span>
                  <span className="text-emerald-400 font-bold">{transmissionStatus}</span>
                </div>
              </div>
            </div>
          )}

          {/* BLE Packet Telemetry Terminal */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-400">
              BLE Telemetry Log (Simulated GATT Uplink / Downlink)
            </span>
            <div className="p-3 rounded-xl bg-black/70 border border-slate-800 font-mono text-[10px] text-emerald-400 h-20 overflow-y-auto space-y-1 select-all">
              {simLog.length === 0 ? (
                <span className="text-slate-600">// Ready. Press button to transmit simulated BLE packet.</span>
              ) : (
                simLog.map((log, idx) => <div key={idx}>{log}</div>)
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Phone acts as BLE gateway & supplies GPS</span>
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-blue-400 hover:text-blue-300"
          >
            Close Simulator
          </button>
        </div>
      </div>
    </div>
  );
}
