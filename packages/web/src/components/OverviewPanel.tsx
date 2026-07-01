// Overview Panel — System health summary
import React from 'react';
import { useDashboardStore } from '../store/dashboard';

export function OverviewPanel() {
  const { tasks, agents, stats, isConnected } = useDashboardStore();

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'created' || t.status === 'queued').length,
    running: tasks.filter((t) => t.status === 'running').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  return (
    <div className="bg-bg-card rounded-lg p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">System Overview</h2>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-text-secondary">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={taskStats.total} color="text-blue-400" />
        <StatCard label="Pending" value={taskStats.pending} color="text-yellow-400" />
        <StatCard label="Running" value={taskStats.running} color="text-green-400" />
        <StatCard label="Failed" value={taskStats.failed} color="text-red-400" />
      </div>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={agents.length} color="text-purple-400" />
        <StatCard 
          label="Idle" 
          value={agents.filter((a) => a.status === 'idle').length} 
          color="text-gray-400" 
        />
        <StatCard 
          label="Working" 
          value={agents.filter((a) => a.status === 'working').length} 
          color="text-green-400" 
        />
        <StatCard 
          label="Error" 
          value={agents.filter((a) => a.status === 'error').length} 
          color="text-red-400" 
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-bg-secondary rounded-lg p-4">
      <p className="text-text-secondary text-sm">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
