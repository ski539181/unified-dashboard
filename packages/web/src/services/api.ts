// API Service — REST API client
import { Task, Agent, Event, SystemStats } from '../types';

const API_BASE = '/api';

export const api = {
  // Tasks
  async getTasks(): Promise<Task[]> {
    const res = await fetch(`${API_BASE}/tasks`);
    return res.json();
  },

  async getTask(id: string): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks/${id}`);
    return res.json();
  },

  async createTask(data: {
    title: string;
    description?: string;
    priority?: number;
    requiredSkills?: string[];
  }): Promise<Task> {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Stats
  async getStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },

  // Events
  async getEvents(params?: {
    type?: string;
    from?: number;
    to?: number;
  }): Promise<Event[]> {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.from) query.set('from', params.from.toString());
    if (params?.to) query.set('to', params.to.toString());
    
    const res = await fetch(`${API_BASE}/events?${query}`);
    return res.json();
  },

  // Health
  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    const res = await fetch('/health');
    return res.json();
  },
};
