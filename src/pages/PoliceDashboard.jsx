// src/pages/PoliceDashboard.jsx — Official Station Police Command Center & Case Management Workspace
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Loader2, FileText, MapPin, AlertCircle } from "lucide-react";
import {
  supabase,
  updateFIRStatusSecure,
  getFIRsForStation,
  verifyLegalSectionSecure,
} from "@/lib/supabaseClient";
import { getAuthenticatedStation, clearPoliceSession } from "@/lib/policeAuth";
import { generateAndDownloadFIRDocx } from "@/lib/firDocxGenerator";
import { normalizeFIR, calculateCompleteness, toSupabaseRow } from "@/lib/firSchema";
import { loadFromStorage, saveToStorage } from "@/utils";

// Command Center Modular Components
import PoliceHeader from "@/components/police/PoliceHeader";
import PoliceStatsRow from "@/components/police/PoliceStatsRow";
import PoliceFilterBar from "@/components/police/PoliceFilterBar";
import CaseCard from "@/components/police/CaseCard";
import CaseReviewModal from "@/components/police/CaseReviewModal";
import FakeFIRModal from "@/components/police/FakeFIRModal";

export default function PoliceDashboard() {
  const navigate = useNavigate();
  const [station, setStation] = useState(null);
  const [firs, setFirs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedFIR, setSelectedFIR] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [fakeFIRTarget, setFakeFIRTarget] = useState(null);
  const [fakeConfirming, setFakeConfirming] = useState(false);

  // Unified FIR fetch: pulls station-scoped records from Supabase and local store
  const fetchStationFIRs = useCallback(async (s) => {
    setLoading(true);
    try {
      const stationCode = (s.code || s.station_code || "").trim().toUpperCase();

      // 1. Fetch remote Supabase FIRs isolated to this station jurisdiction
      let remoteFIRs = [];
      try {
        remoteFIRs = await getFIRsForStation(stationCode);
      } catch (e) {
        console.warn("Remote FIR query unavailable, using local store:", e.message);
      }

      // 2. Fetch local storage FIRs matching this station
      const localStored = loadFromStorage("report_firs", []);
      const stationLocal = Array.isArray(localStored)
        ? localStored
            .map(toSupabaseRow)
            .filter((f) => (f.station_code || "").trim().toUpperCase() === stationCode)
        : [];

      // Combine both sources, deduplicating by ID
      const map = new Map();
      remoteFIRs.forEach((f) => map.set(f.id, f));
      stationLocal.forEach((f) => {
        if (!map.has(f.id)) map.set(f.id, f);
      });

      setFirs(Array.from(map.values()));
    } catch (err) {
      console.error("FIR fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadStationAuth() {
      const s = await getAuthenticatedStation();
      if (!s) {
        navigate("/police-login");
        return;
      }
      if (active) {
        setStation(s);
        fetchStationFIRs(s);
      }
    }
    loadStationAuth();

    // Real-time Supabase subscriptions
    const channel = supabase
      .channel("police-firs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "firs",
        },
        () => {
          getAuthenticatedStation().then((s) => {
            if (s && active) fetchStationFIRs(s);
          });
        }
      )
      .subscribe();

    // ── Reactive auth state listener ──────────────────────────────────────────
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && active) {
        navigate("/police-login", { replace: true });
      }
    });

    return () => {
      active = false;
      supabase.removeChannel(channel);
      authListener.unsubscribe();
    };
  }, [navigate, fetchStationFIRs]);

  // Secure status transition handler
  const handleUpdateStatus = async (firId, newStatus) => {
    if (newStatus === "fake_fir") {
      const target = firs.find((f) => f.id === firId);
      if (target) setFakeFIRTarget(target);
      return;
    }

    try {
      // Execute secure status transition via RPC
      await updateFIRStatusSecure(
        firId,
        newStatus,
        "Status updated by investigating officer",
        station?.officerBadge || "OFFICER"
      );

      // Update local storage
      const local = loadFromStorage("report_firs", []);
      const updated = local.map((f) => (f.id === firId ? { ...f, status: newStatus } : f));
      saveToStorage("report_firs", updated);

      // Update React state
      setFirs((prev) => prev.map((f) => (f.id === firId ? { ...f, status: newStatus } : f)));
      if (selectedFIR?.id === firId) {
        setSelectedFIR((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      console.error("Status update error:", e);
      alert("Failed to update status: " + e.message);
    }
  };

  // Statutory Fake FIR confirmation
  const confirmFakeFIR = async () => {
    if (!fakeFIRTarget) return;
    setFakeConfirming(true);
    try {
      await updateFIRStatusSecure(
        fakeFIRTarget.id,
        "fake_fir",
        "Statutory prosecution initiated under BNSS for malicious/fabricated complaint.",
        station?.officerBadge || "OFFICER"
      );

      const local = loadFromStorage("report_firs", []);
      const updated = local.map((f) =>
        f.id === fakeFIRTarget.id ? { ...f, status: "fake_fir" } : f
      );
      saveToStorage("report_firs", updated);

      setFirs((prev) =>
        prev.map((f) => (f.id === fakeFIRTarget.id ? { ...f, status: "fake_fir" } : f))
      );
      if (selectedFIR?.id === fakeFIRTarget.id) {
        setSelectedFIR((prev) => ({ ...prev, status: "fake_fir" }));
      }
      setFakeFIRTarget(null);
    } catch (e) {
      alert("Failed to flag fake FIR: " + e.message);
    } finally {
      setFakeConfirming(false);
    }
  };

  // Official Legal Section Verification Handler
  const handleVerifySection = async (firId, section, act = "BNS 2023") => {
    try {
      await verifyLegalSectionSecure(firId, section, act);
    } catch (e) {
      console.warn("Remote legal section verification notice:", e.message);
    }

    // Update local state and cache
    const newEntry = {
      section,
      act,
      verifiedByOfficerBadge: station?.officerBadge || "OFFICER",
      verifiedAt: new Date().toISOString(),
    };

    const local = loadFromStorage("report_firs", []);
    const updated = local.map((f) => {
      if (f.id === firId) {
        const existing = Array.isArray(f.verified_sections) ? f.verified_sections : [];
        return { ...f, verified_sections: [...existing, newEntry] };
      }
      return f;
    });
    saveToStorage("report_firs", updated);

    setFirs((prev) =>
      prev.map((f) => {
        if (f.id === firId) {
          const existing = Array.isArray(f.verified_sections) ? f.verified_sections : [];
          return { ...f, verified_sections: [...existing, newEntry] };
        }
        return f;
      })
    );

    if (selectedFIR?.id === firId) {
      setSelectedFIR((prev) => {
        const existing = Array.isArray(prev.verified_sections) ? prev.verified_sections : [];
        return { ...prev, verified_sections: [...existing, newEntry] };
      });
    }
  };

  // Official FIR DOCX Download
  const handleDownload = async (fir) => {
    setDownloadingId(fir.id);
    try {
      await generateAndDownloadFIRDocx(fir, station);
    } catch (e) {
      console.error("Document download failed:", e);
      alert("Could not generate official FIR document: " + e.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Metrics counts
  const counts = useMemo(
    () => ({
      total: firs.length,
      submitted: firs.filter((f) => f.status === "submitted").length,
      investigating: firs.filter((f) => f.status === "investigating").length,
      resolved: firs.filter((f) => f.status === "resolved").length,
      closed: firs.filter((f) => f.status === "closed").length,
      fake: firs.filter((f) => f.status === "fake_fir").length,
    }),
    [firs]
  );

  // Search & Filtered Ledger List
  const displayed = useMemo(() => {
    let result = firs.filter((f) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        [
          f.complainant_name,
          f.complainantName,
          f.crime_type,
          f.crimeType,
          f.incident_location,
          f.incidentLocation,
          f.location_city,
          f.locationCity,
          f.id,
          f.official_fir_no,
          f.officialFIRNo,
          f.submission_id,
          f.submissionId,
          f.complainant_phone,
          f.complainantPhone,
        ].some((v) => v && String(v).toLowerCase().includes(q));

      return matchSearch && (filterStatus === "all" || f.status === filterStatus);
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "completeness") {
        const cA = calculateCompleteness(normalizeFIR(a));
        const cB = calculateCompleteness(normalizeFIR(b));
        return cB - cA;
      }
      const timeA = new Date(a.created_at || a.metadata?.createdAt || 0).getTime();
      const timeB = new Date(b.created_at || b.metadata?.createdAt || 0).getTime();
      return sortBy === "oldest" ? timeA - timeB : timeB - timeA;
    });

    return result;
  }, [firs, search, filterStatus, sortBy]);

  // Loading station session state
  if (!station) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 shadow-xl">
            <Shield className="h-6 w-6 text-blue-400" />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
            <span className="font-medium">Authorizing station command terminal...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">

      {/* Fake FIR Statutory Modal */}
      {fakeFIRTarget && (
        <FakeFIRModal
          fir={fakeFIRTarget}
          onClose={() => setFakeFIRTarget(null)}
          onConfirm={confirmFakeFIR}
          loading={fakeConfirming}
        />
      )}

      {/* 3-Pane Case Review Modal Workspace */}
      {selectedFIR && (
        <CaseReviewModal
          fir={selectedFIR}
          station={station}
          onClose={() => setSelectedFIR(null)}
          onUpdateStatus={handleUpdateStatus}
          onVerifySection={handleVerifySection}
          onDownload={handleDownload}
          downloading={downloadingId === selectedFIR.id}
        />
      )}

      {/* Command Center Header */}
      <PoliceHeader
        station={station}
        loading={loading}
        onRefresh={() => fetchStationFIRs(station)}
        onNavigateAnalytics={() => navigate("/analytics")}
        onLogout={async () => {
          await clearPoliceSession();
          navigate("/police-login", { replace: true });
        }}
      />

      {/* Main Command Center Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Metric Summary Tiles */}
        <PoliceStatsRow
          counts={counts}
          activeFilter={filterStatus}
          onSelectFilter={(st) => setFilterStatus(st)}
        />

        {/* Station Jurisdictional Banner */}
        <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs text-xs">
          <div className="flex items-center gap-2 text-slate-800">
            <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Jurisdictional isolation active: Complaints exclusively assigned to{" "}
              <strong>{station.name}</strong> ({station.code}).
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            Click any case card to open the 3-Pane Investigation Workspace
          </span>
        </div>

        {/* Search, Filter Tabs & Sort Controls */}
        <PoliceFilterBar
          search={search}
          onSearchChange={setSearch}
          filterStatus={filterStatus}
          onFilterChange={setFilterStatus}
          counts={counts}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* FIR Complaints Ledger List */}
        {loading ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
            <p className="text-slate-800 font-bold text-sm">
              Synchronizing jurisdictional complaints ledger…
            </p>
            <p className="text-xs text-slate-400 mt-1">Connecting to state police database</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-300/80 p-6 space-y-2 shadow-2xs">
            <FileText className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="font-extrabold text-slate-800 text-sm">No FIR complaints found</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {firs.length === 0
                ? `No citizen complaints have been registered under ${station.code} yet.`
                : "No complaints match your active search terms or status filter. Try clearing your filters."}
            </p>
            {filterStatus !== "all" && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("all");
                  setSearch("");
                }}
                className="mt-2 inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((fir) => (
              <CaseCard
                key={fir.id}
                fir={fir}
                station={station}
                onSelect={setSelectedFIR}
                onDownload={handleDownload}
                downloading={downloadingId === fir.id}
              />
            ))}
          </div>
        )}

      </main>
    </div>
  );
}