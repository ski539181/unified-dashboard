// WebSocket Hook — Real-time connection to backend
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useDashboardStore } from '../store/dashboard';
import { Event } from '../types';

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { setConnected, addEvent, updateTask, updateAgent } = useDashboardStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('event', (event: Event) => {
      // Handle different event types
      switch (event.type) {
        case 'task:created':
        case 'task:updated':
        case 'task:completed':
        case 'task:failed':
          // Task events are handled by the store
          break;
        case 'agent:status_changed':
          // Agent events are handled by the store
          break;
      }
      
      // Add to event stream
      addEvent(event);
    });

    socketRef.current = socket;
  }, [setConnected, addEvent]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, [setConnected]);

  const emit = useCallback((event: string, data?: unknown) => {
    socketRef.current?.emit(event, data);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { connect, disconnect, emit };
}
