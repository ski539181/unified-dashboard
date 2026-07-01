// Agent Monitoring Panel — Agent status and health
import React from 'react';
import { useDashboardStore } from '../store/dashboard';
import { Agent, AgentStatus } from '../types';

const STATUS_COLORS: Record<AgentStatus, string> = {
  offline: 'bg-gray-500',
  registering: 'bg-yellow-500',
  idle: 'bg-green-500',
  working: 'bg-blue-500 animate-pulse',
  paused: 'bg-yellow-500',
  completed: 'bg-green-500',
  error: 'bg-red-500',
};

export function AgentPanel() {
  const { agents } = useDashboardStore();

  return (
    <div className="bg-bg-card rounded-lg p-6 border border-gray-800">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Agents</h2>
      
      <div className="space-y-3">
        {agents.length === 0 ? (
          <p className="text-text-secondary text-center py-4">No agents registered</p>
        ) : (
          agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const statusColor = STATUS_COLORS[agent.status] || 'bg-gray-500';
  
  return (
    <div className="bg-bg-secondary rounded-lg p-4 hover:bg-gray-800 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${statusColor}`} />
          <div>
            <p className="text-text-primary font-medium">{agent.name}</p>
            <p className="text-text-secondary text-sm">{agent.id.slice(0, 8)}...</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-text-primary text-sm capitalize">{agent.status}</p>
          <p className="text-text-secondary text-xs">
            Health: {agent.healthScore}%
          </p>
        </div>
      </div>
      
      {agent.currentTaskId && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-text-secondary text-xs">
            Current Task: {agent.currentTaskId.slice(0, 8)}...
          </p>
        </div>
      )}
      
      <div className="mt-3 flex gap-2">
        {agent.capabilities.slice(0, 3).map((cap) => (
          <span key={cap} className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
            {cap}
          </span>
        ))}
      </div>
      
      <div className="mt-3 flex gap-4 text-xs text-text-secondary">
        <span>Completed: {agent.totalCompleted}</span>
        <span>Failed: {agent.totalFailed}</span>
      </div>
    </div>
  );
}
