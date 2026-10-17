import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import {
  Utensils, Sparkles, Clock, Thermometer, ShieldCheck, AlertCircle,
  Copy, Check, Send, MapPin, Phone, RefreshCw, KeyRound, CheckCircle2,
  ChevronRight, ArrowRight, Flame
} from 'lucide-react';

export default function HostDashboard() {
  const { socket } = useSocket();

  // Form State
  const [formData, setFormData] = useState({
    host_name: 'The Grand Leela Palace',
    event_name: 'Summer Gala Dinner',
    food_type: 'Cooked Rice & Curry',
    dietary_type: 'Veg',
    total_portions: 250,
    cooked_at: new Date(Date.now() - 45 * 60 * 1000).toISOString().slice(0, 16),
    storage_temp_c: 28,
    lat: 28.6139,
    lng: 77.2090,
    address: 'Chanakyapuri Diplomatic Enclave, New Delhi',
    contact_phone: '+91-9810012345'
  });

  // ML Safety Gate Preview State
  const [mlPreview, setMlPreview] = useState({
    remaining_safe_hours: 3.5,
    safe_until_timestamp: new Date(Date.now() + 3.5 * 3600 * 1000).toISOString(),
    safety_status: 'SAFE',
    model_used: 'ml_service'
  });

  const [loadingML, setLoadingML] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posts, setPosts] = useState([]);
  const [activePost, setActivePost] = useState(null);
  const [otpVault, setOtpVault] = useState({});
  const [copiedOtp, setCopiedOtp] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Fetch host posts
  const fetchPosts = async () => {
    try {
      const res = await fetch('/api/host/posts');
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
        if (data.length > 0 && !activePost) {
          setActivePost(data[0]);
          fetchOtpForPost(data[0].id);
        }
      }
    } catch (err) {
      console.warn('Error fetching host posts:', err);
    }
  };

  // Fetch OTP for active post (Host-Only Vault)
  const fetchOtpForPost = async (postId) => {
    try {
      const res = await fetch(`/api/host/posts/${postId}/otp`);
      if (res.ok) {
        const handovers = await res.json();
        setOtpVault((prev) => ({ ...prev, [postId]: handovers }));
      }
    } catch (err) {
      // Handover might not be accepted yet
    }
  };

  // ML Safety Gate Check as inputs change
  useEffect(() => {
    const checkML = async () => {
      setLoadingML(true);
      try {
        const cookedTime = new Date(formData.cooked_at);
        const hoursSinceCooked = Math.max(0, (Date.now() - cookedTime.getTime()) / (1000 * 60 * 60));

        const res = await fetch('/api/host/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            food_type: formData.food_type,
            dietary_type: formData.dietary_type,
            quantity_portions: parseInt(formData.total_portions) || 100,
            hours_since_cooked: hoursSinceCooked,
            storage_temp_c: parseFloat(formData.storage_temp_c) || 25
          })
        });

        if (res.ok) {
          const data = await res.json();
          setMlPreview(data);
        }
      } catch (err) {
        console.warn('ML preview error:', err);
      } finally {
        setLoadingML(false);
      }
    };

    const timer = setTimeout(checkML, 400);
    return () => clearTimeout(timer);
  }, [formData.food_type, formData.dietary_type, formData.total_portions, formData.cooked_at, formData.storage_temp_c]);

  // Initial load & socket listeners
  useEffect(() => {
    fetchPosts();

    if (!socket) return;

    socket.on('host:otp', (data) => {
      setToastMessage(`🔑 New OTP Generated for Post #${data.postId}: Pickup by ${data.ngoName}`);
      fetchOtpForPost(data.postId);
      fetchPosts();
    });

    socket.on('handover:verified', (data) => {
      setToastMessage(`✅ Food handover verified! Rescued ${data.portions} portions.`);
      fetchPosts();
    });

    socket.on('escalation:update', () => {
      fetchPosts();
    });

    return () => {
      socket.off('host:otp');
      socket.off('handover:verified');
      socket.off('escalation:update');
    };
  }, [socket]);

  // Submit Food Surplus Post
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setToastMessage('');

    try {
      const res = await fetch('/api/host/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setToastMessage(`🎉 ${data.message}`);
        setActivePost(data.post);
        fetchPosts();
      } else {
        setToastMessage(`❌ Error: ${data.error || 'Failed to submit post'}`);
      }
    } catch (err) {
      setToastMessage(`❌ Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedOtp(text);
    setTimeout(() => setCopiedOtp(''), 2500);
  };

  return (
    <div className="host-page-container">
      {/* Botanical Header Banner */}
      <div className="host-header-zone">
        <div className="host-title-group">
          <div className="botanical-tag">
            <Sparkles size={14} className="text-forest inline mr-1" />
            <span>Organic Rescue Portal • 2-Minute Smart Dispatch</span>
          </div>
          <h1 className="host-heading">Event Host Surplus Hub</h1>
          <p className="host-subheading">
            Zero food waste for banquets, weddings, conventions, and corporate caterers. Powered by real-time ML freshness gating.
          </p>
        </div>

        <div className="host-quick-stats">
          <div className="host-stat-box">
            <span className="stat-label">Active Posts</span>
            <span className="stat-num">{posts.filter((p) => p.status !== 'COMPLETED' && p.status !== 'BLOCKED').length}</span>
          </div>
          <div className="host-stat-box">
            <span className="stat-label">Total Rescued</span>
            <span className="stat-num text-forest font-bold">
              {posts.filter((p) => p.status === 'COMPLETED').reduce((sum, p) => sum + p.total_portions, 0)} meals
            </span>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="host-toast-banner">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="toast-dismiss">✕</button>
        </div>
      )}

      {/* Main 2-Column Bento Grid */}
      <div className="host-bento-grid">
        {/* Left Column: 2-Minute Posting Form */}
        <div className="bento-card post-form-card">
          <div className="card-header-bar">
            <div className="flex items-center gap-2">
              <div className="icon-badge forest">
                <Utensils size={18} />
              </div>
              <div>
                <h3 className="card-title">2-Minute Food Dispatch Form</h3>
                <span className="card-subtitle">Connect instantly with 5 verified Delhi NCR NGOs</span>
              </div>
            </div>
            <span className="tag-safe-window">ML Guard Active</span>
          </div>

          <form onSubmit={handleSubmit} className="host-post-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label>Host / Venue Name</label>
                <input
                  type="text"
                  required
                  value={formData.host_name}
                  onChange={(e) => setFormData({ ...formData, host_name: e.target.value })}
                  placeholder="e.g. ITC Maurya Banquet"
                />
              </div>

              <div className="form-group">
                <label>Event Name</label>
                <input
                  type="text"
                  value={formData.event_name}
                  onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                  placeholder="e.g. Corporate Dinner"
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Food Item Category</label>
                <select
                  value={formData.food_type}
                  onChange={(e) => setFormData({ ...formData, food_type: e.target.value })}
                >
                  <option value="Cooked Rice & Curry">Cooked Rice & Curry (Base 4.5h)</option>
                  <option value="Dairy & Sweets">Dairy & Sweets (Base 3.0h)</option>
                  <option value="Bread & Dry Sabzi">Bread & Dry Sabzi (Base 8.0h)</option>
                  <option value="Fried Snacks">Fried Snacks (Base 6.0h)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Dietary Category</label>
                <div className="dietary-selector">
                  <button
                    type="button"
                    className={`diet-btn ${formData.dietary_type === 'Veg' ? 'active-veg' : ''}`}
                    onClick={() => setFormData({ ...formData, dietary_type: 'Veg' })}
                  >
                    🥬 Veg
                  </button>
                  <button
                    type="button"
                    className={`diet-btn ${formData.dietary_type === 'Non-Veg' ? 'active-nonveg' : ''}`}
                    onClick={() => setFormData({ ...formData, dietary_type: 'Non-Veg' })}
                  >
                    🍗 Non-Veg
                  </button>
                </div>
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-group">
                <label>Portions (Servings)</label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  required
                  value={formData.total_portions}
                  onChange={(e) => setFormData({ ...formData, total_portions: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Cooked Timestamp</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.cooked_at}
                  onChange={(e) => setFormData({ ...formData, cooked_at: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Storage Temp (°C)</label>
                <div className="temp-input-wrap">
                  <input
                    type="number"
                    min="4"
                    max="60"
                    step="0.5"
                    value={formData.storage_temp_c}
                    onChange={(e) => setFormData({ ...formData, storage_temp_c: e.target.value })}
                  />
                  <span className="temp-unit">°C</span>
                </div>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label>Pickup Location / Address</label>
                <div className="input-with-icon">
                  <MapPin size={16} className="field-icon" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Delhi NCR Address"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Contact Phone</label>
                <div className="input-with-icon">
                  <Phone size={16} className="field-icon" />
                  <input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+91-98..."
                  />
                </div>
              </div>
            </div>

            {/* LIVE ML FRESHNESS SAFETY GATE PREVIEW */}
            <div className={`ml-safety-preview-box status-${mlPreview.safety_status.toLowerCase()}`}>
              <div className="ml-preview-header">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="shield-icon" />
                  <span className="ml-heading">ML Spoilage Safety Gate Check</span>
                </div>
                <span className={`status-pill pill-${mlPreview.safety_status.toLowerCase()}`}>
                  {mlPreview.safety_status}
                </span>
              </div>

              <div className="ml-metrics-row">
                <div className="ml-metric">
                  <span className="lbl">Remaining Safe Window:</span>
                  <strong className="val">{mlPreview.remaining_safe_hours} Hours</strong>
                </div>
                <div className="ml-metric">
                  <span className="lbl">Safe Until:</span>
                  <strong className="val text-mono">
                    {new Date(mlPreview.safe_until_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
                <div className="ml-metric">
                  <span className="lbl">Engine:</span>
                  <span className="val-tag">{mlPreview.model_used === 'ml_service' ? 'Python FastAPI' : 'JS Fallback'}</span>
                </div>
              </div>

              {mlPreview.safety_status === 'BLOCKED' && (
                <div className="ml-warning-callout">
                  <Flame size={16} className="text-red inline mr-1" />
                  <strong>Food Safety Alert:</strong> Shelf-life window under 30 minutes. Auto-routed to ZeroWaste Biogas & Compost Unit for clean energy conversion.
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`submit-dispatch-btn ${mlPreview.safety_status === 'BLOCKED' ? 'btn-bio-dispatch' : 'btn-food-dispatch'}`}
            >
              {submitting ? (
                <span>Publishing Surplus...</span>
              ) : mlPreview.safety_status === 'BLOCKED' ? (
                <>
                  <Flame size={18} />
                  <span>Divert to Biogas & Compost Facility</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Publish Surplus & Trigger Tier 0 Match (3km)</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Active Status Stepper & 4-Digit OTP Vault */}
        <div className="bento-column-right">
          {/* 4-Digit OTP Vault Card */}
          <div className="bento-card otp-vault-card">
            <div className="card-header-bar">
              <div className="flex items-center gap-2">
                <div className="icon-badge gold">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="card-title">Cryptographic OTP Vault</h3>
                  <span className="card-subtitle">Host-Only PIN delivery (Strictly hidden from NGOs)</span>
                </div>
              </div>
            </div>

            {activePost && otpVault[activePost.id]?.length > 0 ? (
              <div className="otp-cards-container">
                {otpVault[activePost.id].map((handover) => (
                  <div key={handover.id} className="otp-pass-card">
                    <div className="otp-pass-top">
                      <span className="otp-ngo-name">Assigned to: <strong>{handover.ngo_name}</strong></span>
                      <span className="otp-portions-tag">{handover.portions_assigned} portions</span>
                    </div>

                    <div className="otp-pin-display">
                      <span className="pin-digit">{handover.otp_code[0]}</span>
                      <span className="pin-digit">{handover.otp_code[1]}</span>
                      <span className="pin-digit">{handover.otp_code[2]}</span>
                      <span className="pin-digit">{handover.otp_code[3]}</span>

                      <button
                        className="copy-pin-btn"
                        onClick={() => copyToClipboard(handover.otp_code)}
                        title="Copy PIN"
                      >
                        {copiedOtp === handover.otp_code ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                      </button>
                    </div>

                    <div className="otp-security-notice">
                      🛡️ <strong>Verification Protocol:</strong> Provide this 4-digit PIN to the pickup agent when food handover takes place.
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="otp-empty-state">
                <KeyRound size={28} className="empty-key-icon" />
                <p className="empty-title">No Pending Pickup Handover</p>
                <p className="empty-desc">
                  When an approved NGO accepts your post, the secure 4-digit cryptographic PIN will appear here instantly.
                </p>
              </div>
            )}
          </div>

          {/* Active Post Status Stepper */}
          <div className="bento-card status-stepper-card">
            <div className="card-header-bar">
              <h3 className="card-title">Real-Time Dispatch Stepper</h3>
              <button onClick={fetchPosts} className="mini-refresh-btn" title="Refresh">
                <RefreshCw size={14} />
              </button>
            </div>

            {activePost ? (
              <div className="stepper-content">
                <div className="active-post-badge">
                  <span>Tracking Post #{activePost.id}: <strong>{activePost.food_type}</strong> ({activePost.remaining_portions}/{activePost.total_portions} portions)</span>
                </div>

                <div className="stepper-timeline">
                  <div className={`step-item ${activePost ? 'done' : ''}`}>
                    <div className="step-circle"><Check size={12} /></div>
                    <div className="step-details">
                      <strong>1. Food Uploaded</strong>
                      <span>ML Safety Status: {activePost.safety_status}</span>
                    </div>
                  </div>

                  <div className={`step-item ${activePost.escalation_tier >= 0 ? 'active' : ''}`}>
                    <div className="step-circle">{activePost.escalation_tier > 0 ? <Check size={12} /> : '2'}</div>
                    <div className="step-details">
                      <strong>2. Geofenced Radar Match</strong>
                      <span>
                        Tier {activePost.escalation_tier || 0} ({activePost.escalation_tier === 0 ? '3km' : activePost.escalation_tier === 1 ? '8km' : activePost.escalation_tier === 2 ? 'Split' : 'Admin Fallback'})
                      </span>
                    </div>
                  </div>

                  <div className={`step-item ${activePost.status === 'MATCHED' || activePost.status === 'IN_PROGRESS' || activePost.status === 'COMPLETED' ? 'done' : ''}`}>
                    <div className="step-circle">{activePost.status === 'COMPLETED' ? <Check size={12} /> : '3'}</div>
                    <div className="step-details">
                      <strong>3. NGO Accepted Rescue</strong>
                      <span>{activePost.status === 'MATCHED' || activePost.status === 'IN_PROGRESS' ? 'Pickup driver dispatched' : 'Waiting for claim'}</span>
                    </div>
                  </div>

                  <div className={`step-item ${activePost.status === 'COMPLETED' ? 'done' : ''}`}>
                    <div className="step-circle"><CheckCircle2 size={12} /></div>
                    <div className="step-details">
                      <strong>4. Handover & Impact Verified</strong>
                      <span>{activePost.status === 'COMPLETED' ? 'Rescued! CO2e & Methane averted' : 'Pending OTP verification'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="stepper-empty">
                <p>Post surplus food on the left to inspect the live escalation cycle.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Surplus Posts History Table */}
      <div className="bento-card history-table-card">
        <div className="card-header-bar">
          <h3 className="card-title">Event Surplus Activity History</h3>
          <span className="card-subtitle">{posts.length} donation records</span>
        </div>

        <div className="table-responsive">
          <table className="host-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Event / Venue</th>
                <th>Food Item</th>
                <th>Portions</th>
                <th>Remaining Hours</th>
                <th>Escalation Tier</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className={activePost?.id === p.id ? 'active-row' : ''}>
                  <td>#{p.id}</td>
                  <td><strong>{p.event_name || p.host_name}</strong></td>
                  <td>{p.food_type} ({p.dietary_type})</td>
                  <td>{p.remaining_portions} / {p.total_portions}</td>
                  <td>
                    <span className={`safe-pill ${p.safety_status.toLowerCase()}`}>
                      {p.remaining_safe_hours || 3.0}h
                    </span>
                  </td>
                  <td>Tier {p.escalation_tier || 0}</td>
                  <td>
                    <span className={`status-tag status-${p.status.toLowerCase()}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="select-post-btn"
                      onClick={() => {
                        setActivePost(p);
                        fetchOtpForPost(p.id);
                      }}
                    >
                      Inspect Vault
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
