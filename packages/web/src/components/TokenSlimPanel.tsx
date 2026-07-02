// TokenSlim Panel — แสดงสถิติ 5-layer pipeline
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface TokenSlimStats {
  l1_tokslim: {
    total_calls: number;
    total_input_chars: number;
    total_output_chars: number;
    avg_savings_pct: number;
    last_call: string | null;
  };
  l2_cache: {
    total_checks: number;
    hits: number;
    misses: number;
    hit_rate: number;
    total_entries: number;
    last_check: string | null;
  };
  l3_memory: {
    total_injects: number;
    total_stores: number;
    total_searches: number;
    last_inject: string | null;
  };
  l4_taskqueue: {
    total_tracked: number;
    last_track: string | null;
  };
  l5_ocl: {
    total_trims: number;
    total_input_chars: number;
    total_output_chars: number;
    avg_savings_pct: number;
    last_trim: string | null;
  };
  updated_at: string | null;
}

export function TokenSlimPanel() {
  const [stats, setStats] = useState<TokenSlimStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getTokenSlimStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load TokenSlim stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, []);

  if (loading || !stats) {
    return (
      <div className="bg-bg-card rounded-lg p-6 border border-gray-800">
        <h2 className="text-xl font-semibold text-text-primary mb-4">TokenSlim Pipeline</h2>
        <p className="text-text-secondary text-center py-4">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-lg p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-text-primary">TokenSlim Pipeline</h2>
        {stats.updated_at && (
          <span className="text-xs text-text-secondary">
            Updated: {stats.updated_at}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* L1: TokSlim */}
        <LayerCard
          title="L1 TokSlim"
          subtitle="Input Compression"
          value={`${stats.l1_tokslim.total_calls}`}
          detail={`Avg savings: ${stats.l1_tokslim.avg_savings_pct}%`}
          color="text-blue-400"
          bgColor="bg-blue-400/10"
        />

        {/* L2: Cache */}
        <LayerCard
          title="L2 Cache"
          subtitle="Response Cache"
          value={`${stats.l2_cache.total_entries}`}
          detail={`Hit rate: ${stats.l2_cache.hit_rate}%`}
          color="text-green-400"
          bgColor="bg-green-400/10"
        />

        {/* L3: Memory */}
        <LayerCard
          title="L3 Memory"
          subtitle="Long-term Memory"
          value={`${stats.l3_memory.total_injects}`}
          detail={`Stores: ${stats.l3_memory.total_stores}`}
          color="text-purple-400"
          bgColor="bg-purple-400/10"
        />

        {/* L4: Task Queue */}
        <LayerCard
          title="L4 TaskQueue"
          subtitle="Task Tracking"
          value={`${stats.l4_taskqueue.total_tracked}`}
          detail="Tasks tracked"
          color="text-yellow-400"
          bgColor="bg-yellow-400/10"
        />

        {/* L5: OCL */}
        <LayerCard
          title="L5 OCL"
          subtitle="Output Trimming"
          value={`${stats.l5_ocl.total_trims}`}
          detail={`Avg savings: ${stats.l5_ocl.avg_savings_pct}%`}
          color="text-red-400"
          bgColor="bg-red-400/10"
        />
      </div>

      {/* Summary Bar */}
      <div className="mt-6 p-4 bg-bg-secondary rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-secondary">Total tokens saved (L1+L5):</span>
          <span className="text-accent font-medium">
            {formatChars(
              stats.l1_tokslim.total_input_chars - stats.l1_tokslim.total_output_chars +
              stats.l5_ocl.total_input_chars - stats.l5_ocl.total_output_chars
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-text-secondary">Cache hits (saved LLM calls):</span>
          <span className="text-green-400 font-medium">
            {stats.l2_cache.hits}
          </span>
        </div>
      </div>
    </div>
  );
}

function LayerCard({
  title,
  subtitle,
  value,
  detail,
  color,
  bgColor,
}: {
  title: string;
  subtitle: string;
  value: string;
  detail: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <p className="text-text-secondary text-xs">{subtitle}</p>
      <p className="text-sm font-medium text-text-primary mt-1">{title}</p>
      <p className={`text-2xl font-bold ${color} mt-2`}>{value}</p>
      <p className="text-xs text-text-secondary mt-1">{detail}</p>
    </div>
  );
}

function formatChars(chars: number): string {
  if (chars >= 1000000) {
    return `${(chars / 1000000).toFixed(1)}M`;
  }
  if (chars >= 1000) {
    return `${(chars / 1000).toFixed(1)}K`;
  }
  return chars.toString();
}
