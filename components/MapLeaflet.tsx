"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { ConsumerVenueCard } from "@/lib/consumer/types";

export type MapVenue = ConsumerVenueCard & {
  coordinates: [number, number];
};

type Props = {
  venues: MapVenue[];
  selectedVenue: MapVenue | null;
  onSelectVenue: (venue: MapVenue) => void;
  center: [number, number];
  zoom: number;
};

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, map, zoom]);

  return null;
}

function getCrowdTone(venue: MapVenue) {
  const level = (venue.crowdLevel ?? "").toLowerCase();

  if (level.includes("packed")) {
    return "red";
  }

  if (level.includes("buzzing") || level.includes("high")) {
    return "amber";
  }

  return "emerald";
}

function getMarkerIcon(color: string) {
  return L.divIcon({
    html: `<div class="map-pin ${color}"></div>`,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function MapLeaflet({ venues, selectedVenue, onSelectVenue, center, zoom }: Props) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-[0_0_90px_rgba(34,211,238,0.12)]">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-[62vh] min-h-[420px] w-full sm:h-[70vh] lg:h-[78vh]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapController center={center} zoom={zoom} />
        {venues.map((venue) => {
          const tone = getCrowdTone(venue);

          return (
            <Marker
              key={venue.id}
              position={venue.coordinates}
              icon={getMarkerIcon(tone)}
              eventHandlers={{
                click: () => onSelectVenue(venue),
              }}
            >
              <Popup>
                <div className="min-w-[220px] rounded-2xl border border-white/10 bg-zinc-950 p-3 text-zinc-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">{venue.neighborhood}</p>
                      <p className="mt-1 font-semibold text-white">{venue.name}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-zinc-300">
                      {venue.crowdLevel ?? "Unknown"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">{venue.distanceLabel ?? venue.neighborhood}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-300">
                    {venue.genres.slice(0, 3).map((genre) => (
                      <span key={genre} className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {selectedVenue ? (
        <div className="absolute bottom-4 left-4 right-4 rounded-[1.5rem] border border-white/10 bg-zinc-950/90 p-4 shadow-[0_0_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[320px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-200">Live preview</p>
              <h3 className="mt-1 text-lg font-semibold text-white">{selectedVenue.name}</h3>
            </div>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-200">
              {selectedVenue.liveLabel ?? "Tonight"}
            </span>
          </div>

          <div className="mt-4 grid gap-2 text-sm text-zinc-300">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span>Status</span>
              <span className="font-medium text-white">{selectedVenue.liveStatusProvenance.replace("_", " ")}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span>Crowd</span>
              <span className="font-medium text-white">{selectedVenue.crowdLevel ?? "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span>Genre</span>
              <span className="font-medium text-white">{selectedVenue.genre}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
              <span>Distance</span>
              <span className="font-medium text-white">{selectedVenue.distanceLabel ?? "--"}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedVenue.genres.map((genre) => (
              <span key={genre} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300">
                {genre}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-zinc-400">{selectedVenue.neighborhood}</p>
            <a href={`/venues/${selectedVenue.slug}`} className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90">
              Open venue
            </a>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .leaflet-container {
          background: #03050a;
        }

        .leaflet-control-attribution {
          background: rgba(3, 5, 10, 0.9) !important;
          color: #d4d4d8 !important;
        }

        .leaflet-popup-content-wrapper,
        .leaflet-popup-tip {
          background: rgba(9, 14, 24, 0.96) !important;
          color: #f4f4f5 !important;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        }

        .map-pin {
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          border: 2px solid rgba(255,255,255,0.85);
          box-shadow: 0 0 18px rgba(255,255,255,0.16);
        }

        .map-pin.emerald {
          background: #34d399;
        }

        .map-pin.amber {
          background: #fbbf24;
        }

        .map-pin.red {
          background: #fb7185;
        }

        .map-cluster {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 9999px;
          background: linear-gradient(135deg, rgba(34,211,238,0.95), rgba(168,85,247,0.95));
          color: white;
          font-size: 12px;
          font-weight: 700;
          border: 2px solid rgba(255,255,255,0.25);
          box-shadow: 0 0 20px rgba(34,211,238,0.24);
        }
      `}</style>
    </div>
  );
}
