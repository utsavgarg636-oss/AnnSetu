import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(1);
  const [notifications, setNotifications] = useState([]);
  const [impactStats, setImpactStats] = useState({
    totalPortionsRescued: 1250,
    co2ePrevented: '3125.0',
    methanePrevented: '1000.0',
    trustIndex: '4.8'
  });

  // Fetch initial global impact stats
  const refreshStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setImpactStats({
          totalPortionsRescued: data.totalPortionsRescued || 0,
          co2ePrevented: data.co2ePrevented || '0.0',
          methanePrevented: ((data.totalPortionsRescued || 0) * 0.8).toFixed(1),
          trustIndex: data.trustIndex || '4.8'
        });
      }
    } catch (err) {
      console.warn('Could not fetch impact stats:', err);
    }
  };

  useEffect(() => {
    refreshStats();

    // Connect to WebSocket server (using current origin via proxy or port 5000)
    const newSocket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('⚡ Socket.io connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('⚡ Socket.io disconnected');
    });

    newSocket.on('clients:count', (count) => {
      setClientCount(count);
    });

    const addNotification = (notif) => {
      const id = Date.now() + Math.random().toString();
      const item = { ...notif, id, timestamp: new Date() };
      setNotifications((prev) => [item, ...prev.slice(0, 19)]);
    };

    newSocket.on('post:created', (post) => {
      addNotification({
        type: 'post_created',
        title: 'New Surplus Food Posted',
        message: `${post.host_name} posted ${post.total_portions} portions of ${post.food_type}`,
        badge: 'info'
      });
      refreshStats();
    });

    newSocket.on('escalation:update', (data) => {
      addNotification({
        type: 'escalation',
        title: `Escalation Tier ${data.tier}`,
        message: `Radius: ${data.radius === 'ADMIN_FALLBACK' ? 'Admin Fallback' : data.radius + ' km'} — ${data.matches || 0} NGO(s) eligible`,
        badge: data.tier === 3 ? 'critical' : 'warning'
      });
    });

    newSocket.on('handover:created', (data) => {
      addNotification({
        type: 'rescue_accepted',
        title: 'Rescue Accepted',
        message: `${data.ngoName} accepted ${data.portions} portions for Post #${data.postId}`,
        badge: 'success'
      });
      refreshStats();
    });

    newSocket.on('handover:verified', (data) => {
      addNotification({
        type: 'handover_verified',
        title: 'Handover Verified! 🎉',
        message: `${data.ngoName} delivered ${data.portions} portions. Saved ${data.co2ePrevented} kg CO2e!`,
        badge: 'success'
      });
      refreshStats();
    });

    newSocket.on('ngo:approved', (data) => {
      addNotification({
        type: 'ngo_approved',
        title: 'NGO Approved',
        message: `${data.name} is now certified and live on the network`,
        badge: 'success'
      });
      refreshStats();
    });

    newSocket.on('admin:volunteer-fallback', (data) => {
      addNotification({
        type: 'fallback',
        title: 'Tier 3 Volunteer Dispatch Triggered',
        message: data.message,
        badge: 'critical'
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const clearNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        clientCount,
        notifications,
        clearNotification,
        impactStats,
        refreshStats
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
