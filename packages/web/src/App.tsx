// Main App — Dashboard layout
import React, { useEffect } from 'react';
import { useDashboardStore } from './store/dashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './services/api';
import { OverviewPanel } from './components/OverviewPanel';
import { KanbanBoard } from './components/KanbanBoard';
import { AgentPanel } from './components/AgentPanel';
import { EventStream } from './components/EventStream';
import { TokenSlimPanel } from './components/TokenSlimPanel';

function App() {
  const { setTasks, setAgents, setStats, addEvent } = useDashboardStore();
  const { connect } = useWebSocket();

  useEffect(() => {
    // Load initial data
    const loadData = async () => {
      try {
        const [tasks, stats] = await Promise.all([
          api.getTasks(),
          api.getStats(),
        ]);
        setTasks(tasks);
        setStats(stats);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadData();
    connect();
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            <span className="text-accent">Hermes</span> AI OS Dashboard
          </h1>
          <ConnectionStatus />
        </div>
      </header>
      {/* Main Content */}
      <main className="p-6">
        {/* TokenSlim Pipeline - Full Width */}
        <div className="mb-6">
          <TokenSlimPanel />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column - Overview + Kanban */}
          <div className="xl:col-span-2 space-y-6">
            <OverviewPanel />
            <KanbanBoard />
          </div>

          {/* Right Column - Agents + Events */}
          <div className="space-y-6">
            <AgentPanel />
            <EventStream />
          </div>
        </div>
      </main>
    </div>
  );
}

function ConnectionStatus() {
  const { isConnected } = useDashboardStore();
  
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-text-secondary">
        {isConnected ? 'Real-time connected' : 'Connecting...'}
      </span>
    </div>
  );
}

export default App;
