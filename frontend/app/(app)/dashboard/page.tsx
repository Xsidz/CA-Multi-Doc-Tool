import Link from "next/link";
import { Upload, FileText, TrendingUp, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DocTypeDonutChart } from "@/components/dashboard/DocTypeDonutChart";

const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 25,
  standard: 50,
  pro: 120,
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-secondary/10 text-secondary",
  standard: "bg-accent/10 text-amber-700",
  pro: "bg-primary/10 text-primary",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  gstr3b: "GSTR-3B",
  esic: "ESIC",
  pf_ecr: "PF ECR",
  ptrc: "PTRC",
  tds_itns281: "TDS",
};

export default async function DashboardPage() {
  const supabase = createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "";
  const userMeta = session?.user?.user_metadata ?? {};
  const displayName = userMeta.full_name ?? userEmail.split("@")[0] ?? "there";

  let used = 0;
  let plan = "free";
  let limit = 2;
  let periodEnd: string | null = null;

  if (userId) {
    const { data: usageRow } = await supabase
      .from("usage_this_period")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (usageRow) {
      used = usageRow.files_used ?? 0;
      plan = usageRow.plan ?? "free";
      limit = usageRow.pdf_limit ?? PLAN_LIMITS[plan] ?? 2;
      periodEnd = usageRow.period_end ?? null;
    }
  }

  // Fetch doc type breakdown
  type DocTypeRow = { doc_type: string };
  let docTypeLogs: DocTypeRow[] = [];
  if (userId) {
    const { data: logs } = await supabase
      .from("usage_logs")
      .select("doc_type")
      .eq("user_id", userId)
      .eq("status", "success");
    docTypeLogs = (logs ?? []) as DocTypeRow[];
  }

  // Aggregate by doc type
  const docTypeCounts: Record<string, number> = {};
  for (const row of docTypeLogs) {
    docTypeCounts[row.doc_type] = (docTypeCounts[row.doc_type] ?? 0) + 1;
  }
  const docTypeData = Object.entries(docTypeCounts).map(([key, count]) => ({
    name: DOC_TYPE_LABELS[key] ?? key.toUpperCase(),
    value: count,
  }));

  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const remaining = limit - used;

  // Format renewal date
  const renewalDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : null;

  const isEmptyState = used === 0;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-primary tracking-tight">
          Welcome back, {displayName} 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Here&apos;s your compliance overview for this billing period.
        </p>
      </div>

      {/* Empty state — first-time user */}
      {isEmptyState ? (
        <Card className="border-dashed border-2 border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="h-6 w-6 text-secondary" />
            </div>
            <h2 className="text-lg font-semibold text-primary mb-2">Get started in 3 steps</h2>
            <div className="flex flex-col items-center gap-3 mt-4 max-w-sm mx-auto text-left">
              {[
                "Select your document type (GSTR-3B, TDS, PF, ESIC, PTRC)",
                "Upload one or more PDF receipts or returns",
                "Download as Excel or push to Google Sheets",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0 text-xs font-bold text-foreground mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm text-muted-foreground">{step}</p>
                </div>
              ))}
            </div>
            <Link href="/upload" className="mt-6 inline-block">
              <Button className="bg-accent hover:bg-accent/90 text-foreground font-semibold gap-2">
                <Upload className="h-4 w-4" />
                Upload your first PDF
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Row 1 — KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* PDFs Used */}
            <Card className="border-border">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PDFs This Month</span>
                  <FileText className="h-4 w-4 text-secondary" />
                </div>
                <div className="text-3xl font-bold text-primary tabular-nums">
                  {used}
                  <span className="text-base font-normal text-muted-foreground"> / {limit}</span>
                </div>
                <Progress value={percentUsed} className="mt-3 h-1.5" />
                <p className="text-xs text-muted-foreground mt-2">
                  {remaining > 0 ? (
                    <span><strong className="text-foreground">{remaining}</strong> remaining this period</span>
                  ) : (
                    <span className="text-destructive font-medium">Limit reached — upgrade to continue</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Plan Status */}
            <Card className="border-border">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plan Status</span>
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-primary capitalize">{plan}</span>
                  <Badge className={`text-xs capitalize font-semibold ${PLAN_COLORS[plan] ?? ""}`}>
                    Active
                  </Badge>
                </div>
                {renewalDate && (
                  <p className="text-xs text-muted-foreground">Renews {renewalDate}</p>
                )}
                {plan === "free" && (
                  <Link href="/settings/billing" className="mt-3 inline-block">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1 border-secondary/40 text-secondary hover:bg-secondary/5">
                      <Zap className="h-3 w-3" />
                      Upgrade plan
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-primary/3 border-primary/15">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Actions</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2">
                  <Link href="/upload" className="block">
                    <Button size="sm" className="w-full bg-accent hover:bg-accent/90 text-foreground font-semibold gap-2 justify-start">
                      <Upload className="h-3.5 w-3.5" />
                      Upload PDFs
                    </Button>
                  </Link>
                  <Link href="/settings/billing" className="block">
                    <Button size="sm" variant="outline" className="w-full gap-2 justify-start text-xs">
                      <Zap className="h-3.5 w-3.5" />
                      Manage plan
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2 — Insights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Doc type breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-semibold text-primary">Document Type Breakdown</h2>
                <p className="text-xs text-muted-foreground">All-time parsed documents by type</p>
              </CardHeader>
              <CardContent>
                {docTypeData.length > 0 ? (
                  <DocTypeDonutChart data={docTypeData} total={docTypeLogs.length} />
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">
                    No data yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage insight */}
            <Card>
              <CardHeader className="pb-2">
                <h2 className="text-sm font-semibold text-primary">Usage This Period</h2>
                <p className="text-xs text-muted-foreground">
                  {plan.charAt(0).toUpperCase() + plan.slice(1)} plan · {limit} PDFs/month
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Big progress */}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>{used} used</span>
                    <span>{limit} total</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-3 rounded-full transition-all duration-500 ${
                        percentUsed >= 100
                          ? "bg-destructive"
                          : percentUsed >= 80
                          ? "bg-amber-500"
                          : "bg-secondary"
                      }`}
                      style={{ width: `${Math.min(percentUsed, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    <strong className={`${percentUsed >= 80 ? "text-amber-600" : "text-foreground"}`}>
                      {percentUsed}%
                    </strong>
                    {" "}of monthly quota used
                  </p>
                </div>

                {/* Tip */}
                <div className="rounded-lg bg-muted/50 p-3 border border-border">
                  <p className="text-xs text-muted-foreground">
                    {percentUsed >= 80
                      ? "⚡ You're running low. Consider upgrading to avoid interruptions."
                      : percentUsed === 0
                      ? "📄 Upload your first PDFs to see parsing insights here."
                      : `✅ You've parsed ${used} document${used !== 1 ? "s" : ""} this period. ${remaining} remaining.`}
                  </p>
                </div>

                {plan !== "pro" && (
                  <Link href="/settings/billing">
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1 border-secondary/40 text-secondary hover:bg-secondary/5">
                      <Zap className="h-3.5 w-3.5" />
                      Upgrade for more PDFs
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
