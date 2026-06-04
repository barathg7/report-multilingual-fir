/**
 * LocationCapture.jsx — MapTiler Edition (Mobile Fixed)
 *
 * FIX 1: Map CSS loaded inline via <style> tag instead of CDN link
 *         → fixes "CDN script failed to load" on mobile browsers
 * FIX 2: Nominatim search now biases toward Tamil Nadu / Chennai first
 *         → fixes "Phoenix Mall Mulshi" showing before "Phoenix Mall Velachery"
 * FIX 3: Score boost for Tamil Nadu / Chennai results
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapPin, Search, Navigation, CheckCircle,
  AlertTriangle, Satellite, Map, Layers, Info,
} from "lucide-react";
import Button from "@/components/ui/Button";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY || "";

const MAP_STYLES = {
  hybrid:    `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/satellite/style.json?key=${MAPTILER_KEY}`,
  streets:   `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
  topo:      `https://api.maptiler.com/maps/topo-v2/style.json?key=${MAPTILER_KEY}`,
};

const POI_EMOJI = {
  police: "🚔", hospital: "🏥", school: "🏫", bank: "🏦",
  fuel: "⛽", restaurant: "🍽️", bus_stop: "🚌", supermarket: "🛒",
  mall: "🏬", hotel: "🏨", attraction: "🏛️", place: "📍",
};

// ── FIX 1: Inject MapTiler CSS inline — no CDN dependency ─────────────────────
// Mobile browsers (especially on Android) often block CDN stylesheet links
// from external domains. Injecting the essential styles directly into the
// document avoids this completely.
function injectMapTilerCSS() {
  if (document.getElementById("maptiler-css-inline")) return;
  const style = document.createElement("style");
  style.id = "maptiler-css-inline";
  style.textContent = `
    .maplibregl-map,.maptilermap{position:absolute;top:0;bottom:0;width:100%}
    .maplibregl-canvas-container{position:absolute;top:0;bottom:0;width:100%}
    .maplibregl-canvas{position:absolute;top:0;bottom:0;left:0;right:0}
    .maplibregl-ctrl-group{background:#fff;border-radius:4px;box-shadow:0 0 0 2px rgba(0,0,0,.1)}
    .maplibregl-ctrl-group button{width:29px;height:29px;display:block;padding:0;outline:none;border:0;box-sizing:border-box;background-color:transparent;cursor:pointer}
    .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'%3E%3Cpath d='M14.5 8.5c-.75 0-1.5.75-1.5 1.5v3h-3c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h3v3c0 .75.75 1.5 1.5 1.5S16 19.75 16 19v-3h3c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-3v-3c0-.75-.75-1.5-1.5-1.5z'/%3E%3C/svg%3E")}
    .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'%3E%3Cpath d='M10 13c-.75 0-1.5.75-1.5 1.5S9.25 16 10 16h9c.75 0 1.5-.75 1.5-1.5S19.75 13 19 13h-9z'/%3E%3C/svg%3E")}
    .maplibregl-ctrl-compass .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 29 29'%3E%3Cpath fill='%23f44' d='M10.5 14l4-8 4 8z'/%3E%3Cpath d='M10.5 16l4 8 4-8z'/%3E%3C/svg%3E")}
    .maplibregl-ctrl-scale{background-color:rgba(255,255,255,.75);font-size:10px;border:2px solid #333;border-top:0;padding:0 5px;color:#333;box-sizing:border-box}
    .maplibregl-popup{position:absolute;top:0;left:0;display:-webkit-flex;display:flex;will-change:transform}
    .maplibregl-popup-anchor-top .maplibregl-popup-tip{border-bottom-color:#fff}
    .maplibregl-popup-content{position:relative;background:#fff;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.1);padding:10px 10px 15px;pointer-events:auto}
    .maplibregl-marker{position:absolute;top:0;left:0}
    .maplibregl-user-location-dot{background-color:#1da1f2;width:15px;height:15px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 3px rgba(0,0,0,.35)}
    .maplibregl-canvas{position:absolute;left:0;top:0}
    .maplibregl-ctrl-attrib{background-color:hsla(0,0%,100%,.5);font-size:10px}
    .maplibregl-ctrl-attrib a{color:rgba(0,0,0,.75);text-decoration:none}
  `;
  document.head.appendChild(style);
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

async function geocodeMapTiler(query) {
  if (!MAPTILER_KEY) return [];
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_KEY}&country=in&limit=5&language=en`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f) => ({
      lat: f.center[1],
      lon: f.center[0],
      display_name: f.place_name || f.text,
      shortName:    f.text,
      type:         f.place_type?.[0] || "place",
      source:       "MapTiler",
    }));
  } catch { return []; }
}

// FIX 2: Nominatim now uses Tamil Nadu bias + viewbox for South India
async function geocodeNominatim(query) {
  try {
    // Check if query already has a region mentioned
    const hasRegion = /india|tamil|kerala|karnataka|maharashtra|andhra|telangana|gujarat|rajasthan|punjab|bihar|odisha|assam|chennai|mumbai|delhi|hyderabad|bangalore|kolkata|madurai|coimbatore|trichy|vellore|velachery|anna nagar|t nagar|tambaram/i.test(query);

    // If no region mentioned, bias toward Tamil Nadu
    const q = hasRegion ? query : `${query}, Tamil Nadu, India`;

    // South India bounding box — strongly prefers results in TN/AP/KA/KE
    // This prevents "Phoenix Mall Mulshi, Maharashtra" from outranking Chennai results
    const viewbox = "76.0,8.0,82.0,14.0";  // SW corner to NE corner of South India
    const bounded = hasRegion ? "0" : "0";   // don't hard-bound, just bias

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&countrycodes=in&viewbox=${viewbox}&bounded=${bounded}`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((r) => ({ ...r, source: "OpenStreetMap" }));
  } catch { return []; }
}

async function geocodePhoton(query) {
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(`${query} Tamil Nadu India`)}&limit=4&lang=en&bbox=76.0,8.0,82.0,14.0`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features || []).map((f) => ({
      lat:          f.geometry.coordinates[1],
      lon:          f.geometry.coordinates[0],
      display_name: [f.properties.name, f.properties.district, f.properties.state, "India"].filter(Boolean).join(", "),
      shortName:    f.properties.name || query,
      type:         f.properties.type || "place",
      source:       "Photon",
    }));
  } catch { return []; }
}

async function multiSourceGeocode(query) {
  const [mt, nom, ph] = await Promise.all([
    geocodeMapTiler(query),
    geocodeNominatim(query),
    geocodePhoton(query),
  ]);
  const all = [...mt, ...nom, ...ph];
  const deduped = [];
  for (const r of all) {
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
    const dup = deduped.some(
      (d) => Math.abs(parseFloat(d.lat) - lat) < 0.005 && Math.abs(parseFloat(d.lon) - lon) < 0.005
    );
    if (!dup) deduped.push(r);
  }

  const q = query.toLowerCase().trim();
  const scored = deduped.map((r) => {
    const name = (r.shortName || r.display_name || "").toLowerCase();
    const fullName = (r.display_name || "").toLowerCase();
    let score = 0;

    // Name match scoring
    if (name === q)              score += 100;
    else if (name.startsWith(q)) score += 80;
    else if (name.includes(q))   score += 60;

    // FIX 3: Boost Tamil Nadu / South India results strongly
    // This fixes "Phoenix Mall Velachery Chennai" ranking below "Phoenix Mall Mulshi"
    if (/tamil nadu|chennai|velachery|madurai|coimbatore|trichy|salem|vellore|erode|tirunelveli/i.test(fullName))
      score += 50;
    if (/andhra|telangana|karnataka|kerala/i.test(fullName))
      score += 20;

    // Penalize results far from South India (lat roughly 8-14°N for TN)
    const lat = parseFloat(r.lat);
    if (!isNaN(lat)) {
      if (lat >= 8 && lat <= 14)  score += 30;   // Tamil Nadu latitude range
      else if (lat >= 8 && lat <= 20) score += 10; // South India range
      else score -= 20;  // Penalize North/West India results
    }

    if (r.source === "MapTiler") score += 10;
    if (/india/i.test(fullName))  score += 5;

    return { ...r, _score: score };
  });

  scored.sort((a, b) => b._score - a._score);
  return scored.slice(0, 8);
}

// ── Reverse Geocoding ─────────────────────────────────────────────────────────

async function reverseGeocodeMapTiler(lat, lng) {
  if (!MAPTILER_KEY) return null;
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}&language=en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const f = data.features?.[0];
    if (!f) return null;
    const ctx = {};
    (f.context || []).forEach((c) => {
      if (c.id?.startsWith("country"))  ctx.country  = c.text;
      if (c.id?.startsWith("region"))   ctx.state    = c.text;
      if (c.id?.startsWith("district")) ctx.district = c.text;
      if (c.id?.startsWith("place"))    ctx.city     = c.text;
      if (c.id?.startsWith("locality")) ctx.suburb   = c.text;
      if (c.id?.startsWith("postcode")) ctx.postcode = c.text;
      if (c.id?.startsWith("address"))  ctx.road     = c.text;
    });
    return {
      latitude: lat, longitude: lng,
      address:     f.place_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      name:        f.text || "",
      road:        ctx.road     || "",
      suburb:      ctx.suburb   || "",
      city:        ctx.city     || "",
      district:    ctx.district || "",
      state:       ctx.state    || "",
      postcode:    ctx.postcode || "",
      displayName: f.place_name || "",
      source:      "MapTiler",
    };
  } catch { return null; }
}

async function reverseGeocodeNominatim(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const addr = data.address || {};
    return {
      latitude: lat, longitude: lng,
      address:     data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      name:        data.name || "",
      road:        addr.road || addr.pedestrian || addr.footway || "",
      suburb:      addr.suburb || addr.neighbourhood || addr.village || "",
      district:    addr.city_district || addr.district || addr.county || "",
      city:        addr.city || addr.town || addr.village || "",
      state:       addr.state || "",
      postcode:    addr.postcode || "",
      displayName: data.display_name || "",
      source:      "OpenStreetMap",
    };
  } catch { return null; }
}

async function reverseGeocode(lat, lng) {
  const mt = await reverseGeocodeMapTiler(lat, lng);
  if (mt) return mt;
  const nom = await reverseGeocodeNominatim(lat, lng);
  if (nom) return nom;
  return {
    latitude: lat, longitude: lng,
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    source: "GPS",
  };
}

// ── Nearby POIs ───────────────────────────────────────────────────────────────

async function fetchNearbyPOIs(lat, lng) {
  try {
    const q = `[out:json][timeout:10];(
      node["amenity"~"police|hospital|school|bank|fuel|restaurant|bus_stop"](around:600,${lat},${lng});
      node["shop"~"supermarket|mall"](around:600,${lat},${lng});
      node["tourism"~"hotel|attraction"](around:600,${lat},${lng});
      node["place"~"village|hamlet|suburb"](around:1000,${lat},${lng});
    );out body;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: q });
    const data = await res.json();
    return (data.elements || [])
      .filter((e) => e.tags?.name)
      .map((e) => ({
        name:     e.tags.name,
        type:     e.tags.amenity || e.tags.shop || e.tags.tourism || e.tags.place || "place",
        lat:      e.lat,
        lng:      e.lon,
        distance: Math.round(
          Math.sqrt(
            Math.pow((e.lat - lat) * 111000, 2) +
            Math.pow((e.lon - lng) * 111000 * Math.cos((lat * Math.PI) / 180), 2)
          )
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6);
  } catch { return []; }
}

// ── MapTiler SDK loader ───────────────────────────────────────────────────────

let _sdkCache = null;

async function loadMapTilerSDK() {
  if (_sdkCache) return _sdkCache;

  // FIX 1: Use inline CSS instead of CDN link — works on all mobile browsers
  injectMapTilerCSS();

  try {
    const mod = await import("@maptiler/sdk");
    _sdkCache = mod.default || mod;
    return _sdkCache;
  } catch (err) {
    // Fallback: try loading from CDN as last resort
    throw new Error(
      "MapTiler SDK import failed. Run: npm install @maptiler/sdk — " + err.message
    );
  }
}

// ── Custom marker ─────────────────────────────────────────────────────────────

function createMarkerEl() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:40px;height:52px;cursor:grab;user-select:none;";

  const pin = document.createElement("div");
  pin.style.cssText = [
    "position:absolute", "top:0", "left:50%",
    "width:34px", "height:34px", "background:#DC2626",
    "border-radius:50% 50% 50% 0",
    "transform:translateX(-50%) rotate(-45deg)",
    "box-shadow:0 4px 12px rgba(0,0,0,0.5)",
    "border:3px solid white",
  ].join(";");

  const dot = document.createElement("div");
  dot.style.cssText = [
    "position:absolute", "top:50%", "left:50%",
    "transform:translate(-50%,-50%)",
    "width:10px", "height:10px",
    "background:white", "border-radius:50%",
  ].join(";");
  pin.appendChild(dot);

  const shadow = document.createElement("div");
  shadow.style.cssText = [
    "position:absolute", "bottom:0", "left:50%",
    "transform:translateX(-50%)",
    "width:14px", "height:6px",
    "background:rgba(0,0,0,0.25)",
    "border-radius:50%", "filter:blur(2px)",
  ].join(";");

  wrap.appendChild(pin);
  wrap.appendChild(shadow);
  return wrap;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LocationCapture({ onLocationCaptured, initialLandmarks = "" }) {
  const [mapStyle,      setMapStyle]      = useState("hybrid");
  const [searchQuery,   setSearchQuery]   = useState(initialLandmarks || "");
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [searchSources, setSearchSources] = useState("");
  const [gpsLoading,    setGpsLoading]    = useState(false);
  const [confirmed,     setConfirmed]     = useState(false);
  const [error,         setError]         = useState("");
  const [gpsError,      setGpsError]      = useState("");
  const [location,      setLocation]      = useState(null);
  const [nearbyPOIs,    setNearbyPOIs]    = useState([]);
  const [mapReady,      setMapReady]      = useState(false);
  const [mapLoading,    setMapLoading]    = useState(true);
  const [mapError,      setMapError]      = useState("");

  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markerRef       = useRef(null);
  const sdkRef          = useRef(null);
  const destroyedRef    = useRef(false);
  const initializedRef  = useRef(false);

  const cleanup = useCallback(() => {
    if (markerRef.current) { try { markerRef.current.remove(); } catch (_) {} markerRef.current = null; }
    if (mapRef.current)    { try { mapRef.current.remove();    } catch (_) {} mapRef.current    = null; }
    initializedRef.current = false;
  }, []);

  const placeMarkerAt = useCallback(async (lng, lat) => {
    if (!mapRef.current || !sdkRef.current) return;
    if (markerRef.current) { try { markerRef.current.remove(); } catch (_) {} markerRef.current = null; }

    const marker = new sdkRef.current.Marker({
      element:   createMarkerEl(),
      draggable: true,
      anchor:    "bottom",
      offset:    [0, 0],
    })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);

    marker.on("dragend", async () => {
      const pos = marker.getLngLat();
      const loc = await reverseGeocode(pos.lat, pos.lng);
      if (!destroyedRef.current && loc) {
        setLocation(loc); setConfirmed(false);
        fetchNearbyPOIs(pos.lat, pos.lng).then((p) => { if (!destroyedRef.current) setNearbyPOIs(p); });
      }
    });

    markerRef.current = marker;
    mapRef.current.flyTo({ center: [lng, lat], zoom: 17, speed: 1.4, curve: 1.2 });

    const loc = await reverseGeocode(lat, lng);
    if (!destroyedRef.current && loc) {
      setLocation(loc); setConfirmed(false);
      fetchNearbyPOIs(lat, lng).then((p) => { if (!destroyedRef.current) setNearbyPOIs(p); });
    }
  }, []);

  const initMap = useCallback(async () => {
    if (initializedRef.current || !mapContainerRef.current || !MAPTILER_KEY) return;
    initializedRef.current = true;

    try {
      const sdk = await loadMapTilerSDK();
      sdkRef.current = sdk;
      sdk.config.apiKey = MAPTILER_KEY;

      const map = new sdk.Map({
        container: mapContainerRef.current,
        style:     MAP_STYLES.hybrid,
        center:    [80.2707, 13.0827],
        zoom:      12,
        maxZoom:   20,
        minZoom:   4,
      });

      mapRef.current = map;

      map.on("load", () => {
        if (destroyedRef.current) return;
        setMapReady(true); setMapLoading(false); setMapError("");
      });

      map.on("click", async (e) => {
        await placeMarkerAt(e.lngLat.lng, e.lngLat.lat);
      });

      map.addControl(new sdk.NavigationControl(), "top-right");
      map.addControl(new sdk.ScaleControl({ unit: "metric" }), "bottom-left");

    } catch (err) {
      console.error("MapTiler init error:", err);
      if (!destroyedRef.current) {
        setMapLoading(false);
        setMapError(
          MAPTILER_KEY
            ? `Map failed to load: ${err.message}`
            : "VITE_MAPTILER_KEY is missing."
        );
      }
      initializedRef.current = false;
    }
  }, [placeMarkerAt]);

  useEffect(() => {
    destroyedRef.current = false;
    initMap();
    return () => { destroyedRef.current = true; cleanup(); };
  }, [initMap, cleanup]);

  useEffect(() => {
    if (initialLandmarks?.trim().length > 3) {
      const t = setTimeout(() => handleSearch(initialLandmarks), 1500);
      return () => clearTimeout(t);
    }
  }, [initialLandmarks]);

  const switchStyle = (key) => {
    setMapStyle(key);
    if (!mapRef.current || !mapReady) return;
    try { mapRef.current.setStyle(MAP_STYLES[key]); } catch (e) { console.warn(e); }
  };

  const getGPS = () => {
    setGpsLoading(true); setGpsError(""); setError("");
    if (!navigator.geolocation) { setGpsError("GPS not supported."); setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => { await placeMarkerAt(pos.coords.longitude, pos.coords.latitude); setGpsLoading(false); },
      (err) => {
        setGpsLoading(false);
        setGpsError({
          1: "Location blocked. Enable permission in browser settings.",
          2: "GPS signal weak. Move to open area.",
          3: "GPS timed out. Try again.",
        }[err.code] || "GPS error.");
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const handleSearch = async (query) => {
    const q = (query || searchQuery).trim();
    if (!q) return;
    setSearching(true); setSearchResults([]); setError(""); setSearchSources("");
    try {
      let results = await multiSourceGeocode(q);
      if (!results.length) results = await multiSourceGeocode(`${q} Tamil Nadu India`);
      if (!results.length) {
        setError("Location not found. Try adding city name or use GPS.");
      } else {
        setSearchResults(results);
        const src = [...new Set(results.map((r) => r.source))].join(", ");
        setSearchSources(`${results.length} result${results.length > 1 ? "s" : ""} via ${src}`);
      }
    } catch { setError("Search failed. Check internet connection."); }
    finally { setSearching(false); }
  };

  const selectResult = async (r) => {
    setSearchResults([]); setSearchSources("");
    await placeMarkerAt(parseFloat(r.lon), parseFloat(r.lat));
  };

  const confirmLocation = () => {
    if (!location) return;
    setConfirmed(true);
    onLocationCaptured?.({
      latitude:    location.latitude,
      longitude:   location.longitude,
      address:     location.address,
      road:        location.road,
      suburb:      location.suburb,
      city:        location.city,
      district:    location.district,
      state:       location.state,
      postcode:    location.postcode,
      displayName: location.displayName,
      nearbyPOIs:  nearbyPOIs.map((p) => p.name).join(", "),
    });
  };

  if (!MAPTILER_KEY) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">MapTiler API Key Missing</p>
            <p className="text-sm text-amber-700 mt-1">
              Add <code className="bg-amber-100 px-1 rounded text-xs font-mono">VITE_MAPTILER_KEY</code> to your{" "}
              <code className="bg-amber-100 px-1 rounded text-xs font-mono">.env</code> and Vercel environment variables.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Header + Style Switcher */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blue-600" /> Crime Scene Location
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Tap map · GPS · Search</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0 flex-wrap justify-end">
          {[
            { id: "hybrid",    icon: Layers,    label: "Hybrid"    },
            { id: "satellite", icon: Satellite, label: "Satellite" },
            { id: "streets",   icon: Map,       label: "Streets"   },
            { id: "topo",      icon: Map,       label: "Topo"      },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} type="button" onClick={() => switchStyle(id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                mapStyle === id ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              <Icon className="h-3 w-3" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
            placeholder="Search village, town, landmark…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="button" onClick={() => handleSearch(searchQuery)} disabled={searching}
          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
          {searching ? "⏳" : "Search"}
        </button>
        <button type="button" onClick={getGPS} disabled={gpsLoading}
          className="px-3 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap">
          <Navigation className="h-4 w-4" /> {gpsLoading ? "⏳" : "GPS"}
        </button>
      </div>

      {gpsError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{gpsError}</p>
        </div>
      )}

      {searchSources && !searching && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Info className="h-3 w-3" /> {searchSources}
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{error}</p>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {searchResults.map((r, i) => (
            <button key={`${r.source}-${i}`} type="button" onClick={() => selectResult(r)}
              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors group">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-gray-400 group-hover:text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">
                    {r.shortName || r.display_name?.split(",")[0]}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{r.display_name}</p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 mt-0.5 inline-block">
                    {r.source}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-md" style={{ height: "360px" }}>
        <div ref={mapContainerRef} className="w-full h-full" />

        {mapLoading && !mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 gap-3">
            <div className="h-9 w-9 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600 font-semibold">Loading map…</p>
          </div>
        )}

        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-4">
            <div className="flex items-start gap-3 max-w-sm">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 text-sm">Map failed to load</p>
                <p className="text-xs text-red-700 mt-1">{mapError}</p>
                <button type="button"
                  onClick={() => { setMapError(""); setMapLoading(true); initializedRef.current = false; setTimeout(() => initMap(), 300); }}
                  className="mt-2 text-xs text-blue-600 underline">
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {mapReady && (
          <div className="absolute top-2 left-2 bg-white/85 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] text-gray-600 font-semibold shadow-sm pointer-events-none">
            ⚡ MapTiler · Ultra HD
          </div>
        )}
      </div>

      {mapReady && !location && (
        <p className="text-xs text-center text-gray-400 py-1">
          📍 Tap anywhere on the map to pin the crime scene location
        </p>
      )}

      {/* Location Card */}
      {location && (
        <div className={`rounded-xl border p-3 space-y-2.5 transition-all ${
          confirmed ? "bg-green-50 border-green-300" : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {confirmed
                ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                : <MapPin      className="h-4 w-4 text-blue-600 shrink-0 mt-0.5"  />}
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-semibold text-gray-800 leading-snug">
                  {location.name || location.road || location.suburb || "Selected Location"}
                </p>
                <p className="text-xs text-gray-600 line-clamp-2">{location.address}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
                  {location.road     && <p className="text-xs text-gray-500">🛣️ <span className="font-medium">{location.road}</span></p>}
                  {location.suburb   && <p className="text-xs text-gray-500">🏘️ <span className="font-medium">{location.suburb}</span></p>}
                  {location.city     && <p className="text-xs text-gray-500">🏙️ <span className="font-medium">{location.city}</span></p>}
                  {location.district && <p className="text-xs text-gray-500">🗺️ <span className="font-medium">{location.district}</span></p>}
                  {location.state    && <p className="text-xs text-gray-500">📍 <span className="font-medium">{location.state}</span></p>}
                  {location.postcode && <p className="text-xs text-gray-500">📮 <span className="font-medium">{location.postcode}</span></p>}
                </div>
                <span className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded-full text-gray-500 mt-1 inline-block">
                  via {location.source}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-mono text-gray-500">{location.latitude?.toFixed(5)}°N</p>
              <p className="text-[10px] font-mono text-gray-500">{location.longitude?.toFixed(5)}°E</p>
            </div>
          </div>

          {nearbyPOIs.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nearby Landmarks</p>
              <div className="flex flex-wrap gap-1">
                {nearbyPOIs.map((poi, i) => (
                  <span key={`${poi.name}-${i}`}
                    className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-700">
                    {POI_EMOJI[poi.type] || "📍"} {poi.name}
                    <span className="text-gray-400 ml-1">{poi.distance}m</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {!confirmed ? (
            <Button onClick={confirmLocation}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 rounded-lg font-medium">
              <CheckCircle className="h-4 w-4 mr-1.5 inline" /> Confirm This Location
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
              <CheckCircle className="h-4 w-4" /> Location confirmed ✅
              <button type="button" onClick={() => setConfirmed(false)}
                className="ml-auto text-xs text-green-600 underline">Change</button>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-center text-gray-400">
        🗺️ MapTiler · 100k free loads/month · No card · Ultra HD India maps
      </p>
    </div>
  );
}