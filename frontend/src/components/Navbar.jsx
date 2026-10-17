import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import DynamicFeatureSlot from '../extensions/DynamicFeatureSlot';
import { Leaf, Shield, User, Building2, Activity, Wifi, WifiOff } from 'lucide-react';

export default function Navbar() {
  const { connected, impactStats } = useSocket();
  const location = useLocation();

  const getPortalTheme = () => {
    if (location.pathname.startsWith('/admin')) return 'theme-admin';
    if (location.pathname.startsWith('/host')) return 'theme-host';
    if (location.pathname.startsWith('/ngo')) return 'theme-ngo';
    return '';
  };

  return (
    <header className={`annsetu-navbar ${getPortalTheme()}`}>
      <div className="navbar-top-banner">
        <div className="ticker-container">
          <div className="ticker-label">
            <span className="ticker-live-dot" /> LIVE IMPACT
          </div>
          <div className="ticker-items">
            <div className="ticker-pill">
              <span className="pill-title">🍲 Rescued Meals:</span>
              <strong className="pill-val">{Number(impactStats.totalPortionsRescued).toLocaleString()}</strong>
            </div>
            <div className="ticker-divider">•</div>
            <div className="ticker-pill">
              <span className="pill-title">🌱 CO₂e Offset:</span>
              <strong className="pill-val text-emerald">{impactStats.co2ePrevented} kg</strong>
            </div>
            <div className="ticker-divider">•</div>
            <div className="ticker-pill">
              <span className="pill-title">💨 Methane Averted:</span>
              <strong className="pill-val text-teal">{impactStats.methanePrevented} kg</strong>
            </div>
            <div className="ticker-divider">•</div>
            <div className="ticker-pill">
              <span className="pill-title">🛡️ Trust Index:</span>
              <strong className="pill-val text-gold">★ {impactStats.trustIndex}</strong>
            </div>
          </div>
        </div>

        <div className="socket-status-pill">
          {connected ? (
            <span className="status-online" title="Real-time WebSocket sync connected">
              <Wifi size={13} className="inline mr-1" />
              <span className="pulse-dot green" />
              <span>Synced (5000)</span>
            </span>
          ) : (
            <span className="status-offline" title="Connecting to WebSocket...">
              <WifiOff size={13} className="inline mr-1" />
              <span className="pulse-dot red" />
              <span>Offline</span>
            </span>
          )}
        </div>
      </div>

      <nav className="navbar-main">
        <div className="brand-zone">
          <NavLink to="/" className="brand-link">
            <div className="brand-logo-wrap">
              <span className="brand-icon">🍚</span>
              <Leaf size={16} className="brand-leaf-badge" />
            </div>
            <div className="brand-text">
              <div className="brand-hindi">अन्नसेतु</div>
              <div className="brand-latin">AnnSetu <span className="brand-sub">Platform</span></div>
            </div>
          </NavLink>
        </div>

        <div className="portal-navigation">
          <NavLink
            to="/admin"
            className={({ isActive }) => `portal-nav-item admin-tab ${isActive ? 'active' : ''}`}
          >
            <Shield size={16} />
            <span>Admin Command</span>
          </NavLink>

          <NavLink
            to="/host"
            className={({ isActive }) => `portal-nav-item host-tab ${isActive ? 'active' : ''}`}
          >
            <User size={16} />
            <span>Event Host</span>
          </NavLink>

          <NavLink
            to="/ngo"
            className={({ isActive }) => `portal-nav-item ngo-tab ${isActive ? 'active' : ''}`}
          >
            <Building2 size={16} />
            <span>NGO Portal</span>
          </NavLink>
        </div>

        <div className="navbar-actions">
          <DynamicFeatureSlot slotName="navbar" />
        </div>
      </nav>
    </header>
  );
}
