import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import TrustBadges from '../components/TrustBadges';
import confetti from 'canvas-confetti';
import {
  Building2, ShieldCheck, MapPin, Clock, CheckCircle2, XCircle,
  KeyRound, Camera, Award, ChevronDown, UserCheck, AlertTriangle,
  Send, RefreshCw, Sparkles, Flame, Check
} from 'lucide-react';

export default function NgoDashboard() {
  const { socket, refreshStats } = useSocket();

  // NGO Identity & Auth State
  const [verifiedNgos, setVerifiedNgos] = useState([]);
  const [selectedNgoId, setSelectedNgoId] = useState(1);
  const [currentNgo, setCurrentNgo] = useState(null);
  const [authMode, setAuthMode] = useState('LOGGED_IN'); // 'LOGGED_IN' | 'REGISTER'
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    password: 'password123',
    phone: '+91-9811009900',
    fssai_id: 'FSSAI-DL-2024-999'
  });

  // Food Feed & Handovers State
  const [foodFeed, setFoodFeed] = useState([]);
  const [myHandovers, setMyHandovers] = useState([]);
  const [acceptingPostId, setAcceptingPostId] = useState(null);
  const [verifyModal, setVerifyModal] = useState({ open: false, handover: null });
  const [otpInput, setOtpInput] = useState('');
  const [photoSelected, setPhotoSelected] = useState('https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=500&q=80');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch verified NGOs for identity switcher
  const fetchVerifiedNgos = async () => {
    try {
      const res = await fetch('/api/ngo/verified-list');
      if (res.ok) {
        const data = await res.json();
        setVerifiedNgos(data);
        if (data.length > 0 && !currentNgo) {
          fetchNgoProfile(selectedNgoId || data[0].id);
        }
      }
    } catch (err) {
      console.warn('Error fetching verified NGOs:', err);
    }
  };

  // Fetch specific NGO profile
  const fetchNgoProfile = async (id) => {
    try {
      const res = await fetch(`/api/ngo/profile/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentNgo(data);
        setSelectedNgoId(data.id);
        if (data.is_approved) {
          fetchFoodFeed(data.id);
          fetchHandovers();
        }
      }
    } catch (err) {
      console.warn('Error fetching NGO profile:', err);
    }
  };

  // Fetch geofenced food feed
  const fetchFoodFeed = async (ngoId) => {
    try {
      const res = await fetch(`/api/ngo/feed/${ngoId}`);
      if (res.ok) {
        const data = await res.json();
        setFoodFeed(data);
      }
    } catch (err) {
      console.warn('Error fetching food feed:', err);
    }
  };

  // Fetch active handovers
  const fetchHandovers = async () => {
    try {
      const res = await fetch('/api/admin/handovers');
      if (res.ok) {
        const data = await res.json();
        setMyHandovers(data);
      }
    } catch (err) {
      console.warn('Error fetching handovers:', err);
    }
  };

  useEffect(() => {
    fetchVerifiedNgos();
    const interval = setInterval(() => {
      if (currentNgo?.is_approved) {
        fetchFoodFeed(currentNgo.id);
        fetchHandovers();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [currentNgo?.id, currentNgo?.is_approved]);

  // Socket listener for real-time dispatches
  useEffect(() => {
    if (!socket) return;

    socket.on('post:created', () => {
      if (currentNgo?.id && currentNgo?.is_approved) fetchFoodFeed(currentNgo.id);
    });

    socket.on('ngo:approved', (data) => {
      if (currentNgo?.id === data.ngoId) {
        fetchNgoProfile(data.ngoId);
      }
      fetchVerifiedNgos();
    });

    socket.on('handover:verified', () => {
      fetchHandovers();
      if (currentNgo?.id) fetchNgoProfile(currentNgo.id);
    });

    return () => {
      socket.off('post:created');
      socket.off('ngo:approved');
      socket.off('handover:verified');
    };
  }, [socket, currentNgo?.id]);

  // Switch NGO Identity
  const handleSelectNgo = (id) => {
    setSelectedNgoId(id);
    fetchNgoProfile(id);
  };

  // Register a new NGO
  const handleRegister = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch('/api/ngo/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentNgo({
          ...registerForm,
          id: data.id,
          is_approved: false,
          fssai_verified: false,
          trust_score: 4.0,
          completed_rescues: 0,
          avg_response_mins: 30
        });
        setAuthMode('LOGGED_IN');
        setMessage('🛡️ Account created! Pending Admin approval.');
      } else {
        setMessage(`❌ ${data.error || 'Registration failed'}`);
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`);
    }
  };

  // Accept Rescue Post
  const handleAcceptRescue = async (postId, portions) => {
    if (!currentNgo) return;
    setAcceptingPostId(postId);
    setMessage('');
    try {
      const res = await fetch(`/api/ngo/accept/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ngoId: currentNgo.id,
          portions: portions || 100
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`🎉 Rescue Accepted! Handover #${data.handoverId} active. Pickup driver dispatched.`);
        fetchFoodFeed(currentNgo.id);
        fetchHandovers();
        refreshStats();
      } else {
        setMessage(`❌ ${data.error || 'Failed to accept rescue'}`);
      }
    } catch (err) {
      setMessage(`❌ Network error: ${err.message}`);
    } finally {
      setAcceptingPostId(null);
    }
  };

  // Decline Rescue Post
  const handleDeclineRescue = async (postId) => {
    if (!currentNgo) return;
    try {
      await fetch(`/api/ngo/decline/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngoId: currentNgo.id })
      });
      setMessage('Rescue declined. Auto-escalating to Tier 1.');
      setFoodFeed((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.warn('Decline error:', err);
    }
  };

  // Submit OTP + Photo Proof for Handover Verification
  const handleVerifyHandover = async (e) => {
    e.preventDefault();
    if (!verifyModal.handover) return;
    setVerifyLoading(true);
    setMessage('');

    try {
      const res = await fetch(`/api/ngo/verify/${verifyModal.handover.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp: otpInput,
          photoUrl: photoSelected
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Fire celebration confetti!
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });

        setMessage(`🎉 Verified Successfully! Offset ${data.co2ePrevented} kg CO2e and ${data.methanePrevented} kg Methane!`);
        setVerifyModal({ open: false, handover: null });
        setOtpInput('');
        fetchHandovers();
        fetchNgoProfile(currentNgo.id);
        refreshStats();
      } else {
        setMessage(`❌ ${data.error || 'Invalid OTP code'}`);
      }
    } catch (err) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="ngo-page-container">
      {/* Top Identity & Switcher Bar */}
      <div className="ngo-header-bar">
        <div className="ngo-brand-info">
          <div className="ngo-portal-badge">
            <Building2 size={15} className="inline mr-1" />
            <span>NGO Operational Dispatch & Recovery Radar</span>
          </div>
          <h1 className="ngo-heading">Verified NGO Rescue Command</h1>
        </div>

        {/* Verified NGO Identity Switcher */}
        <div className="ngo-identity-box">
          <div className="identity-label">Active Verified Identity:</div>
          <div className="identity-controls">
            <select
              className="ngo-switcher-select"
              value={selectedNgoId}
              onChange={(e) => handleSelectNgo(parseInt(e.target.value))}
            >
              {verifiedNgos.map((ngo) => (
                <option key={ngo.id} value={ngo.id}>
                  {ngo.name} (★{Number(ngo.trust_score).toFixed(1)}) — {ngo.completed_rescues} rescues
                </option>
              ))}
            </select>
            <button
              className="register-ngo-toggle"
              onClick={() => setAuthMode(authMode === 'REGISTER' ? 'LOGGED_IN' : 'REGISTER')}
            >
              {authMode === 'REGISTER' ? '← Back to Active NGO' : '+ New NGO Reg'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="ngo-toast-banner">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="toast-dismiss">✕</button>
        </div>
      )}

      {/* REGISTER FORM OVERLAY */}
      {authMode === 'REGISTER' && (
        <div className="ngo-register-container">
          <div className="bento-card register-card">
            <div className="card-header-bar">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-royal" />
                <h3 className="card-title">Register New NGO Organization</h3>
              </div>
              <span className="pending-tag">Subject to Admin Review</span>
            </div>

            <p className="register-instruction">
              In accordance with FSSAI Food Safety Act Section 31, all partner NGOs must provide legitimate registration & FSSAI credentials before receiving live dispatch notifications.
            </p>

            <form onSubmit={handleRegister} className="ngo-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    required
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    placeholder="e.g. Delhi Hunger Relief Trust"
                  />
                </div>
                <div className="form-group">
                  <label>Official Email</label>
                  <input
                    type="email"
                    required
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    placeholder="official@ngo.org"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>FSSAI License / Registration ID</label>
                  <input
                    type="text"
                    required
                    value={registerForm.fssai_id}
                    onChange={(e) => setRegisterForm({ ...registerForm, fssai_id: e.target.value })}
                    placeholder="FSSAI-DL-XXXX-XXX"
                  />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="submit-register-btn">
                <Send size={16} />
                <span>Submit NGO Credentials for Verification</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN VALIDATION GATE (Account Under Review) */}
      {currentNgo && !currentNgo.is_approved && authMode !== 'REGISTER' && (
        <div className="ngo-review-gate-card">
          <div className="gate-icon-wrap">
            <ShieldCheck size={42} className="text-amber" />
          </div>
          <h2 className="gate-title">🛡️ Account Under Review</h2>
          <p className="gate-desc">
            Your FSSAI license (<strong>{currentNgo.fssai_id || 'PENDING'}</strong>) and organization documentation are currently being verified by the AnnSetu Admin Operations Team.
          </p>
          <div className="gate-instructions">
            <span>To activate this account in the demo: Switch to the <strong>Admin Command (/admin)</strong> portal and click <strong>[✅ Approve & Activate NGO]</strong>. The portal will unlock automatically via WebSockets!</span>
          </div>
        </div>
      )}

      {/* VERIFIED OPERATIONAL CONTENT (Shown when NGO is approved) */}
      {currentNgo && currentNgo.is_approved && authMode !== 'REGISTER' && (
        <>
          {/* Trust & Capability Badges Bar */}
          <div className="ngo-trust-bar">
            <TrustBadges
              fssaiId={currentNgo.fssai_id}
              isApproved={currentNgo.is_approved}
              fssaiVerified={currentNgo.fssai_verified}
              trustScore={currentNgo.trust_score}
              completedRescues={currentNgo.completed_rescues}
              avgResponseMins={currentNgo.avg_response_mins}
            />
          </div>

          <div className="ngo-main-layout">
            {/* Left Column: Geofenced Available Food Radar / Feed */}
            <div className="ngo-feed-column">
              <div className="feed-header-bar">
                <div className="flex items-center gap-2">
                  <div className="radar-ping-dot" />
                  <h3 className="section-title">Geofenced Surplus Food Radar</h3>
                </div>
                <button
                  className="refresh-btn"
                  onClick={() => fetchFoodFeed(currentNgo.id)}
                  title="Refresh Available Food"
                >
                  <RefreshCw size={14} />
                  <span>Refresh Radar</span>
                </button>
              </div>

              {foodFeed.length === 0 ? (
                <div className="feed-empty-card">
                  <Clock size={32} className="empty-clock-icon" />
                  <h4>No Available Food in Radius</h4>
                  <p>All surplus lots are currently claimed or no active posts within your operational zone. Create a surplus post on <strong>/host</strong> to test matching!</p>
                </div>
              ) : (
                <div className="food-cards-list">
                  {foodFeed.map((post) => {
                    const isAccepting = acceptingPostId === post.id;
                    const isVeg = post.dietary_type === 'Veg';

                    return (
                      <div key={post.id} className="food-rescue-card">
                        <div className="food-card-top">
                          <div className="food-meta">
                            <span className={`diet-badge ${isVeg ? 'veg' : 'nonveg'}`}>
                              {isVeg ? '🥬 VEG' : '🍗 NON-VEG'}
                            </span>
                            <span className="distance-badge">
                              <MapPin size={12} className="inline mr-1" />
                              {post.distance_km} km away
                            </span>
                            <span className="tier-tag">
                              Tier {post.escalation_tier || 0}
                            </span>
                          </div>

                          <div className="food-hours-countdown">
                            <Clock size={13} className="inline mr-1 text-royal" />
                            <strong>{post.remaining_safe_hours || 3.0}h</strong> safe window
                          </div>
                        </div>

                        <div className="food-card-body">
                          <h4 className="food-item-name">{post.food_type}</h4>
                          <div className="food-host-info">
                            <span>From: <strong>{post.host_name}</strong> ({post.event_name})</span>
                            <span className="food-address">{post.address}</span>
                          </div>

                          <div className="portions-callout">
                            <span className="portions-num">{post.remaining_portions}</span>
                            <span className="portions-label">portions available</span>
                            <span className="portions-total">(Total: {post.total_portions})</span>
                          </div>
                        </div>

                        <div className="food-card-actions">
                          <button
                            className="accept-rescue-btn"
                            disabled={isAccepting}
                            onClick={() => handleAcceptRescue(post.id, post.remaining_portions)}
                          >
                            {isAccepting ? 'Accepting...' : '✅ Accept Rescue & Dispatch'}
                          </button>
                          <button
                            className="decline-rescue-btn"
                            onClick={() => handleDeclineRescue(post.id)}
                            title="Decline and trigger radius expand"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Active Rescue Handovers & OTP Verification Cards */}
            <div className="ngo-handovers-column">
              <div className="feed-header-bar">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-royal" />
                  <h3 className="section-title">My Active Handovers & Pickups</h3>
                </div>
                <span className="badge-count">
                  {myHandovers.filter((h) => h.ngo_id === currentNgo.id).length} Active
                </span>
              </div>

              <div className="handovers-list">
                {myHandovers
                  .filter((h) => h.ngo_id === currentNgo.id)
                  .map((handover) => {
                    const isVerified = handover.status === 'VERIFIED';

                    return (
                      <div key={handover.id} className={`handover-card ${isVerified ? 'verified' : 'pending'}`}>
                        <div className="handover-top">
                          <div>
                            <span className="handover-id">Handover #{handover.id}</span>
                            <h4 className="handover-item">{handover.food_type}</h4>
                            <span className="handover-venue">Host: {handover.host_name}</span>
                          </div>
                          <span className={`handover-status-badge ${handover.status.toLowerCase()}`}>
                            {handover.status}
                          </span>
                        </div>

                        <div className="handover-stats-row">
                          <div><strong>{handover.portions_assigned}</strong> Portions</div>
                          <div>Accepted: {new Date(handover.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>

                        {isVerified ? (
                          <div className="handover-complete-banner">
                            <CheckCircle2 size={16} className="text-emerald inline mr-1" />
                            <span>Successfully verified & rescued!</span>
                          </div>
                        ) : (
                          <button
                            className="verify-pickup-btn"
                            onClick={() => setVerifyModal({ open: true, handover })}
                          >
                            <KeyRound size={15} />
                            <span>Input 4-Digit Host PIN & Photo</span>
                          </button>
                        )}
                      </div>
                    );
                  })}

                {myHandovers.filter((h) => h.ngo_id === currentNgo.id).length === 0 && (
                  <div className="empty-handovers-card">
                    <p>No active rescues claimed yet. Click <strong>[Accept Rescue]</strong> on the left to claim surplus portions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* SECURE OTP & PHOTO VERIFICATION MODAL */}
      {verifyModal.open && verifyModal.handover && (
        <div className="modal-overlay">
          <div className="otp-modal-card">
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <KeyRound size={20} className="text-royal" />
                <h3 className="modal-title">Complete Rescue Handover Verification</h3>
              </div>
              <button
                className="modal-close"
                onClick={() => setVerifyModal({ open: false, handover: null })}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-details-callout">
                <div>Post #{verifyModal.handover.post_id} • <strong>{verifyModal.handover.food_type}</strong></div>
                <div>Host: <strong>{verifyModal.handover.host_name}</strong></div>
                <div>Portions: <strong>{verifyModal.handover.portions_assigned}</strong></div>
              </div>

              <form onSubmit={handleVerifyHandover}>
                <div className="form-group">
                  <label className="font-bold">Enter 4-Digit OTP PIN from Host Dashboard:</label>
                  <p className="field-hint">Ask the event host for the secure PIN shown in their 4-Digit OTP Vault.</p>
                  <input
                    type="text"
                    maxLength="4"
                    required
                    pattern="[0-9]{4}"
                    placeholder="• • • •"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="otp-code-input"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="font-bold flex items-center gap-1.5">
                    <Camera size={16} />
                    <span>Food Pickup Proof Photo:</span>
                  </label>
                  <div className="photo-preview-box">
                    <img src={photoSelected} alt="Handover proof" className="proof-img" />
                    <div className="photo-tag">FSSAI Packaging Check Confirmed</div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={verifyLoading || otpInput.length !== 4}
                  className="modal-verify-submit-btn"
                >
                  {verifyLoading ? 'Validating Cryptographic PIN...' : '✅ Validate OTP & Complete Handover'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
