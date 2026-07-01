// Kanban Board — Task management with status columns
import React from 'react';
import { useDashboardStore } from '../store/dashboard';
import { Task, TaskStatus } from '../types';

const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'queued', label: 'Pending', color: 'border-yellow-500' },
  { status: 'running', label: 'Running', color: 'border-blue-500' },
  { status: 'completed', label: 'Completed', color: 'border-green-500' },
  { status: 'failed', label: 'Failed', color: 'border-red-500' },
];

export function KanbanBoard() {
  const { tasks } = useDashboardStore();

  return (
    <div className="bg-bg-card rounded-lg p-6 border border-gray-800">
      <h2 className="text-xl font-semibold text-text-primary mb-6">Task Board</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.status);
          
          return (
            <div key={col.status} className={`rounded-lg border-2 ${col.color} p-4`}>
              <h3 className="text-sm font-medium text-text-secondary mb-3">
                {col.label} ({columnTasks.length})
              </h3>
              
              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                
                {columnTasks.length === 0 && (
                  <p className="text-text-secondary text-sm text-center py-4">
                    No tasks
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const priorityColor = task.priority <= 3 ? 'text-red-400' : 
                        task.priority <= 6 ? 'text-yellow-400' : 'text-gray-400';
  
  return (
    <div className="bg-bg-secondary rounded-lg p-3 hover:bg-gray-800 transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-text-primary text-sm font-medium">{task.title}</p>
        <span className={`text-xs ${priorityColor}`}>P{task.priority}</span>
      </div>
      
      {task.description && (
        <p className="text-text-secondary text-xs mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      
      <div className="flex items-center gap-2 mt-2">
        {task.requiredSkills.slice(0, 2).map((skill) => (
          <span key={skill} className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
            {skill}
          </span>
        ))}
      </div>
      
      {task.assignedAgentId && (
        <p className="text-text-secondary text-xs mt-2">
          Agent: {task.assignedAgentId.slice(0, 8)}...
        </p>
      )}
    </div>
  );
}
