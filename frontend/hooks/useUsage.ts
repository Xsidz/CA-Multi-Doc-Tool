import useSWR from "swr";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { createBrowserClient } from "@/lib/supabase/client";

interface UsageData {
  pdfs_used: number;
  pdf_limit: number;
  plan: string;
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
    // Only fetch when we have a confirmed session — prevents Bearer null
    hasSession ? "/usage" : null,
    () => apiClient.get<UsageData>("/usage"),
    { revalidateOnFocus: true }
  );

  const plan = data?.plan ?? "free";
  const used = data?.pdfs_used ?? 0;
  const limit = data?.pdf_limit ?? PLAN_LIMITS[plan] ?? 2;
  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return {
    used,
    limit,
    plan,
    percentUsed,
    isLoading: !hasSession || isLoading,
    error,
    mutate,
  };
}
