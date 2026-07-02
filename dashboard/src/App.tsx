import { useState, useEffect } from "react";
import { Sidebar, MobileMenu, TopBar, MainContent } from "./components/layout";
import { StatCard, Card, CardHeader, CardTitle, CardContent, Badge, StatusBadge, StatCardSkeleton, KanbanSkeleton, EventSkeleton } from "./components/ui";
import { fetchHealth, fetchTasks, fetchAgents, fetchEvents, fetchSystemHealth, fetchNotifications, type HealthStatus, type Task, type Agent, type Event, type SystemHealth, type Notification } from "./api";

function App() {
  const [currentRoute, setCurrentRoute] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [healthData, tasksData, agentsData, eventsData, sysHealth, notifs] = await Promise.all([
          fetchHealth().catch(() => null),
          fetchTasks().catch(() => []),
          fetchAgents().catch(() => []),
          fetchEvents(20).catch(() => []),
          fetchSystemHealth().catch(() => null),
          fetchNotifications().catch(() => []),
        ]);
        setHealth(healthData);
        setTasks(tasksData);
        setAgents(agentsData);
        setEvents(eventsData);
        setSystemHealth(sysHealth);
        setNotifications(notifs);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const columns = {
    queued: tasks.filter((t) => t.status === "queued"),
    assigned: tasks.filter((t) => t.status === "assigned"),
    running: tasks.filter((t) => t.status === "running"),
    completed: tasks.filter((t) => t.status === "completed"),
    failed: tasks.filter((t) => t.status === "failed"),
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <MobileMenu currentRoute={currentRoute} onNavigate={setCurrentRoute} />
      <Sidebar currentRoute={currentRoute} onNavigate={setCurrentRoute} />

      <MainContent>
        <TopBar title="Overview" subtitle="Real-time system status" />

        <div className="mt-6 space-y-6">
          {/* Stat Cards */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatCard icon="📋" label="Tasks" value={tasks.length} subtitle={`${columns.queued.length} queued · ${columns.running.length} running · ${columns.completed.length} done`} />
              <StatCard icon="🤖" label="Agents" value={agents.length} subtitle={`${agents.filter(a => a.status === 'idle').length} idle · ${agents.filter(a => a.status === 'working').length} working`} />
              <StatCard icon="🧠" label="Memory" value={health?.modules.memory.total ?? 0} subtitle={`${health?.modules.memory.working ?? 0} working · ${health?.modules.memory.longterm ?? 0} long-term`} />
              <StatCard icon="📈" label="Health" value={`${Math.round((health?.modules.improvement.avgHealth ?? 0) * 100)}%`} subtitle="System health score" />
              <StatCard icon="🛡️" label="Self-Heal" value={health?.modules.selfHealer.totalHealings ?? 0} subtitle={health?.modules.selfHealer.isRunning ? "Running" : "Stopped"} />
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Kanban Board - 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>📋 Kanban Board</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <KanbanSkeleton />
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(["queued", "assigned", "running", "completed"] as const).map((col) => (
                        <div key={col} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{col}</h3>
                            <Badge variant="secondary">{columns[col].length}</Badge>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {columns[col].slice(0, 5).map((task) => (
                              <div key={task.id} className="bg-[var(--bg-elevated)] rounded-lg p-3 border border-[var(--border-subtle)]">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">{task.title}</span>
                                  <span className="text-xs text-[var(--text-tertiary)]">P{task.priority}</span>
                                </div>
                                {task.assignedAgentId && (
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={col === "running" ? "working" : "idle"} />
                                    <span className="text-xs text-[var(--text-secondary)]">{task.assignedAgentId.slice(0, 12)}</span>
                                  </div>
                                )}
                                {task.errorMessage && (
                                  <p className="text-xs text-[var(--accent-red)] mt-1 truncate">{task.errorMessage}</p>
                                )}
                              </div>
                            ))}
                            {columns[col].length === 0 && (
                              <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No tasks</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Agent Monitor - 1 column */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>🤖 Agents</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <EventSkeleton />
                  ) : (
                    <div className="space-y-3">
                      {agents.map((agent) => (
                        <div key={agent.id} className="bg-[var(--bg-elevated)] rounded-lg p-3 border border-[var(--border-subtle)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">{agent.name}</span>
                            <StatusBadge status={agent.status as any} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                            <span>{agent.totalCompleted} done</span>
                            <span>·</span>
                            <span>{agent.totalFailed} failed</span>
                          </div>
                          {agent.currentTaskId && (
                            <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate">Working on: {agent.currentTaskId.slice(0, 16)}</p>
                          )}
                        </div>
                      ))}
                      {agents.length === 0 && (
                        <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No agents registered</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle>💻 System Health</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <EventSkeleton />
                ) : systemHealth ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">CPU</span>
                      <span>{systemHealth.cpu.usage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2">
                      <div className="bg-[var(--accent-blue)] h-2 rounded-full" style={{ width: `${systemHealth.cpu.usage}%` }} />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Memory</span>
                      <span>{systemHealth.memory.usagePercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-[var(--bg-elevated)] rounded-full h-2">
                      <div className="bg-[var(--accent-purple)] h-2 rounded-full" style={{ width: `${systemHealth.memory.usagePercent}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-tertiary)]">
                      <span>Uptime: {Math.floor(systemHealth.uptime / 3600)}h</span>
                      <span>{systemHealth.platform}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">No system data</p>
                )}
              </CardContent>
            </Card>

            {/* Live Events */}
            <Card>
              <CardHeader>
                <CardTitle>📡 Events</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <EventSkeleton />
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {events.slice(0, 10).map((event) => (
                      <div key={event.id} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-[var(--text-tertiary)] w-16">{new Date(event.timestamp).toLocaleTimeString()}</span>
                        <Badge variant={event.type.includes('error') ? 'destructive' : 'secondary'} className="text-[10px]">{event.type}</Badge>
                      </div>
                    ))}
                    {events.length === 0 && (
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No events</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>🔔 Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <EventSkeleton />
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notifications.length > 0 ? notifications.slice(0, 5).map((notif) => (
                      <div key={notif.id} className="flex items-center gap-2 text-xs">
                        <span className={notif.severity === 'error' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-yellow)]'}>●</span>
                        <span className="text-[var(--text-secondary)] truncate">{notif.message}</span>
                      </div>
                    )) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-[var(--accent-green)]">✓ All clear</p>
                        <p className="text-xs text-[var(--text-tertiary)]">No alerts</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </MainContent>
    </div>
  );
}

export default App;
