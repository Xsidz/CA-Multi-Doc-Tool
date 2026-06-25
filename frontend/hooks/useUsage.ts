import useSWR from "swr";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { createBrowserClient } from "@/lib/supabase/client";

interface UsageData {
  pdfs_used: number;
  pdf_limit: number;
  plan: string;
  addon_credits: number;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 25,
  standard: 50,
  pro: 120,
};

export function useUsage() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data, error, isLoading, mutate } = useSWR<UsageData>(
    hasSession ? "/usage" : null,
    () => apiClient.get<UsageData>("/usage"),
    { revalidateOnFocus: true }
  );

  const plan = data?.plan ?? "free";
  const used = data?.pdfs_used ?? 0;
  const limit = data?.pdf_limit ?? PLAN_LIMITS[plan] ?? 2;
  const addonCredits = data?.addon_credits ?? 0;
  const effectiveLimit = limit + addonCredits;
  const percentUsed = effectiveLimit > 0 ? Math.round((used / effectiveLimit) * 100) : 0;

  return {
    used,
    limit,
    addonCredits,
    effectiveLimit,
    plan,
    percentUsed,
    isLoading: !hasSession || isLoading,
    error,
    mutate,
  };
}
