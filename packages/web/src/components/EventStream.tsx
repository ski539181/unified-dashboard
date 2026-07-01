// Event Stream Viewer — Live event feed
import React, { useState } from 'react';
import { useDashboardStore } from '../store/dashboard';
import { Event } from '../types';

export function EventStream() {
  const { events } = useDashboardStore();
  const [filter, setFilter] = useState<string>('all');

  const filteredEvents = filter === 'all' 
    ? events 
    : events.filter((e) => e.type.startsWith(filter));

  return (
    <div className="bg-bg-card rounded-lg p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Event Stream</h2>
        
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-bg-secondary text-text-primary text-sm rounded px-3 py-1 border border-gray-700"
        >
          <option value="all">All Events</option>
          <option value="task">Task Events</option>
          <option value="agent">Agent Events</option>
          <option value="memory">Memory Events</option>
        </select>
      </div>
      
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <p className="text-text-secondary text-center py-4">No events yet</p>
        ) : (
          filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const typeColor = event.type.startsWith('task') ? 'text-blue-400' :
                    event.type.startsWith('agent') ? 'text-green-400' :
                    event.type.startsWith('memory') ? 'text-purple-400' :
                    'text-gray-400';

  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className="bg-bg-secondary rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`font-mono ${typeColor}`}>{event.type}</span>
          <span className="text-text-secondary">from {event.source}</span>
        </div>
        <span className="text-text-secondary text-xs">{time}</span>
      </div>
      
      {event.payload && Object.keys(event.payload).length > 0 && (
        <pre className="mt-2 text-xs text-text-secondary overflow-x-auto">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
