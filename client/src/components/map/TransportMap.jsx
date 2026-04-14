// Fichier : client/src/components/map/TransportMap.jsx
import { useEffect, useRef } from "react";

// Leaflet est chargé globalement (CDN ou installé)
// npm install leaflet  ✓ (déjà dans le projet)

let L = null;
try {
  L = require("leaflet");
  // Fix icônes Leaflet avec Webpack
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
} catch {
  /* Leaflet non disponible */
}

const NICE = [43.7102, 7.262];

export default function TransportMap({ transport, vehiclePosition }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markersRef = useRef({});

  // ── Initialisation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!L || !mapRef.current || instanceRef.current) return;

    instanceRef.current = L.map(mapRef.current, {
      center: NICE,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instanceRef.current);

    return () => {
      instanceRef.current?.remove();
      instanceRef.current = null;
    };
  }, []);

  // ── Marqueur départ ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!instanceRef.current) return;
    const coords = transport?.adresseDepart?.coordonnees;
    if (!coords?.lat) return;

    if (markersRef.current.depart) {
      markersRef.current.depart.setLatLng([coords.lat, coords.lng]);
    } else {
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:#1D6EF5;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          transform:rotate(-45deg);
          display:flex;align-items:center;justify-content:center;
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      markersRef.current.depart = L.marker([coords.lat, coords.lng], { icon })
        .addTo(instanceRef.current)
        .bindPopup(
          `<b>Départ</b><br>${transport.patient?.nom} ${transport.patient?.prenom}<br>${transport.adresseDepart?.rue || ""}`,
        );
    }
  }, [transport?.adresseDepart]);

  // ── Marqueur destination ──────────────────────────────────────────────────
  useEffect(() => {
    if (!instanceRef.current) return;
    const coords = transport?.adresseDestination?.coordonnees;
    if (!coords?.lat) return;

    if (markersRef.current.destination) {
      markersRef.current.destination.setLatLng([coords.lat, coords.lng]);
    } else {
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:32px;height:32px;border-radius:50%;
          background:#10b981;border:3px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
          </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const nom =
        transport.adresseDestination?.nom ||
        transport.adresseDestination?.rue ||
        "Destination";
      markersRef.current.destination = L.marker([coords.lat, coords.lng], {
        icon,
      })
        .addTo(instanceRef.current)
        .bindPopup(
          `<b>Destination</b><br>${nom}<br>${transport.adresseDestination?.service || ""}`,
        );
    }

    // Ajuster la vue pour inclure les deux marqueurs
    const bounds = [];
    if (transport?.adresseDepart?.coordonnees?.lat)
      bounds.push([
        transport.adresseDepart.coordonnees.lat,
        transport.adresseDepart.coordonnees.lng,
      ]);
    bounds.push([coords.lat, coords.lng]);
    if (bounds.length >= 2)
      instanceRef.current.fitBounds(bounds, { padding: [40, 40] });
  }, [transport?.adresseDestination]);

  // ── Position véhicule (temps réel) ───────────────────────────────────────
  useEffect(() => {
    if (!instanceRef.current || !vehiclePosition?.lat) return;

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:36px;height:36px;border-radius:50%;
        background:#f97316;border:3px solid #fff;
        box-shadow:0 2px 12px rgba(249,115,22,0.6);
        display:flex;align-items:center;justify-content:center;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    if (markersRef.current.vehicle) {
      markersRef.current.vehicle.setLatLng([
        vehiclePosition.lat,
        vehiclePosition.lng,
      ]);
    } else {
      markersRef.current.vehicle = L.marker(
        [vehiclePosition.lat, vehiclePosition.lng],
        { icon, zIndexOffset: 1000 },
      )
        .addTo(instanceRef.current)
        .bindPopup("<b>Véhicule</b><br>Position en temps réel");
    }
  }, [vehiclePosition]);

  if (!L) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl text-slate-400 text-sm">
        <span className="material-symbols-outlined mr-2">map</span>
        Carte non disponible
      </div>
    );
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={mapRef} className="w-full h-full rounded-xl" />
    </>
  );
}
