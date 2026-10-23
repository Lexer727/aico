import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export interface QuotaAccountInfo {
  email: string;
  tier?: string | null;
}

// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-1::REQ-006
export interface QuotaWindow {
  remaining_pct: number;
  reset_in: string;
}

export interface QuotaProviderStatus {
  id: string;
  name: string;
  cli: string;
  connected: boolean;
  weekly_remaining_pct: number;
  weekly_reset: string;
  five_hour_remaining_pct?: number;
  five_hour_reset?: string;
  weekly?: QuotaWindow | null;
  five_hour?: QuotaWindow | null;
}

export type AiProviderQuota = QuotaProviderStatus;

export type AiTerminalState = 'inactive' | 'waiting_for_input' | 'working';

export interface AiQuotasResponse {
  ai_state: AiTerminalState;
  account: QuotaAccountInfo | null;
  providers: QuotaProviderStatus[];
}

interface QuotaRingProps {
  percentage: number;
}

const QuotaRing: React.FC<QuotaRingProps> = ({ percentage }) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped <= 15
      ? 'text-rose-500'
      : clamped <= 40
        ? 'text-amber-400'
        : 'text-emerald-500';

  return (
    <svg
      className="w-3.5 h-3.5 -rotate-90 shrink-0"
      viewBox="0 0 14 14"
      aria-hidden="true"
    >
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-zinc-800"
      />
      <circle
        cx="7"
        cy="7"
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className={strokeColor}
      />
    </svg>
  );
};

// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-003
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-006::REQ-004
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-005
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-006
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-002::REQ-007
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-005::REQ-008
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-010
// @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-004::REQ-011
export const AiStatusMonitor: React.FC = () => {
  const [data, setData] = useState<AiQuotasResponse>({
    ai_state: 'inactive',
    account: null,
    providers: [],
  });

  useEffect(() => {
    let mounted = true;

    const fetchQuotas = async () => {
      try {
        const res = await fetch('/api/v1/ai/quotas');
        if (res.ok && mounted) {
          const json: AiQuotasResponse = await res.json();
          setData({
            ai_state: json.ai_state ?? 'inactive',
            account: json.account ?? null,
            providers: Array.isArray(json.providers)
              ? json.providers.filter((p) => p.connected)
              : [],
          });
        }
      } catch {
        // Silent fallback when offline (REQ-010)
      }
    };

    fetchQuotas();
    const interval = setInterval(fetchQuotas, 3000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      data-testid="activity-monitor"
      className="p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg text-xs space-y-2 select-none"
    >
      {/* Header: AI Quotas */}
      <div className="flex items-center justify-between gap-1.5">
        <div
          className="flex items-center gap-1.5 text-zinc-300 font-semibold tracking-wide min-w-0"
          title={
            data.account
              ? `${data.account.email}${data.account.tier ? ` (${data.account.tier})` : ''}`
              : 'AI CLI Quota Monitor'
          }
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-[11px] uppercase tracking-wider truncate">
            AI Quotas
          </span>
        </div>
      </div>

      {/* Connected Provider Quota Lines (Line 1: Gemini weekly + 5h; Line 2: Claude / others) */}
      {data.providers.length > 0 ? (
        <div className="space-y-1.5 pt-0.5">
          {data.providers.map((provider) => {
            const hasFiveHour =
              provider.id !== 'argon' &&
              (provider.five_hour !== undefined
                ? Boolean(provider.five_hour)
                : provider.five_hour_remaining_pct !== undefined);

            return (
              <div
                key={provider.id}
                data-testid={`quota-row-${provider.id}`}
                className="flex items-center justify-between gap-1.5 text-[11px] leading-tight"
              >
                <span className="text-zinc-300 font-medium shrink-0">
                  {provider.name}
                </span>

                <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-200 min-w-0">
                  {/* Weekly Limit Remaining */}
                  <div
                    className="flex items-center gap-1"
                    title={`Weekly Limit Remaining: ${provider.weekly?.remaining_pct ?? provider.weekly_remaining_pct}% (Resets in ${provider.weekly?.reset_in ?? provider.weekly_reset})`}
                  >
                    <span className="text-zinc-500 font-sans">W</span>
                    <span>{provider.weekly?.remaining_pct ?? provider.weekly_remaining_pct}%</span>
                    <QuotaRing percentage={provider.weekly?.remaining_pct ?? provider.weekly_remaining_pct} />
                    <span className="text-zinc-500 text-[9px]">
                      {provider.weekly?.reset_in ?? provider.weekly_reset}
                    </span>
                  </div>

                  {/* Five Hour Limit Remaining (REQ-006: only render when five_hour is not explicitly null and provider is not argon) */}
                  {hasFiveHour && (
                    <>
                      <span className="text-zinc-700">·</span>
                      <div
                        data-testid={`five-hour-meter-${provider.id}`}
                        className="flex items-center gap-1"
                        title={`Five Hour Limit Remaining: ${provider.five_hour?.remaining_pct ?? provider.five_hour_remaining_pct ?? 100}% (Resets in ${provider.five_hour?.reset_in ?? provider.five_hour_reset ?? '5h 0m'})`}
                      >
                        <span className="text-zinc-500 font-sans">5h</span>
                        <span>{provider.five_hour?.remaining_pct ?? provider.five_hour_remaining_pct ?? 100}%</span>
                        <QuotaRing percentage={provider.five_hour?.remaining_pct ?? provider.five_hour_remaining_pct ?? 100} />
                        <span className="text-zinc-500 text-[9px]">
                          {provider.five_hour?.reset_in ?? provider.five_hour_reset}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          data-testid="quota-empty-state"
          className="text-[10px] text-zinc-500 pt-0.5 truncate"
        >
          No AI CLI connected
        </div>
      )}
    </div>
  );
};
