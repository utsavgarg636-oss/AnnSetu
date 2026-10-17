import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * DynamicFeatureSlot — Pluggable component slot for surprise features.
 * Injected seamlessly into Navbar and Dashboard views without altering core schemas.
 *
 * Props:
 *  - slotName: string ('navbar' | 'dashboard_top' | 'dashboard_bottom' | 'telemetry')
 *  - contextData: optional object passed to custom plugins
 */
export default function DynamicFeatureSlot({ slotName = 'default', contextData = {} }) {
  const [activePlugins, setActivePlugins] = useState([]);

  useEffect(() => {
    // Check if any surprise features are exposed via window or API
    if (window.__ANNSETU_PLUGINS__ && window.__ANNSETU_PLUGINS__[slotName]) {
      setActivePlugins(window.__ANNSETU_PLUGINS__[slotName]);
    }
  }, [slotName]);

  // If no external plugin is mounted, render an unobtrusive extensible capability badge in development/demo mode
  if (activePlugins.length === 0) {
    if (slotName === 'navbar') {
      return (
        <div className="dynamic-feature-indicator" title="Surprise Extensibility Hook: Ready for plug-ins">
          <span className="feature-slot-tag">
            <Sparkles size={12} className="sparkle-icon" />
            <span className="feature-slot-text">Extensible Hook</span>
          </span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`dynamic-feature-slot slot-${slotName}`}>
      {activePlugins.map((Plugin, idx) => (
        <Plugin key={idx} contextData={contextData} />
      ))}
    </div>
  );
}
