import React, { useState, useEffect } from 'react';
import { MapPin, Shield, Building2, Flame, Award, Radio, Compass, RefreshCw, Zap } from 'lucide-react';

// Reference center: New Delhi (Connaught Place / Central Delhi)
const CENTER_LAT = 28.6139;
const CENTER_LNG = 77.2090;

export default function LiveMap({ activePost = null, activeTier = 0, onSelectPost = null }) {
  const [ngos, setNgos] = useState([]);
  const [posts, setPosts] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

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

  // Map projection coordinates: center is (350, 240) in a 700x480 SVG box
  const mapWidth = 700;
  const mapHeight = 480;
  const scale = 2200; // pixels per degree

  const project = (lat, lng) => {
    const x = mapWidth / 2 + (lng - CENTER_LNG) * scale * 1.1;
    const y = mapHeight / 2 - (lat - CENTER_LAT) * scale;
    return { x: Math.max(30, Math.min(mapWidth - 30, x)), y: Math.max(30, Math.min(mapHeight - 30, y)) };
  };

  // Convert km radius to SVG pixels (~111 km per degree lat)
  const kmToPixels = (km) => (km / 111) * scale;

  const currentCenter = activePost
    ? project(activePost.lat, activePost.lng)
    : project(CENTER_LAT, CENTER_LNG);

  const radius3km = kmToPixels(3);
  const radius8km = kmToPixels(8);

  const filteredNgos = ngos.filter((n) => {
    if (filterType === 'APPROVED') return n.is_approved === 1;
    if (filterType === 'BIO') return n.type === 'BIO_FALLBACK';
    return true;
  });

  return (
    <div className="telemetry-map-card">
      <div className="map-toolbar">
        <div className="map-title-zone">
          <Compass size={18} className="text-teal" />
          <span className="map-title">Delhi NCR Geofenced Rescue Radar</span>
          <span className="map-center-tag">Lat: 28.6139°N | Lng: 77.2090°E</span>
        </div>

        <div className="map-filters">
          <div className="map-legend">
            <span className="legend-item"><span className="legend-dot green" /> Verified NGO</span>
            <span className="legend-item"><span className="legend-dot amber" /> Food Post</span>
            <span className="legend-item"><span className="legend-dot purple" /> Biogas Fallback</span>
          </div>
          <button className="refresh-map-btn" onClick={fetchMapData} title="Refresh Live Map">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="map-canvas-container">
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="telemetry-svg">
          <defs>
            {/* Grid pattern */}
            <pattern id="radarGrid" width="35" height="35" patternUnits="userSpaceOnUse">
              <path d="M 35 0 L 0 0 0 35" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
            </pattern>
            {/* Radar Sweep Gradient */}
            <radialGradient id="pulseGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#168C87" stopOpacity="0.25" />
              <stop offset="70%" stopColor="#168C87" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#168C87" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Radar background grid */}
          <rect width={mapWidth} height={mapHeight} fill="url(#radarGrid)" />

          {/* Central concentric rings */}
          <circle cx={mapWidth / 2} cy={mapHeight / 2} r="60" fill="none" stroke="rgba(22, 140, 135, 0.15)" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx={mapWidth / 2} cy={mapHeight / 2} r="130" fill="none" stroke="rgba(22, 140, 135, 0.12)" strokeWidth="1" strokeDasharray="4 4" />
          <circle cx={mapWidth / 2} cy={mapHeight / 2} r="200" fill="none" stroke="rgba(22, 140, 135, 0.08)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Crosshairs */}
          <line x1={mapWidth / 2} y1="0" x2={mapWidth / 2} y2={mapHeight} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
          <line x1="0" y1={mapHeight / 2} x2={mapWidth} y2={mapHeight / 2} stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />

          {/* ACTIVE ESCALATION RADIUS RINGS */}
          {activeTier >= 0 && (
            <g className="radius-ring-3km">
              <circle
                cx={currentCenter.x}
                cy={currentCenter.y}
                r={radius3km}
                fill="rgba(16, 185, 129, 0.08)"
                stroke="#10B981"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animated-ring"
              />
              <text x={currentCenter.x + radius3km + 6} y={currentCenter.y - 4} fill="#10B981" fontSize="10" fontWeight="600">
                Tier 0 (3 km)
              </text>
            </g>
          )}

          {activeTier >= 1 && (
            <g className="radius-ring-8km">
              <circle
                cx={currentCenter.x}
                cy={currentCenter.y}
                r={radius8km}
                fill="rgba(245, 158, 11, 0.06)"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeDasharray="8 5"
                className="animated-ring"
              />
              <text x={currentCenter.x + radius8km + 6} y={currentCenter.y - 4} fill="#F59E0B" fontSize="10" fontWeight="600">
                Tier 1 & 2 (8 km Expand)
              </text>
            </g>
          )}

          {/* Fallback / Split Radar waves */}
          {activeTier === 2 && (
            <circle
              cx={currentCenter.x}
              cy={currentCenter.y}
              r={radius8km + 20}
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          )}

          {/* NGO PINS */}
          {filteredNgos.map((ngo) => {
            const pos = project(ngo.lat, ngo.lng);
            const isBio = ngo.type === 'BIO_FALLBACK';
            const isSelected = selectedEntity?.id === ngo.id && selectedEntity?.kind === 'NGO';

            return (
              <g
                key={`ngo-${ngo.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="map-node-pin ngo-pin"
                onClick={() => setSelectedEntity({ ...ngo, kind: 'NGO' })}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow ring on select */}
                {isSelected && (
                  <circle r="18" fill="none" stroke="#168C87" strokeWidth="2" strokeDasharray="3 3" />
                )}
                {/* Base circle */}
                <circle
                  r={isBio ? 9 : 8}
                  fill={isBio ? '#8B5CF6' : ngo.is_approved ? '#10B981' : '#64748B'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="pin-pulse"
                />
                {/* NGO initial */}
                <text y="3" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">
                  {isBio ? '♻' : 'N'}
                </text>
                {/* Name Label */}
                <text y="18" textAnchor="middle" fill="#E2E8F0" fontSize="9" fontWeight="500" className="map-node-label">
                  {ngo.name.split(' ')[0]}
                </text>
              </g>
            );
          })}

          {/* SURPLUS POST PINS */}
          {posts.map((post) => {
            const pos = project(post.lat, post.lng);
            const isSelected = activePost?.id === post.id || (selectedEntity?.id === post.id && selectedEntity?.kind === 'POST');

            return (
              <g
                key={`post-${post.id}`}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="map-node-pin post-pin"
                onClick={() => {
                  setSelectedEntity({ ...post, kind: 'POST' });
                  if (onSelectPost) onSelectPost(post);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer highlight for selected post */}
                {isSelected && (
                  <circle r="22" fill="url(#pulseGlow)" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 2" />
                )}
                <circle
                  r="10"
                  fill="#F59E0B"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                />
                <text y="3" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold">
                  🍲
                </text>
                <text y="21" textAnchor="middle" fill="#FDE68A" fontSize="9" fontWeight="600" className="map-node-label">
                  #{post.id} ({post.remaining_portions}p)
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected Entity Popup Panel */}
        {selectedEntity && (
          <div className="map-entity-popup">
            <div className="popup-header">
              <div className="flex items-center gap-1.5">
                {selectedEntity.kind === 'NGO' ? (
                  <Building2 size={16} className="text-emerald" />
                ) : (
                  <MapPin size={16} className="text-amber" />
                )}
                <strong>{selectedEntity.name || selectedEntity.food_type}</strong>
              </div>
              <button className="popup-close-btn" onClick={() => setSelectedEntity(null)}>✕</button>
            </div>

            <div className="popup-body">
              {selectedEntity.kind === 'NGO' ? (
                <>
                  <div className="popup-metric-row">
                    <span>Capacity:</span> <strong>{selectedEntity.max_capacity} portions</strong>
                  </div>
                  <div className="popup-metric-row">
                    <span>Trust Rating:</span> <strong>★ {selectedEntity.trust_score || 4.8}</strong>
                  </div>
                  <div className="popup-metric-row">
                    <span>FSSAI Verified:</span> <strong>{selectedEntity.fssai_verified ? '✅ Active' : '⏳ Pending'}</strong>
                  </div>
                  <div className="popup-metric-row">
                    <span>Type:</span> <span className="entity-type-tag">{selectedEntity.type}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="popup-metric-row">
                    <span>Host:</span> <strong>{selectedEntity.host_name}</strong>
                  </div>
                  <div className="popup-metric-row">
                    <span>Remaining:</span> <strong>{selectedEntity.remaining_portions} portions</strong>
                  </div>
                  <div className="popup-metric-row">
                    <span>Status:</span> <span className="entity-status-badge">{selectedEntity.status}</span>
                  </div>
                  <div className="popup-metric-row">
                    <span>Escalation:</span> <strong>Tier {selectedEntity.escalation_tier || 0}</strong>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="map-footer-telemetry">
        <div className="footer-metric">
          <Radio size={14} className="text-emerald inline mr-1" />
          <span>Verified Network Nodes: <strong>{ngos.filter(n => n.is_approved).length}</strong></span>
        </div>
        <div className="footer-metric">
          <Zap size={14} className="text-amber inline mr-1" />
          <span>Active Escalate Radius: <strong>{activeTier === 0 ? '3 km' : activeTier === 1 ? '8 km' : activeTier === 2 ? '8 km (Smart Split)' : 'Admin Fallback'}</strong></span>
        </div>
        <div className="footer-metric">
          <Flame size={14} className="text-purple inline mr-1" />
          <span>Biogas Backup: <strong>ZeroWaste Unit (4.2 km)</strong></span>
        </div>
      </div>
    </div>
  );
}
