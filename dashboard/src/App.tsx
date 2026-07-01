// App.tsx — Hermes AI OS Dashboard
import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { fetchTasks, fetchHealth, createTask } from './api';
import type { Task, HealthStatus } from './api';
import './App.css';

function App() {
  const { connected, events, clearEvents } = useWebSocket();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Load data
  const loadData = async () => {
    try {
      const [tasksData, healthData] = await Promise.all([
        fetchTasks(),
        fetchHealth(),
      ]);
      setTasks(tasksData);
      setHealth(healthData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  // Handle new task
  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      await createTask(newTaskTitle);
      setNewTaskTitle('');
      loadData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Kanban columns
  const columns = {
    queued: tasks.filter(t => t.status === 'queued'),
    assigned: tasks.filter(t => t.status === 'assigned'),
    running: tasks.filter(t => t.status === 'running'),
    completed: tasks.filter(t => t.status === 'completed'),
    failed: tasks.filter(t => t.status === 'failed' || t.status === 'dead_letter'),
  };

  // Healing events
  const healingEvents = events.filter(e => e.type.startsWith('healing:'));

  if (loading) {
    return <div className="loading">Loading Hermes AI OS Dashboard...</div>;
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1>🚀 Hermes AI OS Dashboard</h1>
        <div className="status-bar">
          <span className={`status-dot ${connected ? 'green' : 'red'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
          <span className="version">v{health?.version || '?'}</span>
          <span className="persistence">{health?.persistence || '?'}</span>
        </div>
      </header>

      {error && <div className="error-banner">⚠️ {error}</div>}

      {/* Overview Cards */}
      <section className="overview">
        <div className="card">
          <h3>📋 Tasks</h3>
          <div className="big-number">{tasks.length}</div>
          <div className="sub">
            {columns.queued.length} queued · {columns.running.length} running · {columns.completed.length} done
          </div>
        </div>
        <div className="card">
          <h3>🤖 Agents</h3>
          <div className="big-number">{health?.modules.orchestrator.agents.total || 0}</div>
          <div className="sub">
            {health?.modules.orchestrator.agents.idle || 0} idle · {health?.modules.orchestrator.agents.working || 0} working · {health?.modules.orchestrator.agents.error || 0} error
          </div>
        </div>
        <div className="card">
          <h3>🧠 Memory</h3>
          <div className="big-number">{health?.modules.memory.total || 0}</div>
          <div className="sub">
            {health?.modules.memory.working || 0} working · {health?.modules.memory.longterm || 0} longterm · {health?.modules.memory.vector || 0} vector
          </div>
        </div>
        <div className="card">
          <h3>🛡️ Self-Healer</h3>
          <div className="big-number">{health?.modules.selfHealer.totalHealings || 0}</div>
          <div className="sub">
            {health?.modules.selfHealer.isRunning ? '✅ Running' : '⏸️ Stopped'} · {((health?.modules.selfHealer.successRate || 0) * 100).toFixed(0)}% success
          </div>
        </div>
      </section>

      {/* Create Task */}
      <section className="create-task">
        <input
          type="text"
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder="New task title..."
          onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
        />
        <button onClick={handleCreateTask}>+ Create Task</button>
      </section>

      {/* Kanban Board */}
      <section className="kanban">
        <h2>📋 Kanban Board</h2>
        <div className="kanban-columns">
          {(['queued', 'assigned', 'running', 'completed', 'failed'] as const).map(col => (
            <div key={col} className={`kanban-col ${col}`}>
              <h3>{col.toUpperCase()} ({columns[col].length})</h3>
              {columns[col].map(task => (
                <div key={task.id} className={`task-card ${task.status}`}>
                  <div className="task-title">{task.title}</div>
                  <div className="task-meta">
                    <span className="priority">P{task.priority}</span>
                    {task.assignedAgentId && <span className="agent">🤖 {task.assignedAgentId.slice(0, 8)}</span>}
                  </div>
                  {task.errorMessage && <div className="task-error">{task.errorMessage}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Two-column layout: Healing + Events */}
      <div className="two-col">
        {/* Self-Healing Panel */}
        <section className="healing-panel">
          <h2>🛡️ Self-Healing Events</h2>
          {healingEvents.length === 0 ? (
            <div className="empty">No healing events yet</div>
          ) : (
            <div className="event-list">
              {healingEvents.slice(0, 20).map(event => (
                <div key={event.id} className={`event-item ${event.type}`}>
                  <span className="event-type">{event.type}</span>
                  <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                  <span className="event-source">{event.source}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Live Event Stream */}
        <section className="event-stream">
          <h2>📡 Live Events <button onClick={clearEvents}>Clear</button></h2>
          <div className="event-list">
            {events.slice(0, 30).map(event => (
              <div key={event.id} className={`event-item ${event.type}`}>
                <span className="event-type">{event.type}</span>
                <span className="event-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
                <span className="event-source">{event.source}</span>
              </div>
            ))}
            {events.length === 0 && <div className="empty">Waiting for events...</div>}
          </div>
        </section>
      </div>

      {/* Agent Monitor */}
      <section className="agent-monitor">
        <h2>🤖 Agent Monitor</h2>
        <div className="agent-grid">
          {health?.modules.orchestrator.agents && (
            <div className="agent-card">
              <div className="agent-name">Orchestrator</div>
              <div className="agent-status">
                Total: {health.modules.orchestrator.agents.total} |
                Idle: {health.modules.orchestrator.agents.idle} |
                Working: {health.modules.orchestrator.agents.working} |
                Error: {health.modules.orchestrator.agents.error}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;