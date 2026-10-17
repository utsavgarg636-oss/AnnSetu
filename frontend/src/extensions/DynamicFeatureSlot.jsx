import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import {
  Zap, Sun, Radio, Users, ShieldAlert, CheckCircle2, AlertTriangle,
  Flame, BatteryCharging, WifiOff, PhoneCall, RefreshCw, ChevronRight,
  Sparkles, Compass, Shield
} from 'lucide-react';

/**
 * Crisis Continuity & Infrastructure Resilience Mode Component
 *
 * Provides contingency protocols during severe grid interruptions,
 * cellular network degradation, or fuel constraints.
 */
export function CrisisContinuityCard({ portalType = 'admin' }) {
  const { socket } = useSocket();

  const [crisisState, setCrisisState] = useState({
    active: false,
    mode: 'SOLAR_COLD_STORAGE', // default selected mode when activating
    activatedAt: null,
    solarFacilities: [],
    smsDispatches: [],
    swarmZones: [],
    recentLogs: []
  });

  const [selectedMode, setSelectedMode] = useState('SOLAR_COLD_STORAGE');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  // Fetch current crisis status from backend
  const fetchCrisisStatus = async () => {
    try {
      const res = await fetch('/api/crisis/status');
      if (res.ok) {
        const data = await res.json();
        setCrisisState(data);
        if (data.mode) {
          setSelectedMode(data.mode);
        }
      }
    } catch (err) {
      console.warn('Error fetching crisis status:', err);
    }
  };

  useEffect(() => {
    fetchCrisisStatus();

    if (!socket) return;

    socket.on('crisis:status-updated', (data) => {
      setCrisisState((prev) => ({
        ...prev,
        active: data.active,
        mode: data.mode,
        activatedAt: data.activatedAt,
        solarFacilities: data.solarFacilities || prev.solarFacilities,
        smsDispatches: data.smsDispatches || prev.smsDispatches,
        swarmZones: data.swarmZones || prev.swarmZones
      }));
      if (data.mode) setSelectedMode(data.mode);
    });

    return () => {
      socket.off('crisis:status-updated');
    };
  }, [socket]);

  // Activate or Deactivate Continuity Mode
  const handleToggleContinuity = async (targetActive, modeToSet) => {
    setLoading(true);
    setToast('');
    const effectiveMode = modeToSet || selectedMode;

    try {
      const res = await fetch('/api/crisis/activate-continuity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: targetActive,
          mode: effectiveMode
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCrisisState((prev) => ({
          ...prev,
          active: data.active,
          mode: data.mode,
          activatedAt: data.activatedAt
        }));
        if (data.mode) setSelectedMode(data.mode);
        setToast(data.message || (targetActive ? 'Crisis mode active' : 'Normal operations restored'));
        fetchCrisisStatus();
        setTimeout(() => setToast(''), 4500);
      } else {
        setToast(`❌ Error: ${data.error || 'Failed to toggle mode'}`);
      }
    } catch (err) {
      setToast(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const modes = [
    {
      id: 'SOLAR_COLD_STORAGE',
      name: 'Solar Cold-Storage Rerouting',
      shortName: 'Solar Cold-Storage',
      icon: Sun,
      color: '#F59E0B',
      desc: 'Reroutes active food waypoints to 3 decentralized solar microgrid cold pods (4°C) with 15kW battery backup.',
      tag: 'Thermal Protection'
    },
    {
      id: 'MESH_SMS_FALLBACK',
      name: 'Offline Mesh SMS Fallback',
      shortName: 'Mesh SMS Radio',
      icon: Radio,
      color: '#0284C7',
      desc: 'Simulates decentralized 868MHz packet radio & cellular tower broadcast to all 5 verified NGOs when data networks fail.',
      tag: 'Zero-Internet Mesh'
    },
    {
      id: 'COMMUNITY_SWARM',
      name: 'Community Swarm Dispatch',
      shortName: 'Volunteer Swarm',
      icon: Users,
      color: '#10B981',
      desc: 'Replaces motorized delivery logs with 78 decentralized bicycle, e-rickshaw, and pedestrian volunteer micro-swarms.',
      tag: 'Zero-Fuel Relays'
    }
  ];

  return (
    <div className={`crisis-continuity-card ${crisisState.active ? 'crisis-active' : 'crisis-standby'}`}>
      {/* Top Header & Toggle Row */}
      <div className="crisis-card-header">
        <div className="crisis-title-wrap">
          <div className="crisis-icon-badge">
            <Zap size={20} className={crisisState.active ? 'text-amber animate-pulse' : 'text-slate-400'} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="crisis-title">⚡ Crisis Continuity & Infrastructure Resilience Mode</h3>
              <span className={`crisis-status-pill ${crisisState.active ? 'pill-active' : 'pill-standby'}`}>
                {crisisState.active ? 'PROTOCOLS ENGAGED' : 'STANDBY READY'}
              </span>
            </div>
            <p className="crisis-subtitle">
              Fail-safe protocols ensuring food safety and emergency dispatch during grid blackouts, cellular disruption, or transport bottlenecks.
            </p>
          </div>
        </div>

        {/* Master Active Toggle Switch */}
        <div className="crisis-toggle-action">
          <label className="toggle-switch-wrap" title="Toggle Crisis Continuity Mode">
            <input
              type="checkbox"
              checked={crisisState.active}
              disabled={loading}
              onChange={(e) => handleToggleContinuity(e.target.checked, selectedMode)}
            />
            <span className="toggle-slider" />
          </label>
          <span className="toggle-label-text">
            {loading ? 'Updating...' : crisisState.active ? 'Active' : 'Standby'}
          </span>
        </div>
      </div>

      {toast && (
        <div className="crisis-toast-alert">
          <span>{toast}</span>
          <button onClick={() => setToast('')} className="toast-dismiss">✕</button>
        </div>
      )}

      {/* LIVE EMERGENCY PROTOCOL BANNER (Visible when Active) */}
      {crisisState.active && (
        <div className="crisis-live-banner">
          <div className="banner-pulse-dot" />
          <div className="banner-content">
            <strong className="banner-title">
              🚨 EXTENDED DISRUPTION PROTOCOLS ENGAGED • Mode: {crisisState.mode?.replace(/_/g, ' ')}
            </strong>
            <p className="banner-desc">
              AnnSetu is autonomously rerouting dispatches, maintaining temperature telemetry, and coordinating emergency food relief through decentralized resilience assets.
            </p>
          </div>
          <span className="banner-timestamp">
            Engaged: {new Date(crisisState.activatedAt || Date.now()).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* THREE MODE SELECTORS */}
      <div className="crisis-modes-grid">
        {modes.map((m) => {
          const isSelected = selectedMode === m.id;
          const isCurrentlyActive = crisisState.active && crisisState.mode === m.id;
          const IconComp = m.icon;

          return (
            <div
              key={m.id}
              className={`crisis-mode-box ${isSelected ? 'selected' : ''} ${isCurrentlyActive ? 'active-mode' : ''}`}
              onClick={() => {
                setSelectedMode(m.id);
                if (crisisState.active && crisisState.mode !== m.id) {
                  handleToggleContinuity(true, m.id);
                }
              }}
            >
              <div className="mode-box-top">
                <div className="mode-icon-title">
                  <div className="mode-icon-wrapper" style={{ color: m.color, backgroundColor: `${m.color}15` }}>
                    <IconComp size={18} />
                  </div>
                  <div>
                    <h4 className="mode-box-name">{m.name}</h4>
                    <span className="mode-tag">{m.tag}</span>
                  </div>
                </div>
                {isCurrentlyActive && (
                  <span className="active-tag-pill" style={{ backgroundColor: m.color }}>
                    ENGAGED
                  </span>
                )}
              </div>

              <p className="mode-box-desc">{m.desc}</p>

              <div className="mode-box-footer">
                <button
                  type="button"
                  className={`mode-select-btn ${isCurrentlyActive ? 'btn-engaged' : isSelected ? 'btn-selected' : ''}`}
                  disabled={loading}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMode(m.id);
                    handleToggleContinuity(true, m.id);
                  }}
                >
                  {isCurrentlyActive ? 'Active Protocol' : 'Deploy This Mode'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* EXPANDED TELEMETRY DETAILS FOR CURRENTLY ACTIVE MODE */}
      {crisisState.active && (
        <div className="crisis-telemetry-tray">
          {crisisState.mode === 'SOLAR_COLD_STORAGE' && (
            <div className="solar-facilities-subpanel">
              <div className="subpanel-header">
                <Sun size={16} className="text-amber" />
                <span className="font-bold">Interim Solar Cold-Storage Pods Telemetry (3 Facilities)</span>
                <span className="status-live-chip">Auto-Rerouting Live</span>
              </div>
              <div className="facilities-grid">
                {(crisisState.solarFacilities?.length > 0 ? crisisState.solarFacilities : [
                  { name: 'Central Delhi Solar Cold-Storage Microgrid', tempC: 4.0, capacityPortions: 800, backupPower: '15kW Rooftop Solar + LiFePO4 Pack' },
                  { name: 'South NCR Agritech Solar Pod', tempC: 3.5, capacityPortions: 600, backupPower: '20kW Microgrid Hybrid Unit' },
                  { name: 'North Delhi Community Solar Vault', tempC: 4.2, capacityPortions: 500, backupPower: '12kW Solar Inverter Array' }
                ]).map((fac, i) => (
                  <div key={i} className="facility-pill-card">
                    <div className="flex justify-between items-center mb-1">
                      <strong className="fac-name">{fac.name}</strong>
                      <span className="temp-badge text-mono">❄️ {fac.tempC}°C</span>
                    </div>
                    <div className="fac-metrics">
                      <span>Capacity: <strong>{fac.capacityPortions} portions</strong></span>
                      <span className="text-muted text-xs block mt-1">{fac.backupPower}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {crisisState.mode === 'MESH_SMS_FALLBACK' && (
            <div className="mesh-sms-subpanel">
              <div className="subpanel-header">
                <Radio size={16} className="text-sky-500" />
                <span className="font-bold">Simulated LoRa & Offline SMS Broadcast Feed</span>
                <span className="status-live-chip">5 Verified NGOs Reached</span>
              </div>
              <div className="sms-feed-stream">
                {(crisisState.smsDispatches?.length > 0 ? crisisState.smsDispatches : [
                  { ngoName: 'Robin Food Trust', phone: '+91-9811001100', meshPacketId: 'MESH-7A8B9C', status: 'CONFIRMED' },
                  { ngoName: 'Feeding Hope Foundation', phone: '+91-9811002200', meshPacketId: 'MESH-2E4F6A', status: 'CONFIRMED' },
                  { ngoName: 'Annapurna Seva Kendra', phone: '+91-9811003300', meshPacketId: 'MESH-9C1D3E', status: 'CONFIRMED' }
                ]).slice(0, 3).map((sms, i) => (
                  <div key={i} className="sms-stream-item">
                    <span className="sms-time text-mono">PACKET {sms.meshPacketId || 'LORA-868'}</span>
                    <span className="sms-target">To: <strong>{sms.ngoName}</strong> ({sms.phone})</span>
                    <span className="sms-payload">[AnnSetu MESH] Food radar waypoint alert dispatched via offline cellular packet.</span>
                    <span className="sms-status-tag">SENT</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {crisisState.mode === 'COMMUNITY_SWARM' && (
            <div className="community-swarm-subpanel">
              <div className="subpanel-header">
                <Users size={16} className="text-emerald-500" />
                <span className="font-bold">Decentralized Local Volunteer Micro-Swarm Deployment (78 Runners)</span>
                <span className="status-live-chip">Foot & Bicycle Couriers Active</span>
              </div>
              <div className="swarm-zones-grid">
                {(crisisState.swarmZones?.length > 0 ? crisisState.swarmZones : [
                  { zone: 'Zone 1: Central Commercial Corridor', volunteers: 26, transport: 'Bicycle Couriers & Foot Messengers' },
                  { zone: 'Zone 2: South Delhi Residential Clusters', volunteers: 34, transport: 'E-Cargo Bikes & Micro-Rickshaws' },
                  { zone: 'Zone 3: East NCR Community Hubs', volunteers: 22, transport: 'Localized Foot Runners & Handcarts' }
                ]).map((zone, i) => (
                  <div key={i} className="swarm-zone-card">
                    <div className="font-bold text-sm text-slate-800">{zone.zone}</div>
                    <div className="text-emerald-700 font-bold text-lg my-1">{zone.volunteers} Volunteers</div>
                    <div className="text-xs text-slate-500">{zone.transport}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * DynamicFeatureSlot — Pluggable component container.
 * Injected seamlessly into Navbar, Admin Dashboard, and Host Dashboard.
 */
export default function DynamicFeatureSlot({ slotName = 'default', contextData = {} }) {
  const { socket } = useSocket();
  const [crisisActive, setCrisisActive] = useState(false);
  const [crisisMode, setCrisisMode] = useState(null);

  useEffect(() => {
    // Check initial status
    fetch('/api/crisis/status')
      .then((res) => res.json())
      .then((data) => {
        setCrisisActive(!!data.active);
        setCrisisMode(data.mode);
      })
      .catch(() => {});

    if (!socket) return;
    socket.on('crisis:status-updated', (data) => {
      setCrisisActive(!!data.active);
      setCrisisMode(data.mode);
    });

    return () => {
      socket.off('crisis:status-updated');
    };
  }, [socket]);

  // Navbar slot shows a sleek resilience status pill
  if (slotName === 'navbar') {
    return (
      <div className="dynamic-resilience-badge">
        {crisisActive ? (
          <span className="navbar-resilience-pill active" title="Crisis Continuity Protocol Active">
            <span className="pulse-amber-dot" />
            <Zap size={13} className="text-amber inline mr-1" />
            <span className="pill-text font-bold">Resilience Active: {crisisMode?.replace(/_/g, ' ')}</span>
          </span>
        ) : (
          <span className="navbar-resilience-pill standby" title="Crisis Continuity & Resilience Standby">
            <Shield size={13} className="text-teal inline mr-1" />
            <span className="pill-text">Resilience Standby</span>
          </span>
        )}
      </div>
    );
  }

  // Dashboard slots render the full interactive Crisis Continuity Card
  if (slotName === 'admin' || slotName === 'host' || slotName === 'dashboard') {
    return <CrisisContinuityCard portalType={slotName} />;
  }

  return null;
}
