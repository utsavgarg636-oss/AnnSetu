import React, { useState, useEffect } from 'react';
import { FastForward, Clock, ChevronUp, ChevronDown, CheckCircle2, AlertTriangle, Layers, Radio } from 'lucide-react';

export default function DemoTimeWarpDock() {
  const [isOpen, setIsOpen] = useState(true);
  const [posts, setPosts] = useState([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [activeTier, setActiveTier] = useState(0);
  const [loadingTier, setLoadingTier] = useState(null);
  const [message, setMessage] = useState('');

  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/host/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
        if (data.length > 0 && !selectedPostId) {
          setSelectedPostId(data[0].id.toString());
          setActiveTier(data[0].escalation_tier || 0);
        }
      }
    } catch (err) {
      console.warn('Failed to load posts for time-warp dock:', err);
    }
  };

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleTimeWarp = async (tier) => {
    if (!selectedPostId) {
      setMessage('⚠️ Please select or create a surplus post first');
      return;
    }

    setLoadingTier(tier);
    setMessage('');
    try {
      const res = await fetch('/api/host/time-warp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: parseInt(selectedPostId),
          targetTier: tier
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActiveTier(tier);
        setMessage(`⚡ Jumped to Tier ${tier} (${tier === 0 ? '3km' : tier === 1 ? '8km' : tier === 2 ? 'Split' : 'Admin Fallback'})`);
        setTimeout(() => setMessage(''), 4000);
      } else {
        setMessage(`❌ Error: ${data.error || 'Failed to jump tier'}`);
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`);
    } finally {
      setLoadingTier(null);
    }
  };

  const tiers = [
    { tier: 0, label: 'T+0m', radius: '3 km', desc: 'Initial Haversine Radius', color: '#10B981' },
    { tier: 1, label: 'T+10m', radius: '8 km', desc: 'Radius Expansion Ring', color: '#F59E0B' },
    { tier: 2, label: 'T+25m', radius: 'Split', desc: 'Dual-NGO Quantity Split', color: '#8B5CF6' },
    { tier: 3, label: 'T+40m', radius: 'Fallback', desc: 'Admin Volunteer Dispatch', color: '#EF4444' }
  ];

  return (
    <div className={`demo-time-warp-dock ${isOpen ? 'expanded' : 'collapsed'}`}>
      <div className="dock-header" onClick={() => setIsOpen(!isOpen)}>
        <div className="dock-title">
          <FastForward size={16} className="dock-icon text-amber" />
          <span className="dock-brand">Pitch Demo Time-Warp Dock</span>
          <span className="dock-badge">Pitch Control</span>
        </div>
        <button className="dock-toggle-btn" aria-label="Toggle time warp dock">
          {isOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {isOpen && (
        <div className="dock-body">
          <div className="dock-row">
            <label className="dock-label">Target Surplus Post:</label>
            <select
              className="dock-select"
              value={selectedPostId}
              onChange={(e) => {
                setSelectedPostId(e.target.value);
                const selected = posts.find((p) => p.id.toString() === e.target.value);
                if (selected) setActiveTier(selected.escalation_tier || 0);
              }}
            >
              {posts.length === 0 ? (
                <option value="">No active posts (create one on /host)</option>
              ) : (
                posts.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.id} — {p.food_type} ({p.remaining_portions} portions) by {p.host_name} [Tier {p.escalation_tier || 0}]
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="dock-tiers-grid">
            {tiers.map((t) => {
              const isActive = activeTier === t.tier;
              const isLoading = loadingTier === t.tier;
              return (
                <button
                  key={t.tier}
                  className={`dock-tier-btn ${isActive ? 'active' : ''}`}
                  onClick={() => handleTimeWarp(t.tier)}
                  disabled={isLoading || !selectedPostId}
                  style={{
                    borderColor: isActive ? t.color : 'rgba(255,255,255,0.15)',
                    backgroundColor: isActive ? `${t.color}20` : 'rgba(255,255,255,0.04)'
                  }}
                >
                  <div className="tier-badge-row">
                    <span className="tier-label" style={{ color: t.color }}>{t.label}</span>
                    <span className="tier-radius-tag">{t.radius}</span>
                  </div>
                  <div className="tier-desc">{t.desc}</div>
                  {isActive && <div className="tier-active-indicator" style={{ backgroundColor: t.color }}>ACTIVE</div>}
                </button>
              );
            })}
          </div>

          {message && (
            <div className="dock-message">
              {message}
            </div>
          )}

          <div className="dock-footer-note">
            ⚡ Simulates the 4-tier escalation clock instantly for live evaluators
          </div>
        </div>
      )}
    </div>
  );
}
