// Zustand Store — Central state management
import { create } from 'zustand';
import { Task, Agent, Event, SystemStats } from '../types';

interface DashboardState {
  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (task: Task) => void;

  // Agents
  agents: Agent[];
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agent: Agent) => void;

  // Events
  events: Event[];
  addEvent: (event: Event) => void;
  clearEvents: () => void;

  // System Stats
  stats: SystemStats | null;
  setStats: (stats: SystemStats) => void;

  // WebSocket
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (task) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === task.id ? task : t)),
  })),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgent: (agent) => set((state) => ({
    agents: state.agents.map((a) => (a.id === agent.id ? agent : a)),
  })),

  // Events
  events: [],
  addEvent: (event) => set((state) => ({
    events: [event, ...state.events].slice(0, 100), // Keep last 100
  })),
  clearEvents: () => set({ events: [] }),

  // System Stats
  stats: null,
  setStats: (stats) => set({ stats }),

  // WebSocket
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}));
