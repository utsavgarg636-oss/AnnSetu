import React from 'react';
import { ShieldCheck, Award, Zap, CheckCircle2, HeartHandshake } from 'lucide-react';

export default function TrustBadges({
  fssaiId,
  isApproved = true,
  fssaiVerified = true,
  trustScore = 4.8,
  completedRescues = 0,
  avgResponseMins = 15,
  compact = false
}) {
  if (compact) {
    return (
      <div className="trust-badge-compact">
        <span className="badge-fssai" title={`FSSAI Verified: ${fssaiId || 'DL-10012024'}`}>
          <ShieldCheck size={13} className="text-emerald-500 inline mr-1" />
          FSSAI Verified
        </span>
        <span className="badge-rating" title="Composite Trust Index">
          ★ {Number(trustScore).toFixed(1)}
        </span>
      </div>
    );
  }

  return (
    <div className="trust-badge-container">
      {/* FSSAI Certification */}
      <div className={`trust-card ${fssaiVerified ? 'verified' : 'pending'}`}>
        <div className="trust-card-icon">
          <ShieldCheck size={20} />
        </div>
        <div className="trust-card-info">
          <div className="trust-card-title flex items-center gap-1">
            <span>FSSAI License</span>
            {fssaiVerified ? (
              <CheckCircle2 size={13} className="verified-icon" />
            ) : (
              <span className="pending-tag">Reviewing</span>
            )}
          </div>
          <div className="trust-card-sub text-mono">
            {fssaiId || 'FSSAI-DL-PENDING'}
          </div>
        </div>
      </div>

      {/* Trust Score */}
      <div className="trust-card rating">
        <div className="trust-card-icon gold">
          <Award size={20} />
        </div>
        <div className="trust-card-info">
          <div className="trust-card-title">Trust Rating</div>
          <div className="trust-card-sub font-bold">
            ★ {Number(trustScore).toFixed(1)} / 5.0
          </div>
        </div>
      </div>

      {/* Response Speed */}
      <div className="trust-card speed">
        <div className="trust-card-icon cyan">
          <Zap size={20} />
        </div>
        <div className="trust-card-info">
          <div className="trust-card-title">Avg Response</div>
          <div className="trust-card-sub">
            ⚡ {avgResponseMins} mins
          </div>
        </div>
      </div>

      {/* Completed Rescues */}
      <div className="trust-card rescues">
        <div className="trust-card-icon purple">
          <HeartHandshake size={20} />
        </div>
        <div className="trust-card-info">
          <div className="trust-card-title">Rescues Done</div>
          <div className="trust-card-sub font-bold">
            {completedRescues} meals
          </div>
        </div>
      </div>
    </div>
  );
}
