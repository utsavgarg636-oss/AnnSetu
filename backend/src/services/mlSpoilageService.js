const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Base shelf life in hours at 25°C reference temperature
 * Source: FSSAI food safety guidelines adapted for Indian cuisine
 */
const BASE_SHELF_LIFE = {
  'Cooked Rice & Curry': 4.5,
  'Dairy & Sweets': 3.0,
  'Bread & Dry Sabzi': 8.0,
  'Fried Snacks': 6.0
};

/**
 * JavaScript fallback implementation of the spoilage prediction model.
 * Used when the Python ML service is unavailable.
 *
 * Model Parameters:
 *  - Non-Veg multiplier: 0.82
 *  - Q10 temperature coefficient: -3.5% per °C above 25°C
 *  - Bulk heat retention penalty: -0.3 hrs if portions >= 300
 *
 * Safety Thresholds:
 *  - SAFE: remaining >= 1.5 hrs
 *  - CRITICAL: 0.5 <= remaining < 1.5 hrs
 *  - BLOCKED: remaining < 0.5 hrs → Biogas/Compost diversion
 */
function calculateSpoilageJS({ food_type, dietary_type, quantity_portions, hours_since_cooked, storage_temp_c }) {
  let baseLife = BASE_SHELF_LIFE[food_type] || 4.0;

  // Non-Veg multiplier
  if (dietary_type === 'Non-Veg') {
    baseLife *= 0.82;
  }

  // Temperature coefficient (Q10): Reduce total shelf life by 3.5% for every 1°C above 25°C
  if (storage_temp_c > 25) {
    const tempDelta = storage_temp_c - 25;
    baseLife *= Math.pow(1 - 0.035, tempDelta);
  }

  // Bulk heat retention penalty: Subtract 0.3 hours if portions >= 300
  if (quantity_portions >= 300) {
    baseLife -= 0.3;
  }

  const remaining_safe_hours = Math.max(0, baseLife - hours_since_cooked);
  const safe_until_timestamp = new Date(Date.now() + remaining_safe_hours * 3600 * 1000).toISOString();

  let safety_status = 'SAFE';
  if (remaining_safe_hours < 0.5) {
    safety_status = 'BLOCKED';
  } else if (remaining_safe_hours < 1.5) {
    safety_status = 'CRITICAL';
  }

  return {
    remaining_safe_hours: Math.round(remaining_safe_hours * 100) / 100,
    safe_until_timestamp,
    safety_status,
    model_used: 'js_fallback'
  };
}

/**
 * Predict spoilage — calls Python ML service first, falls back to JS model
 */
async function predictSpoilage(data) {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/predict-spoilage`, data, { timeout: 3000 });
    return { ...response.data, model_used: 'ml_service' };
  } catch (err) {
    console.log('⚠️  ML Service unavailable, using JS fallback:', err.message);
    return calculateSpoilageJS(data);
  }
}

module.exports = { predictSpoilage, calculateSpoilageJS };
