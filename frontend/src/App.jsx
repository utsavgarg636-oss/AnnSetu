import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import DemoTimeWarpDock from './components/DemoTimeWarpDock';
import AdminDashboard from './pages/AdminDashboard';
import HostDashboard from './pages/HostDashboard';
import NgoDashboard from './pages/NgoDashboard';
import { Shield, Utensils, Building2, ArrowRight, Sparkles, CheckCircle2, Zap } from 'lucide-react';

function HomeLanding() {
  return (
    <div className="landing-container">
      <div className="landing-hero">
        <div className="landing-badge">
          <Sparkles size={14} className="text-emerald inline mr-1" />
          <span>AnnSetu (अन्नसेतु) — Monorepo Food Rescue Platform</span>
        </div>
        <h1 className="landing-title">
          Hyper-Local Surplus Food Rescue Network
        </h1>
        <p className="landing-sub">
          Connecting banquets, verified NGOs, and admin operations with mathematical ML spoilage gating and real-time Socket.io dispatch synchronization.
        </p>

        <div className="portals-launch-grid">
          {/* Admin Command Portal Card */}
          <Link to="/admin" className="portal-card admin-card">
            <div className="portal-card-header">
              <div className="portal-icon admin-icon">
                <Shield size={24} />
              </div>
              <span className="portal-theme-pill admin-theme">Navy & Teal</span>
            </div>
            <h3 className="portal-card-title">1. Admin Command Center</h3>
            <p className="portal-card-desc">
              High-density telemetry radar, pending NGO validation queue, and immutable audit logs.
            </p>
            <div className="portal-card-footer text-teal">
              <span>Launch /admin</span>
              <ArrowRight size={16} />
            </div>
          </Link>

          {/* Event Host Portal Card */}
          <Link to="/host" className="portal-card host-card">
            <div className="portal-card-header">
              <div className="portal-icon host-icon">
                <Utensils size={24} />
              </div>
              <span className="portal-theme-pill host-theme">Forest & Cream</span>
            </div>
            <h3 className="portal-card-title">2. Event Host Dispatch</h3>
            <p className="portal-card-desc">
              2-minute surplus donation form, ML spoilage safety gate check, and 4-digit OTP vault.
            </p>
            <div className="portal-card-footer text-forest">
              <span>Launch /host</span>
              <ArrowRight size={16} />
            </div>
          </Link>

          {/* NGO Portal Card */}
          <Link to="/ngo" className="portal-card ngo-card">
            <div className="portal-card-header">
              <div className="portal-icon ngo-icon">
                <Building2 size={24} />
              </div>
              <span className="portal-theme-pill ngo-theme">Royal Indigo</span>
            </div>
            <h3 className="portal-card-title">3. Verified NGO Radar</h3>
            <p className="portal-card-desc">
              Geofenced live food radar, verified identity switcher, and secure OTP + photo validation.
            </p>
            <div className="portal-card-footer text-royal">
              <span>Launch /ngo</span>
              <ArrowRight size={16} />
            </div>
          </Link>
        </div>

        {/* Feature Highlights Bento */}
        <div className="landing-features-bento">
          <div className="bento-feature">
            <Zap size={18} className="feature-icon text-amber" />
            <div>
              <strong>4-Tier Auto Escalation</strong>
              <p>T+0 (3km) → T+10 (8km) → T+25 (Smart Split) → T+40 (Admin Fallback)</p>
            </div>
          </div>
          <div className="bento-feature">
            <Shield size={18} className="feature-icon text-emerald" />
            <div>
              <strong>Verified NGO Restriction</strong>
              <p>Strictly approved & FSSAI certified NGOs receive live dispatch opportunities</p>
            </div>
          </div>
          <div className="bento-feature">
            <Sparkles size={18} className="feature-icon text-teal" />
            <div>
              <strong>ML Spoilage Safety Gate</strong>
              <p>Q10 temp decay & bulk penalties prevent spoiled food from entering distribution</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <div className="annsetu-app">
          <Navbar />
          <main className="app-main-content">
            <Routes>
              <Route path="/" element={<HomeLanding />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/host" element={<HostDashboard />} />
              <Route path="/ngo" element={<NgoDashboard />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          {/* Floating Demo Time-Warp Dock present across all views for seamless pitch demonstrations */}
          <DemoTimeWarpDock />
        </div>
      </BrowserRouter>
    </SocketProvider>
  );
}
