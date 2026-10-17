/**
 * AnnSetu — Surprise Feature Slot (Backend Plug-in)
 *
 * Exports registerSurpriseFeature(app, io) that can instantly attach
 * new API endpoints and Socket.io handlers without modifying core controllers.
 *
 * Usage:
 *   const { registerSurpriseFeature } = require('./plugins/surpriseFeatureSlot');
 *   const slot = registerSurpriseFeature(app, io);
 *   slot.register({ name: 'myFeature', routes: express.Router(), socketHandlers: fn });
 */

function registerSurpriseFeature(app, io) {
  const registeredFeatures = [];

  console.log('🎁 Surprise Feature Slot initialized — ready for future modules');

  return {
    name: 'surprise-feature-slot',
    version: '1.0.0',
    status: 'ready',
    registeredFeatures,

    /**
     * Register a new feature module.
     * @param {Object} featureModule
     * @param {string} featureModule.name - Unique feature identifier
     * @param {express.Router} [featureModule.routes] - Express router
     * @param {Function} [featureModule.socketHandlers] - fn(socket, io)
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
      console.log(`✨ Feature "${featureModule.name}" registered successfully`);
    }
  };
}

module.exports = { registerSurpriseFeature };
