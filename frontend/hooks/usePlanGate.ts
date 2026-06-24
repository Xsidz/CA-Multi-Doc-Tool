import { useUsage } from "./useUsage";

export function usePlanGate() {
  const { used, limit, plan, isLoading } = useUsage();

  function allowed(n: number): boolean {
    if (isLoading) return true; // optimistic
    return used + n <= limit;
  }

  return {
    allowed,
    used,
    limit,
    plan,
    isLoading,
  };
}
