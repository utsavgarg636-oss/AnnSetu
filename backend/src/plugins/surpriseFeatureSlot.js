const express = require('express');
const { dbAll, dbGet, dbRun } = require('../config/db');

/**
 * AnnSetu — Crisis Continuity & Infrastructure Resilience Extension Slot
 *
 * Exports registerSurpriseFeature(app, io) to natively attach
 * resilience endpoints and real-time Socket.io handlers.
 */

// Global in-memory state for crisis continuity protocols
let crisisState = {
  active: false,
  mode: null, // "SOLAR_COLD_STORAGE" | "MESH_SMS_FALLBACK" | "COMMUNITY_SWARM"
  activatedAt: null,
  solarFacilities: [
    {
      id: 'solar-1',
      name: 'Central Delhi Solar Cold-Storage Microgrid',
      location: 'Connaught Place Sector 4',
      lat: 28.6280,
      lng: 77.2180,
      tempC: 4.0,
      capacityPortions: 800,
      backupPower: '15kW Rooftop Photovoltaic + LiFePO4 Pack',
      status: 'OPERATIONAL'
    },
    {
      id: 'solar-2',
      name: 'South NCR Agritech Solar Pod',
      location: 'Okhla Industrial Area Phase III',
      lat: 28.5355,
      lng: 77.2730,
      tempC: 3.5,
      capacityPortions: 600,
      backupPower: '20kW Microgrid Hybrid Unit',
      status: 'OPERATIONAL'
    },
    {
      id: 'solar-3',
      name: 'North Delhi Community Solar Vault',
      location: 'Civil Lines Heritage Enclave',
      lat: 28.6850,
      lng: 77.2050,
      tempC: 4.2,
      capacityPortions: 500,
      backupPower: '12kW Solar Inverter Array',
      status: 'OPERATIONAL'
    }
  ],
  smsDispatches: [],
  swarmZones: [
    {
      zone: 'Zone 1: Central Diplomatic & Commercial Corridor',
      volunteers: 26,
      transport: 'Bicycle Couriers & Foot Runners',
      coordinator: 'Swarm Coordinator Rajesh V.',
      status: 'DEPLOYED'
    },
    {
      zone: 'Zone 2: South Delhi Residential Clusters',
      volunteers: 34,
      transport: 'Electric Cargo-Bikes & Micro-Rickshaws',
      coordinator: 'Swarm Coordinator Sunita M.',
      status: 'DEPLOYED'
    },
    {
      zone: 'Zone 3: East NCR Community Hubs',
      volunteers: 22,
      transport: 'Localized Foot Messengers & Handcarts',
      coordinator: 'Swarm Coordinator Imran K.',
      status: 'DEPLOYED'
    }
  ]
};

function createCrisisRouter(io) {
  const router = express.Router();

  // ─── GET /status — Read current crisis continuity state ───
  router.get('/status', (req, res) => {
    let recentCrisisLogs = [];
    try {
      recentCrisisLogs = dbAll(
        `SELECT * FROM audit_logs WHERE action LIKE 'CRISIS_%' ORDER BY created_at DESC LIMIT 10`
      );
    } catch (err) {
      console.warn('Error reading crisis logs:', err.message);
    }

    res.json({
      ...crisisState,
      recentLogs: recentCrisisLogs,
      serverTime: new Date().toISOString()
    });
  });

  // ─── POST /activate-continuity — Toggle and execute protocols ───
  router.post('/activate-continuity', (req, res) => {
    const { active, mode } = req.body;

    if (active && !['SOLAR_COLD_STORAGE', 'MESH_SMS_FALLBACK', 'COMMUNITY_SWARM'].includes(mode)) {
      return res.status(400).json({
        error: 'Invalid mode',
        validModes: ['SOLAR_COLD_STORAGE', 'MESH_SMS_FALLBACK', 'COMMUNITY_SWARM']
      });
    }

    if (active) {
      crisisState.active = true;
      crisisState.mode = mode;
      crisisState.activatedAt = new Date().toISOString();

      let details = {};

      if (mode === 'SOLAR_COLD_STORAGE') {
        // Solar Cold-Storage Mode: Automatically updates active surplus posts to re-route
        // delivery waypoints to pre-configured interim solar storage facilities
        const activePosts = dbAll(
          `SELECT * FROM surplus_posts WHERE status IN ('OPEN', 'MATCHED', 'IN_PROGRESS')`
        );

        let reroutedCount = 0;
        activePosts.forEach((post, idx) => {
          const facility = crisisState.solarFacilities[idx % crisisState.solarFacilities.length];
          const prefix = `[SOLAR COLD-STORAGE REROUTE: ${facility.name} (4°C)] `;
          if (!post.address.includes('[SOLAR COLD-STORAGE')) {
            const updatedAddress = prefix + (post.address || 'New Delhi');
            dbRun(`UPDATE surplus_posts SET address = ? WHERE id = ?`, [updatedAddress, post.id]);
            reroutedCount++;
          }
        });

        details = {
          mode: 'SOLAR_COLD_STORAGE',
          facilitiesActive: crisisState.solarFacilities.length,
          activePostsRerouted: reroutedCount,
          protocol: 'Grid disruption detected: Temperature preservation locked to solar cold pods.'
        };

        dbRun(
          `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
          ['CRISIS_SOLAR_COLD_STORAGE_ACTIVATED', 'CRISIS_SYSTEM', reroutedCount, JSON.stringify(details)]
        );

      } else if (mode === 'MESH_SMS_FALLBACK') {
        // Mesh SMS Fallback: Triggers simulated offline SMS broadcast logs for all active verified NGOs
        const verifiedNgos = dbAll(
          `SELECT id, name, phone, email FROM ngos WHERE is_approved = 1 AND fssai_verified = 1`
        );

        crisisState.smsDispatches = verifiedNgos.map((ngo) => ({
          ngoId: ngo.id,
          ngoName: ngo.name,
          phone: ngo.phone || '+91-9811001100',
          meshPacketId: `MESH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          message: `[AnnSetu SMS-MESH] INFRASTRUCTURE ALERT: Cell data offline. Swarm frequency 868MHz. Check emergency waypoint for food pickup.`,
          carrierGateway: 'Offline Cellular Tower Broadcast + LoRa Mesh',
          sentAt: new Date().toISOString(),
          deliveryStatus: 'BROADCAST_CONFIRMED'
        }));

        details = {
          mode: 'MESH_SMS_FALLBACK',
          broadcastCount: verifiedNgos.length,
          recipients: verifiedNgos.map((n) => n.name),
          samplePayload: crisisState.smsDispatches[0]?.message || '',
          protocol: 'Low-bandwidth packet broadcasting via decentralized relay nodes'
        };

        dbRun(
          `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
          ['CRISIS_MESH_SMS_BROADCAST', 'CRISIS_SYSTEM', verifiedNgos.length, JSON.stringify(details)]
        );

      } else if (mode === 'COMMUNITY_SWARM') {
        // Community Swarm Mode: Replaces standard vehicle delivery logs with decentralized local volunteer dispatch steps
        const totalVolunteers = crisisState.swarmZones.reduce((sum, z) => sum + z.volunteers, 0);

        details = {
          mode: 'COMMUNITY_SWARM',
          totalVolunteersDeployed: totalVolunteers,
          zones: crisisState.swarmZones,
          protocol: 'Fuel shortage / route block contingency: Swarm runners on foot and bicycles active.'
        };

        dbRun(
          `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
          ['CRISIS_COMMUNITY_SWARM_ACTIVATED', 'CRISIS_SYSTEM', totalVolunteers, JSON.stringify(details)]
        );
      }

      // Broadcast real-time status update to all connected dashboards
      if (io) {
        io.emit('crisis:status-updated', {
          active: true,
          mode,
          activatedAt: crisisState.activatedAt,
          details,
          solarFacilities: crisisState.solarFacilities,
          smsDispatches: crisisState.smsDispatches,
          swarmZones: crisisState.swarmZones
        });

        io.emit('crisis:alert', {
          title: 'Crisis Continuity Protocol Active',
          mode,
          message: details.protocol || 'Resilience procedures engaged.'
        });
      }

      return res.json({
        success: true,
        active: true,
        mode,
        activatedAt: crisisState.activatedAt,
        details,
        message: `⚡ Crisis Continuity engaged: ${mode.replace(/_/g, ' ')} active.`
      });

    } else {
      // Deactivate crisis continuity mode
      const prevMode = crisisState.mode;
      crisisState.active = false;
      crisisState.mode = null;
      crisisState.activatedAt = null;

      // Revert solar cold-storage addresses on surplus posts
      try {
        const posts = dbAll(
          `SELECT id, address FROM surplus_posts WHERE address LIKE '%[SOLAR COLD-STORAGE REROUTE%'`
        );
        posts.forEach((p) => {
          const cleaned = p.address.replace(/\[SOLAR COLD-STORAGE REROUTE:[^\]]+\]\s*/g, '');
          dbRun(`UPDATE surplus_posts SET address = ? WHERE id = ?`, [cleaned, p.id]);
        });
      } catch (err) {
        console.warn('Error reverting post addresses:', err.message);
      }

      dbRun(
        `INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES (?, ?, ?, ?)`,
        [
          'CRISIS_CONTINUITY_DEACTIVATED',
          'CRISIS_SYSTEM',
          0,
          JSON.stringify({
            status: 'NORMAL_OPERATIONS_RESTORED',
            previousMode: prevMode,
            timestamp: new Date().toISOString()
          })
        ]
      );

      if (io) {
        io.emit('crisis:status-updated', {
          active: false,
          mode: null,
          details: { status: 'NORMAL_OPERATIONS' }
        });
      }

      return res.json({
        success: true,
        active: false,
        mode: null,
        message: 'Standard operational protocols restored.'
      });
    }
  });

  return router;
}

function registerSurpriseFeature(app, io) {
  const registeredFeatures = ['crisis-continuity'];

  console.log('⚡ Crisis Continuity & Infrastructure Resilience Extension Slot active');

  // Mount crisis continuity routes on both /api/crisis and /api/features/crisis
  const crisisRouter = createCrisisRouter(io);
  app.use('/api/crisis', crisisRouter);
  app.use('/api/features/crisis', crisisRouter);

  return {
    name: 'crisis-continuity-slot',
    version: '2.0.0',
    status: 'ready',
    registeredFeatures,

    /**
     * Register additional extension modules.
     */
    register(featureModule) {
      if (!featureModule || !featureModule.name) {
        throw new Error('Feature module must have a name');
      }

      if (featureModule.routes) {
        app.use(`/api/features/${featureModule.name}`, featureModule.routes);
      }

      if (featureModule.socketHandlers && typeof featureModule.socketHandlers === 'function') {
        io.on('connection', (socket) => {
          featureModule.socketHandlers(socket, io);
        });
      }

      registeredFeatures.push(featureModule.name);
      console.log(`⚡ Module "${featureModule.name}" registered successfully`);
    }
  };
}

module.exports = { registerSurpriseFeature, crisisState };
