"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

interface GeoPhoto {
  id: string;
  url: string;
  caption: string | null;
  latitude: number;
  longitude: number;
}

interface PhotoMapViewProps {
  photos: GeoPhoto[];
  onClose: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L: any;
  }
}

export function PhotoMapView({ photos, onClose }: PhotoMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [activePhoto, setActivePhoto] = useState<GeoPhoto | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load Leaflet CSS
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const scriptId = "leaflet-js";
    const existing = document.getElementById(scriptId);
    if (existing) {
      setLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !mapRef.current || photos.length === 0) return;
    const L = window.L;
    if (!L) return;

    // Clean up any existing map
    if ((mapRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id) {
      // Already initialised — nothing to do
      return;
    }

    const center = photos.reduce(
      (acc, p) => [acc[0] + p.latitude / photos.length, acc[1] + p.longitude / photos.length],
      [0, 0]
    );

    const map = L.map(mapRef.current).setView(center, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: "",
      html: `<div style="background:#3b82f6;border:2px solid white;border-radius:50%;width:24px;height:24px;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer;"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    photos.forEach((photo) => {
      const marker = L.marker([photo.latitude, photo.longitude], { icon: pinIcon }).addTo(map);
      marker.on("click", () => setActivePhoto(photo));
    });

    if (photos.length > 1) {
      const bounds = L.latLngBounds(photos.map((p) => [p.latitude, p.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [loaded, photos]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-sm font-semibold text-gray-900">
              Photo Map — {photos.length} geotagged photo{photos.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Map */}
        <div className="relative flex-1 min-h-0">
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <p className="text-sm text-gray-500">Loading map…</p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full min-h-[400px]" />
        </div>

        {/* Photo preview */}
        {activePhoto && (
          <div className="border-t border-gray-200 flex items-center gap-3 p-3 bg-gray-50">
            <img
              src={activePhoto.url}
              alt={activePhoto.caption || "Photo"}
              className="w-16 h-16 object-cover rounded-lg shrink-0"
            />
            <div className="min-w-0">
              {activePhoto.caption && (
                <p className="text-sm font-medium text-gray-900 truncate">{activePhoto.caption}</p>
              )}
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {activePhoto.latitude.toFixed(6)}, {activePhoto.longitude.toFixed(6)}
              </p>
            </div>
            <button
              onClick={() => setActivePhoto(null)}
              className="ml-auto p-1 text-gray-400 hover:text-gray-600 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
