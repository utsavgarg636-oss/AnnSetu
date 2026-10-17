import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import LiveMap from '../components/LiveMap';
import {
  Shield, CheckCircle2, Clock, AlertTriangle, Users, Utensils,
  Leaf, Activity, RefreshCw, ExternalLink, Award, FileText,
  Search, Check, Zap, Flame, Radio
} from 'lucide-react';

export default function AdminDashboard() {
  const { socket, impactStats, refreshStats } = useSocket();

  const [stats, setStats] = useState({
    totalNgos: 5,
    approvedNgos: 5,
    pendingNgos: 0,
    totalPosts: 0,
    activePosts: 0,
    completedRescues: 0,
    totalPortionsRescued: 0,
    co2ePrevented: '0.0',
    trustIndex: '4.8'
  });

  const [pendingNgos, setPendingNgos] = useState([]);
  const [allNgos, setAllNgos] = useState([]);
  const [posts, setPosts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activePost, setActivePost] = useState(null);
  const [activeTier, setActiveTier] = useState(0);
  const [approvingId, setApprovingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [logFilter, setLogFilter] = useState('ALL');

  // Fetch admin dashboard data
  const fetchAllData = async () => {
    try {
      const [statsRes, pendingRes, ngosRes, postsRes, logsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/ngos/pending'),
        fetch('/api/admin/ngos'),
        fetch('/api/admin/posts'),
        fetch('/api/admin/audit-logs?limit=40')
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (pendingRes.ok) setPendingNgos(await pendingRes.json());
      if (ngosRes.ok) setAllNgos(await ngosRes.json());
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData);
        if (postsData.length > 0 && !activePost) {
          setActivePost(postsData[0]);
          setActiveTier(postsData[0].escalation_tier || 0);
        }
      }
      if (logsRes.ok) setAuditLogs(await logsRes.json());
    } catch (err) {
      console.warn('Admin fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Real-time socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('admin:new-registration', (data) => {
      setToastMessage(`🛡️ New NGO Registration received: ${data.name}`);
      fetchAllData();
    });

    socket.on('post:created', () => {
      fetchAllData();
    });

    socket.on('escalation:update', (data) => {
      setActiveTier(data.tier);
      fetchAllData();
    });

    socket.on('handover:verified', () => {
      fetchAllData();
      refreshStats();
    });

    return () => {
      socket.off('admin:new-registration');
      socket.off('post:created');
      socket.off('escalation:update');
      socket.off('handover:verified');
    };
  }, [socket]);

  // One-Click NGO Approval
  const handleApproveNgo = async (ngoId) => {
    setApprovingId(ngoId);
    setToastMessage('');
    try {
      const res = await fetch(`/api/admin/ngos/${ngoId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setToastMessage(`✅ ${data.message}`);
        fetchAllData();
        refreshStats();
      } else {
        setToastMessage(`❌ Error: ${data.error || 'Approval failed'}`);
      }
    } catch (err) {
      setToastMessage(`❌ Network error: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (logFilter === 'ESCALATION') return log.action.includes('ESCALATION');
    if (logFilter === 'NGO') return log.action.includes('NGO');
    if (logFilter === 'HANDOVER') return log.action.includes('HANDOVER') || log.action.includes('RESCUE');
    return true;
  });

  return (
    <div className="admin-page-container">
      {/* Top Header & Operational Status */}
      <div className="admin-header-bar">
        <div className="admin-title-group">
          <div className="admin-command-tag">
            <Shield size={14} className="text-teal inline mr-1" />
            <span>Operations & Compliance Command Center • Port 5000</span>
          </div>
          <h1 className="admin-heading">Delhi NCR Food Rescue Command</h1>
        </div>

        <div className="admin-quick-links">
          <a href="/host" target="_blank" rel="noreferrer" className="quick-portal-link host-btn">
            <span>Open Event Host (/host)</span>
            <ExternalLink size={14} />
          </a>
          <a href="/ngo" target="_blank" rel="noreferrer" className="quick-portal-link ngo-btn">
            <span>Open NGO Portal (/ngo)</span>
            <ExternalLink size={14} />
          </a>
          <button className="admin-refresh-all-btn" onClick={fetchAllData} title="Refresh Live Data">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="admin-toast-banner">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="toast-dismiss">✕</button>
        </div>
      )}

      {/* KPI METRIC TILES */}
      <div className="admin-kpi-grid">
        <div className="kpi-card teal">
          <div className="kpi-icon-wrap"><Utensils size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-num">{Number(stats.totalPortionsRescued).toLocaleString()}</span>
            <span className="kpi-label">Meals Rescued</span>
          </div>
          <div className="kpi-sub">Total verified handovers</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-icon-wrap"><Leaf size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.co2ePrevented} kg</span>
            <span className="kpi-label">CO₂e Offset</span>
          </div>
          <div className="kpi-sub">2.5 kg CO₂e per meal</div>
        </div>

        <div className="kpi-card navy">
          <div className="kpi-icon-wrap"><Users size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.approvedNgos} / {stats.totalNgos}</span>
            <span className="kpi-label">Verified NGOs</span>
          </div>
          <div className="kpi-sub">100% FSSAI Certified</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-icon-wrap"><Activity size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-num">{stats.activePosts}</span>
            <span className="kpi-label">Active Dispatches</span>
          </div>
          <div className="kpi-sub">In live matching radar</div>
        </div>

        <div className="kpi-card purple">
          <div className="kpi-icon-wrap"><Award size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-num">★ {stats.trustIndex}</span>
            <span className="kpi-label">Network Trust Index</span>
          </div>
          <div className="kpi-sub">Composite verification rating</div>
        </div>
      </div>

      {/* PENDING NGO APPROVAL QUEUE */}
      {pendingNgos.length > 0 && (
        <div className="admin-bento-card approval-queue-card">
          <div className="card-header-bar">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber" />
              <h3 className="card-title">Pending NGO Validation Queue ({pendingNgos.length})</h3>
            </div>
            <span className="urgent-badge">Action Required</span>
          </div>

          <div className="table-responsive">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>Organization Name</th>
                  <th>Official Email</th>
                  <th>FSSAI License ID</th>
                  <th>Phone</th>
                  <th>Registration Date</th>
                  <th>One-Click Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingNgos.map((ngo) => (
                  <tr key={ngo.id} className="pending-row">
                    <td><strong>{ngo.name}</strong></td>
                    <td className="text-mono">{ngo.email}</td>
                    <td>
                      <span className="fssai-chip pending">{ngo.fssai_id || 'FSSAI-PENDING'}</span>
                    </td>
                    <td>{ngo.phone}</td>
                    <td>{new Date(ngo.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="approve-ngo-btn"
                        disabled={approvingId === ngo.id}
                        onClick={() => handleApproveNgo(ngo.id)}
                      >
                        {approvingId === ngo.id ? 'Activating...' : '✅ Approve & Activate NGO'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TELEMETRY MAP & AUDIT LOGS ROW */}
      <div className="admin-grid-2-col">
        {/* Left: Interactive Telemetry Map */}
        <div className="admin-bento-card map-wrapper-card">
          <LiveMap
            activePost={activePost}
            activeTier={activeTier}
            onSelectPost={(p) => {
              setActivePost(p);
              setActiveTier(p.escalation_tier || 0);
            }}
          />
        </div>

        {/* Right: Immutable Real-Time Audit Log Stream */}
        <div className="admin-bento-card audit-logs-card">
          <div className="card-header-bar">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-teal" />
              <h3 className="card-title">Immutable Audit Log Stream</h3>
            </div>
            <div className="log-filters">
              <button
                className={`filter-chip ${logFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setLogFilter('ALL')}
              >
                All ({auditLogs.length})
              </button>
              <button
                className={`filter-chip ${logFilter === 'ESCALATION' ? 'active' : ''}`}
                onClick={() => setLogFilter('ESCALATION')}
              >
                Escalations
              </button>
              <button
                className={`filter-chip ${logFilter === 'HANDOVER' ? 'active' : ''}`}
                onClick={() => setLogFilter('HANDOVER')}
              >
                Handovers
              </button>
            </div>
          </div>

          <div className="audit-logs-stream">
            {filteredLogs.map((log) => {
              let tagColor = 'gray';
              if (log.action.includes('ESCALATION')) tagColor = 'amber';
              if (log.action.includes('APPROVED') || log.action.includes('VERIFIED')) tagColor = 'green';
              if (log.action.includes('REGISTERED')) tagColor = 'blue';
              if (log.action.includes('FALLBACK')) tagColor = 'red';

              return (
                <div key={log.id} className="audit-log-item">
                  <div className="log-time">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <div className="log-content">
                    <span className={`log-action-tag ${tagColor}`}>{log.action}</span>
                    <span className="log-entity">[{log.entity_type} #{log.entity_id || 'SYS'}]</span>
                    <p className="log-details">{log.details}</p>
                  </div>
                </div>
              );
            })}

            {filteredLogs.length === 0 && (
              <div className="empty-logs">No audit records found for this filter.</div>
            )}
          </div>
        </div>
      </div>

      {/* CONNECTED VERIFIED NGOS TABLE */}
      <div className="admin-bento-card master-ngos-card">
        <div className="card-header-bar">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-navy" />
            <h3 className="card-title">Connected Delhi NCR NGOs Directory</h3>
          </div>
          <span className="card-subtitle">{allNgos.length} registered organizations</span>
        </div>

        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Organization Name</th>
                <th>Type</th>
                <th>Max Capacity</th>
                <th>Trust Score</th>
                <th>Rescues Done</th>
                <th>Avg Speed</th>
                <th>FSSAI License</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allNgos.map((ngo) => (
                <tr key={ngo.id}>
                  <td>#{ngo.id}</td>
                  <td><strong>{ngo.name}</strong></td>
                  <td>
                    <span className={`ngo-type-badge ${ngo.type === 'BIO_FALLBACK' ? 'bio' : 'standard'}`}>
                      {ngo.type === 'BIO_FALLBACK' ? 'Biogas Fallback' : 'Standard Rescue'}
                    </span>
                  </td>
                  <td>{ngo.max_capacity} portions</td>
                  <td>
                    <span className="text-gold font-bold">★ {Number(ngo.trust_score).toFixed(1)}</span>
                  </td>
                  <td>{ngo.completed_rescues}</td>
                  <td>⚡ {ngo.avg_response_mins} mins</td>
                  <td className="text-mono">{ngo.fssai_id || 'PENDING'}</td>
                  <td>
                    {ngo.is_approved ? (
                      <span className="status-badge verified">
                        <CheckCircle2 size={12} className="inline mr-1" />
                        Verified Active
                      </span>
                    ) : (
                      <span className="status-badge pending">
                        <Clock size={12} className="inline mr-1" />
                        Reviewing
                      </span>
                    )}
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
