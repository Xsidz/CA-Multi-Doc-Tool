import Link from "next/link";
import { Upload, FileText, TrendingUp } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const PLAN_LIMITS: Record<string, number> = {
  free: 2,
  starter: 50,
  standard: 150,
  pro: 500,
};

export default async function DashboardPage() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  const userEmail = session?.user?.email ?? "";
  const userMeta = session?.user?.user_metadata ?? {};
  const displayName = userMeta.full_name ?? userEmail.split("@")[0] ?? "there";

  // Fetch usage
  let used = 0;
  let plan = "free";
  let limit = 2;

  if (userId) {
    const { data: usageRow } = await supabase
      .from("usage_this_period")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (usageRow) {
      used = usageRow.files_used ?? 0;
      plan = usageRow.plan ?? "free";
      limit = PLAN_LIMITS[plan] ?? 2;
    }
  }

  // Fetch recent activity
  let recentLogs: Array<{
    id: string;
    doc_type: string;
    status: string;
    created_at: string;
  }> = [];

  if (userId) {
    const { data: logs } = await supabase
      .from("usage_logs")
      .select("id, doc_type, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    recentLogs = logs ?? [];
  }

  const percentUsed = limit > 0 ? Math.round((used / limit) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-primary">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your compliance overview for this month.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">PDFs Used This Month</span>
              <FileText className="h-4 w-4 text-secondary" />
            </div>
            <div className="text-3xl font-bold text-primary">
              {used}
              <span className="text-lg font-normal text-muted-foreground"> / {limit}</span>
            </div>
            <Progress value={percentUsed} className="mt-3" />
            <div className="flex items-center justify-between mt-2">
              <Badge variant={plan === "free" ? "outline" : "default"} className="text-xs capitalize">
                {plan} plan
              </Badge>
              <span className="text-xs text-muted-foreground">{percentUsed}% used</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Documents Parsed</span>
              <TrendingUp className="h-4 w-4 text-secondary" />
            </div>
            <div className="text-3xl font-bold text-primary">{used}</div>
            <p className="text-xs text-muted-foreground mt-2">This billing period</p>
          </CardContent>
        </Card>

        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-secondary font-medium">Quick Action</span>
              <Upload className="h-4 w-4 text-secondary" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Upload and parse your statutory PDFs now
            </p>
            <Link href="/upload">
              <Button className="w-full" size="sm">
                Upload PDFs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-primary">Recent Activity</h2>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No activity yet.</p>
              <Link href="/upload" className="mt-3 inline-block">
                <Button variant="outline" size="sm">Upload your first PDF</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground uppercase">{log.doc_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={log.status === "success" ? "success" : "destructive"}
                    className="text-xs"
                  >
                    {log.status === "success" ? "Parsed" : log.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
