"use client";

import { useUsage } from "@/hooks/useUsage";
import { Skeleton } from "@/components/ui/skeleton";

export function UsageBadge() {
  const { used, limit, addonCredits, effectiveLimit, percentUsed, isLoading } = useUsage();

  if (isLoading) {
    return (
      <div className="px-3 py-3 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  const progressColor =
    percentUsed >= 100
      ? "bg-destructive"
      : percentUsed >= 80
      ? "bg-accent"
      : "bg-secondary";

  return (
    <div className="px-3 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">PDFs this month</span>
        <span className="text-xs font-medium text-foreground">
          {used} / {effectiveLimit}
        </span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${progressColor}`}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
      {addonCredits > 0 && (
        <p className="text-xs mt-1.5 text-secondary font-medium">
          +{addonCredits} addon credits
        </p>
      )}
      {percentUsed >= 80 && addonCredits === 0 && (
        <p className="text-xs mt-1.5 text-amber-600 font-medium">
          {percentUsed >= 100 ? "Limit reached — buy credits or upgrade" : "Approaching limit"}
        </p>
      )}
    </div>
  );
}
