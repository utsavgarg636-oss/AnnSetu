import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  RefreshCw,
  Navigation,
  Crosshair,
  Layers,
  MapPin,
  Building2,
  Flame,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Car,
  Clock
} from 'lucide-react';

// Central Delhi Reference (Connaught Place)
const DEFAULT_CENTER_LAT = 28.6139;
const DEFAULT_CENTER_LNG = 77.2090;

/**
 * Calculate accurate Haversine distance in kilometers between two GPS coordinates
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

export default function LiveMap({ activePost = null, activeTier = 0, onSelectPost = null }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routesLayerRef = useRef(null);
  const circlesLayerRef = useRef(null);

  const [ngos, setNgos] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite' | 'terrain'
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'APPROVED' | 'BIO'
  const [selectedNgoId, setSelectedNgoId] = useState(null);

  // Determine User / Food Post location
  const userLat = activePost?.lat || DEFAULT_CENTER_LAT;
  const userLng = activePost?.lng || DEFAULT_CENTER_LNG;

  // Fetch map data
  const fetchMapData = async () => {
    try {
      const res = await fetch('/api/admin/map-data');
      if (res.ok) {
        const data = await res.json();
        setNgos(data.ngos || []);
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.warn('Map data fetch error:', err);
    }
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Initialize Leaflet Map Instance ──────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Create Leaflet Map instance with Google Maps style defaults
    const map = L.map(mapContainerRef.current, {
      center: [userLat, userLng],
      zoom: 13,
      zoomControl: false, // We render custom Google Maps zoom controls
      attributionControl: false
    });

    // Default: Google Maps Roadmap tiles
    const tileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 20
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Create layer groups for markers, routes, and escalation circles
    circlesLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size on initial load to avoid tile glitches
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // ─── Handle Map Type Switch (Roadmap vs Satellite vs Terrain) ──────
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;

    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    let url = 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
    let subdomains = ['0', '1', '2', '3'];

    if (mapType === 'satellite') {
      // Google Maps Hybrid Satellite (Imagery + Roads/Labels)
      url = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    } else if (mapType === 'terrain') {
      // CartoDB Voyager clean streets
      url = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      subdomains = ['a', 'b', 'c', 'd'];
    }

    const newLayer = L.tileLayer(url, {
      subdomains,
      maxZoom: 20
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [mapType]);

  // ─── Center on User Post when activePost changes ──────────────────
  useEffect(() => {
    if (mapInstanceRef.current && activePost?.lat && activePost?.lng) {
      mapInstanceRef.current.panTo([activePost.lat, activePost.lng], {
        animate: true,
        duration: 0.8
      });
    }
  }, [activePost?.id, activePost?.lat, activePost?.lng]);

  // ─── Render Markers, Distance Badges, Routes & Radius Rings ────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !routesLayerRef.current || !circlesLayerRef.current) return;

    // Clear previous layers
    markersLayerRef.current.clearLayers();
    routesLayerRef.current.clearLayers();
    circlesLayerRef.current.clearLayers();

    // 1. ESCALATION RADIUS RINGS
    if (activeTier >= 0) {
      // 3 km radius circle (Tier 0)
      L.circle([userLat, userLng], {
        radius: 3000,
        color: '#10B981',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#10B981',
        fillOpacity: 0.08
      }).addTo(circlesLayerRef.current);
    }

    if (activeTier >= 1) {
      // 8 km radius circle (Tier 1 & 2)
      L.circle([userLat, userLng], {
        radius: 8000,
        color: '#F59E0B',
        weight: 2,
        dashArray: '8, 6',
        fillColor: '#F59E0B',
        fillOpacity: 0.05
      }).addTo(circlesLayerRef.current);
    }

    // Filter NGOs based on active filter
    const activeNgos = ngos.filter((n) => {
      if (filterType === 'APPROVED') return n.is_approved === 1 && n.type === 'NGO';
      if (filterType === 'BIO') return n.type === 'BIO_FALLBACK';
      return true;
    });

    // 2. USER / EVENT FOOD POST MARKER (Google Red Pin)
    const effectivePosts = posts.length > 0 ? posts : (activePost ? [activePost] : [{
      id: 1,
      lat: userLat,
      lng: userLng,
      host_name: 'The Grand Leela Palace',
      food_type: 'Cooked Rice & Curry',
      remaining_portions: 250,
      status: 'OPEN'
    }]);

    effectivePosts.forEach((post) => {
      const isSelected = activePost?.id === post.id;
      const userPinHtml = `
        <div class="gmap-pin-wrap user-pin-wrap ${isSelected ? 'is-selected' : ''}">
          <div class="gmap-pulse-halo"></div>
          <div class="gmap-pin gmap-pin-red">
            <div class="gmap-pin-head">
              <span class="gmap-icon">🍲</span>
            </div>
            <div class="gmap-pin-tip"></div>
          </div>
          <div class="gmap-pin-pill user-pill">
            <span class="pin-user-badge">USER</span>
            <span class="pin-post-name">${post.host_name || 'Event Host'}</span>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'gmap-leaflet-icon',
        html: userPinHtml,
        iconSize: [120, 64],
        iconAnchor: [60, 48]
      });

      const userMarker = L.marker([post.lat, post.lng], { icon: userIcon, zIndexOffset: 1000 })
        .addTo(markersLayerRef.current);

      userMarker.on('click', () => {
        setSelectedEntity({ ...post, kind: 'POST' });
        if (onSelectPost) onSelectPost(post);
      });
    });

    // 3. NGO MARKERS WITH PROMINENT DISTANCE BADGES & ROUTES
    activeNgos.forEach((ngo) => {
      const dist = calculateDistance(userLat, userLng, ngo.lat, ngo.lng);
      const isBio = ngo.type === 'BIO_FALLBACK';
      const isSelected = selectedNgoId === ngo.id;
      const travelMins = Math.max(3, Math.round(dist * 2.5));

      // Color scheme: Green for verified NGO, Purple for Biogas, Gray for unverified
      const pinColorClass = isBio ? 'gmap-pin-purple' : (ngo.is_approved ? 'gmap-pin-green' : 'gmap-pin-gray');

      const ngoPinHtml = `
        <div class="gmap-pin-wrap ngo-pin-wrap ${isSelected ? 'is-selected' : ''}">
          <div class="gmap-pin-distance-tag ${dist <= 3 ? 'tag-tier0' : dist <= 8 ? 'tag-tier1' : 'tag-tier3'}">
            <span class="car-badge">🚗</span>
            <strong class="dist-num">${dist} km</strong>
          </div>
          <div class="gmap-pin ${pinColorClass}">
            <div class="gmap-pin-head">
              <span class="gmap-icon">${isBio ? '♻' : '🏢'}</span>
            </div>
            <div class="gmap-pin-tip"></div>
          </div>
          <div class="gmap-pin-pill ngo-pill">
            <span class="pin-ngo-name">${ngo.name.split(' ')[0]}</span>
          </div>
        </div>
      `;

      const ngoIcon = L.divIcon({
        className: 'gmap-leaflet-icon',
        html: ngoPinHtml,
        iconSize: [110, 72],
        iconAnchor: [55, 54]
      });

      const ngoMarker = L.marker([ngo.lat, ngo.lng], { icon: ngoIcon, zIndexOffset: 500 })
        .addTo(markersLayerRef.current);

      ngoMarker.on('click', () => {
        setSelectedNgoId(ngo.id);
        setSelectedEntity({ ...ngo, kind: 'NGO', calculatedDistance: dist, travelMins });
        map.panTo([ngo.lat, ngo.lng], { animate: true, duration: 0.6 });
      });

      // 4. DRAW GOOGLE MAPS NAVIGATION ROUTE LINE (USER -> NGO)
      const isRouteActive = isSelected || dist <= 3 || (activeTier >= 1 && dist <= 8);
      const routeColor = isBio ? '#8B5CF6' : (dist <= 3 ? '#10B981' : '#1A73E8');

      // Polyline route
      const routeLine = L.polyline(
        [
          [userLat, userLng],
          [ngo.lat, ngo.lng]
        ],
        {
          color: routeColor,
          weight: isSelected ? 4 : 2.5,
          opacity: isRouteActive ? 0.85 : 0.4,
          dashArray: isSelected ? undefined : '6, 6'
        }
      ).addTo(routesLayerRef.current);

      routeLine.on('click', () => {
        setSelectedNgoId(ngo.id);
        setSelectedEntity({ ...ngo, kind: 'NGO', calculatedDistance: dist, travelMins });
      });

      // Midpoint distance pill on the route
      const midLat = (userLat + ngo.lat) / 2;
      const midLng = (userLng + ngo.lng) / 2;

      const midBadgeHtml = `
        <div class="gmap-route-midpoint-pill ${isSelected ? 'highlight' : ''}">
          <span class="route-icon">🚗</span>
          <strong>${dist} km</strong>
          <small>(${travelMins}m)</small>
        </div>
      `;

      const midIcon = L.divIcon({
        className: 'gmap-midpoint-leaflet-icon',
        html: midBadgeHtml,
        iconSize: [90, 24],
        iconAnchor: [45, 12]
      });

      const midMarker = L.marker([midLat, midLng], { icon: midIcon, interactive: true })
        .addTo(routesLayerRef.current);

      midMarker.on('click', () => {
        setSelectedNgoId(ngo.id);
        setSelectedEntity({ ...ngo, kind: 'NGO', calculatedDistance: dist, travelMins });
      });
    });
  }, [ngos, posts, activePost, activeTier, filterType, selectedNgoId, userLat, userLng]);

  // Controls: Recenter to User / Hub
  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([userLat, userLng], 13, { animate: true });
    }
  };

  // Controls: Zoom In / Zoom Out
  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };
  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  // Controls: Fit bounds to all markers
  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    const points = [[userLat, userLng]];
    ngos.forEach((n) => points.push([n.lat, n.lng]));
    if (points.length > 1) {
      mapInstanceRef.current.fitBounds(points, { padding: [50, 50], animate: true });
    }
  };

  // Sorted NGOs by proximity to the User
  const sortedNgos = [...ngos].map((n) => ({
    ...n,
    distance: calculateDistance(userLat, userLng, n.lat, n.lng)
  })).sort((a, b) => a.distance - b.distance);

  return (
    <div className="google-map-wrapper">
      {/* ─── GOOGLE MAPS STYLE TOP SEARCH & TOOLBAR ──────────────────── */}
      <div className="gmap-top-bar">
        <div className="gmap-search-capsule">
          <MapPin size={16} className="text-google-red" />
          <div className="gmap-search-text">
            <strong>Delhi NCR Food Rescue Grid</strong>
            <span className="gmap-coord-sub">
              User Host: {activePost?.host_name || 'The Grand Leela Palace'} ({userLat.toFixed(4)}°N, {userLng.toFixed(4)}°E)
            </span>
          </div>
        </div>

        {/* Map Type Segmented Control (Map / Satellite / Terrain) */}
        <div className="gmap-type-toggle">
          <button
            className={`gmap-type-btn ${mapType === 'roadmap' ? 'active' : ''}`}
            onClick={() => setMapType('roadmap')}
          >
            🗺️ Map
          </button>
          <button
            className={`gmap-type-btn ${mapType === 'satellite' ? 'active' : ''}`}
            onClick={() => setMapType('satellite')}
          >
            🛰️ Satellite
          </button>
          <button
            className={`gmap-type-btn ${mapType === 'terrain' ? 'active' : ''}`}
            onClick={() => setMapType('terrain')}
          >
            🧭 Clean
          </button>
        </div>

        {/* Filter Pills */}
        <div className="gmap-filter-group">
          <button
            className={`gmap-filter-pill ${filterType === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterType('ALL')}
          >
            All Nodes ({ngos.length})
          </button>
          <button
            className={`gmap-filter-pill ${filterType === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setFilterType('APPROVED')}
          >
            Verified NGOs ({ngos.filter((n) => n.is_approved && n.type === 'NGO').length})
          </button>
          <button
            className={`gmap-filter-pill ${filterType === 'BIO' ? 'active' : ''}`}
            onClick={() => setFilterType('BIO')}
          >
            Biogas Unit
          </button>
          <button className="gmap-refresh-btn" onClick={fetchMapData} title="Sync Live Nodes">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ─── LEAFLET GOOGLE MAP CANVAS CONTAINER ─────────────────────── */}
      <div className="gmap-viewport-container">
        <div ref={mapContainerRef} className="gmap-leaflet-canvas" />

        {/* Google Maps Floating Zoom & Recenter Controls */}
        <div className="gmap-floating-controls">
          <div className="gmap-control-card">
            <button
              className="gmap-icon-btn"
              onClick={handleRecenter}
              title="Recenter to User Location"
            >
              <Crosshair size={18} />
            </button>
            <div className="gmap-btn-divider" />
            <button
              className="gmap-icon-btn"
              onClick={handleFitBounds}
              title="Fit All Rescue Nodes"
            >
              <Maximize2 size={16} />
            </button>
          </div>

          <div className="gmap-control-card zoom-group">
            <button className="gmap-icon-btn" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn size={18} />
            </button>
            <div className="gmap-btn-divider" />
            <button className="gmap-icon-btn" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut size={18} />
            </button>
          </div>
        </div>

        {/* Google Maps Radius Escalation Badge Overlay */}
        <div className="gmap-tier-floating-badge">
          <div className="tier-badge-indicator">
            <span className={`tier-dot ${activeTier === 0 ? 'green' : activeTier <= 2 ? 'amber' : 'purple'}`} />
            <span>
              Active Escalation: <strong>{activeTier === 0 ? 'Tier 0 (3 km Radius)' : activeTier === 1 ? 'Tier 1 (8 km Radius)' : activeTier === 2 ? 'Tier 2 (8 km Smart Split)' : 'Tier 3 (Admin Fallback)'}</strong>
            </span>
          </div>
        </div>

        {/* ─── GOOGLE MAPS INFOWINDOW POPUP CARD ─────────────────────── */}
        {selectedEntity && (
          <div className="gmap-infowindow-card">
            <div className="infowindow-header">
              <div className="flex items-center gap-2">
                {selectedEntity.kind === 'NGO' ? (
                  selectedEntity.type === 'BIO_FALLBACK' ? (
                    <Flame size={18} className="text-purple" />
                  ) : (
                    <Building2 size={18} className="text-emerald" />
                  )
                ) : (
                  <MapPin size={18} className="text-google-red" />
                )}
                <div>
                  <h4 className="infowindow-title">{selectedEntity.name || selectedEntity.host_name}</h4>
                  <span className="infowindow-subtitle">
                    {selectedEntity.kind === 'NGO'
                      ? (selectedEntity.type === 'BIO_FALLBACK' ? 'Biogas & Compost Rescue Unit' : 'Verified Food Rescue NGO')
                      : 'Event Surplus Food Source (User)'}
                  </span>
                </div>
              </div>
              <button className="infowindow-close-btn" onClick={() => setSelectedEntity(null)}>✕</button>
            </div>

            <div className="infowindow-body">
              {selectedEntity.kind === 'NGO' ? (
                <>
                  {/* Distance Callout Banner */}
                  <div className="infowindow-distance-box">
                    <div className="distance-icon-circle">
                      <Car size={18} />
                    </div>
                    <div>
                      <div className="distance-primary">
                        <strong>{selectedEntity.calculatedDistance || calculateDistance(userLat, userLng, selectedEntity.lat, selectedEntity.lng)} km</strong> from User
                      </div>
                      <div className="distance-secondary">
                        <Clock size={12} className="inline mr-1" />
                        Estimated transit: ~{selectedEntity.travelMins || Math.round((selectedEntity.calculatedDistance || 2.5) * 2.5)} mins
                      </div>
                    </div>
                  </div>

                  <div className="infowindow-grid">
                    <div className="info-stat">
                      <span className="info-label">Capacity</span>
                      <strong className="info-val">{selectedEntity.max_capacity} portions</strong>
                    </div>
                    <div className="info-stat">
                      <span className="info-label">Trust Index</span>
                      <strong className="info-val text-emerald">★ {selectedEntity.trust_score || 4.8}</strong>
                    </div>
                    <div className="info-stat">
                      <span className="info-label">FSSAI Status</span>
                      <strong className="info-val">{selectedEntity.fssai_verified ? '✅ Verified' : '⏳ Pending'}</strong>
                    </div>
                    <div className="info-stat">
                      <span className="info-label">Contact</span>
                      <strong className="info-val text-blue">{selectedEntity.phone || '+91 98110 01100'}</strong>
                    </div>
                  </div>

                  <button
                    className="infowindow-route-btn"
                    onClick={() => {
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.fitBounds([
                          [userLat, userLng],
                          [selectedEntity.lat, selectedEntity.lng]
                        ], { padding: [60, 60], animate: true });
                      }
                    }}
                  >
                    <Navigation size={14} />
                    <span>Focus Navigation Route ({selectedEntity.calculatedDistance || calculateDistance(userLat, userLng, selectedEntity.lat, selectedEntity.lng)} km)</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="infowindow-grid">
                    <div className="info-stat">
                      <span className="info-label">Portions</span>
                      <strong className="info-val text-amber">{selectedEntity.remaining_portions} portions</strong>
                    </div>
                    <div className="info-stat">
                      <span className="info-label">Status</span>
                      <strong className="info-val">{selectedEntity.status}</strong>
                    </div>
                    <div className="info-stat">
                      <span className="info-label">Food Type</span>
                      <strong className="info-val">{selectedEntity.food_type}</strong>
                    </div>
                    <div className="info-stat">
                      <span className="info-label">Escalation</span>
                      <strong className="info-val">Tier {selectedEntity.escalation_tier || 0}</strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── PROXIMITY TELEMETRY BAR: DISTANCE TO ALL NGOS ───────────── */}
      <div className="gmap-bottom-proximity-strip">
        <div className="proximity-strip-header">
          <Car size={14} className="text-google-blue" />
          <span>Real-Time Distances from User Host:</span>
        </div>

        <div className="proximity-chips-scroll">
          {sortedNgos.map((ngo, idx) => {
            const isBio = ngo.type === 'BIO_FALLBACK';
            const isSelected = selectedNgoId === ngo.id;
            const inTier0 = ngo.distance <= 3;
            const inTier1 = ngo.distance <= 8;

            return (
              <button
                key={`prox-${ngo.id}`}
                className={`proximity-chip ${isSelected ? 'active' : ''} ${isBio ? 'bio-chip' : ''}`}
                onClick={() => {
                  setSelectedNgoId(ngo.id);
                  setSelectedEntity({
                    ...ngo,
                    kind: 'NGO',
                    calculatedDistance: ngo.distance,
                    travelMins: Math.max(3, Math.round(ngo.distance * 2.5))
                  });
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.panTo([ngo.lat, ngo.lng], { animate: true });
                  }
                }}
              >
                <span className="chip-rank">#{idx + 1}</span>
                <span className="chip-name">{ngo.name.split(' ')[0]}</span>
                <span className={`chip-dist-badge ${inTier0 ? 'tier0' : inTier1 ? 'tier1' : 'tier3'}`}>
                  {ngo.distance} km
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
