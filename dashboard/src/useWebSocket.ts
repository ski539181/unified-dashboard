// useWebSocket.ts — Real-time events with auto-reconnect
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WS_URL } from './api';

export interface WSEvent {
  id: string;
  type: string;
  timestamp: number;
  source: string;
  payload: Record<string, unknown>;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<WSEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('event', (event: WSEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 100));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { connected, events, clearEvents };
}