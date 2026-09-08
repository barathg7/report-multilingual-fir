// src/hooks/useFIRStore.js — Canonical FIR Store for REPORT v2
import { useState, useEffect, useCallback } from "react";
import { loadFromStorage, saveToStorage } from "@/utils";
import { supabase, checkDuplicateFIR } from "@/lib/supabaseClient";
import { normalizeFIR, toSupabaseRow, validateFIR, FIR_STATUSES } from "@/lib/firSchema";

const STORE_KEY = "report_firs";

export function useFIRStore() {
  const [firs, setFirs] = useState(() => {
    const rawList = loadFromStorage(STORE_KEY, []);
    return Array.isArray(rawList) ? rawList.map(f => normalizeFIR(f)) : [];
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync a single FIR to Supabase
  const pushFIRToRemote = async (fir) => {
    if (!navigator.onLine) return { success: false, reason: "offline" };
    try {
      const row = toSupabaseRow(fir);
      const { error } = await supabase.from("firs").upsert(row, { onConflict: "id" });
      if (error) {
        console.warn("Supabase upsert warning:", error.message);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err) {
      console.warn("Remote sync failed:", err.message);
      return { success: false, error: err.message };
    }
  };

  // Sync all locally pending FIRs
  const syncPending = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);

    try {
      const stored = loadFromStorage(STORE_KEY, []);
      let hasUpdates = false;

      const updatedList = await Promise.all(
        stored.map(async (raw) => {
          const fir = normalizeFIR(raw);
          if (fir.status !== FIR_STATUSES.DRAFT && raw._syncStatus === "pending") {
            const res = await pushFIRToRemote(fir);
            if (res.success) {
              hasUpdates = true;
              return { ...fir, _syncStatus: "synced", _syncedAt: new Date().toISOString() };
            }
          }
          return fir;
        })
      );

      if (hasUpdates) {
        saveToStorage(STORE_KEY, updatedList);
        setFirs(updatedList.map(f => normalizeFIR(f)));
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPending();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPending]);

  const saveFIR = useCallback(async (data) => {
    const canonical = normalizeFIR(data);
    let syncStatus = "pending";

    // Attempt remote save if submitted and online
    if (canonical.status !== FIR_STATUSES.DRAFT && navigator.onLine) {
      const res = await pushFIRToRemote(canonical);
      if (res.success) {
        syncStatus = "synced";
      }
    }

    const recordToSave = {
      ...canonical,
      _syncStatus: syncStatus,
      _savedAt: new Date().toISOString(),
    };

    setFirs((prev) => {
      const idx = prev.findIndex((f) => f.id === canonical.id);
      const updated = idx >= 0 ? prev.map((f, i) => (i === idx ? recordToSave : f)) : [recordToSave, ...prev];
      saveToStorage(STORE_KEY, updated);
      return updated.map(f => normalizeFIR(f));
    });

    return canonical;
  }, []);

  // Check duplicate by phone + incident_date
  const checkDuplicate = useCallback(async (phone, incidentDate) => {
    if (!phone || !incidentDate) return { isDuplicate: false };

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    const local = firs.find(f => {
      const fPhone = (f.complainant?.phone || f.complainantPhone || "").replace(/\D/g, "").slice(-10);
      const fDate = f.incident?.date || f.incidentDate;
      return (
        fPhone === cleanPhone &&
        fDate === incidentDate &&
        f.status !== FIR_STATUSES.FAKE_FIR &&
        f.status !== FIR_STATUSES.DRAFT
      );
    });

    if (local) return { isDuplicate: true, existingId: local.id };

    try {
      const isRemoteDuplicate = await checkDuplicateFIR(phone, incidentDate);
      return { isDuplicate: Boolean(isRemoteDuplicate) };
    } catch {
      return { isDuplicate: false };
    }
  }, [firs]);

  const deleteFIR = useCallback((id) => {
    setFirs((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveToStorage(STORE_KEY, updated);
      return updated;
    });
  }, []);

  return {
    firs,
    saveFIR,
    deleteFIR,
    isOnline,
    isSyncing,
    syncPending,
    validateFIR,
    pendingCount: firs.filter((f) => f.status === FIR_STATUSES.DRAFT || f._syncStatus === "pending").length,
    checkDuplicate,
  };
}