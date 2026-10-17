# AnnSetu (अन्नसेतु) — Full-Stack Surplus Food Rescue Network

AnnSetu connects event hosts, verified NGOs, and admin command centers with real-time ML food spoilage safety gating and automated 4-tier radius escalation.

---

## 🏛️ Architecture Overview

```text
AnnSetu/
├── backend/        # Express + Socket.io + SQLite (Port 5000)
├── ml-service/     # FastAPI ML Spoilage Predictor (Port 8000)
└── frontend/       # Vite + React 18 + React Router (Port 5173)
```

---

## 🚀 Quick Start Guide

### 1. Start Backend (Express & Socket.io — Port 5000)
```powershell
cd backend
npm install
npm run dev
```

### 2. Start ML Spoilage Service (FastAPI — Port 8000)
*(Note: If Python is offline, the backend automatically switches to its mathematical JS fallback)*
```powershell
cd ml-service
python app.py
```

### 3. Start Frontend (React & Vite — Port 5173)
```powershell
cd frontend
npm install
npm run dev
```

Visit: **http://localhost:5173**

---

## 🧭 Dashboard Portals & UI Isolation

| Portal | Route | Design Theme | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin Command** | `/admin` | Midnight Navy (`#142536`) & Analytical Teal (`#168C87`) | Geofenced telemetry radar map, 1-click NGO approvals, audit logs stream, connected NGO master directory. |
| **Event Host Hub** | `/host` | Warm Cream (`#F7F5EC`) & Forest Green (`#245C43`) | 2-minute donation form, live ML spoilage safety gate check, live status stepper, 4-digit cryptographic OTP vault. |
| **NGO Rescue Radar**| `/ngo` | Pale Lilac (`#F6F4FF`) & Royal Indigo (`#5146A8`) | FSSAI identity switcher dropdown, geofenced available food radar, admin validation gate, OTP + photo verification modal. |

---

## ⚡ Live Pitch Demo Time-Warp Dock

A floating dock is anchored at the bottom-right of every view to simulate real-time escalation tiers for evaluators without waiting in real time:
- **`T+0m (3 km)`**: Initial radius Haversine match strictly for verified NGOs.
- **`T+10m (8 km)`**: Radius ring expands on map.
- **`T+25m (Split)`**: Smart quantity split across two verified NGOs.
- **`T+40m (Fallback)`**: Admin volunteer dispatch alert.

---

## 🛡️ FSSAI & Verified NGO Restriction Rule

Only NGOs marked with `is_approved = 1` and `fssai_verified = 1` receive dispatch opportunities or appear in the active NGO switcher. Newly registered NGOs enter the **"🛡️ Account Under Review"** gate until activated by Admin on `/admin`.

---

## 🎁 Extensibility Hooks

- **Backend**: `backend/src/plugins/surpriseFeatureSlot.js` (`registerSurpriseFeature(app, io)`)
- **Frontend**: `frontend/src/extensions/DynamicFeatureSlot.jsx` (`<DynamicFeatureSlot slotName="..." />`)
