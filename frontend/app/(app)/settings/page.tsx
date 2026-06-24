"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { CheckCircle, Link2, Unlink } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [sheetsConnected, setSheetsConnected] = useState(false);
  const [connectingSheets, setConnectingSheets] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata ?? {};
      setFullName(meta.full_name ?? "");
      setCompanyName(meta.company_name ?? "");
    });

    apiClient.get<{ connected: boolean }>("/composio/status")
      .then((res) => setSheetsConnected(res.connected))
      .catch(() => setSheetsConnected(false))
      .finally(() => setLoadingStatus(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName, company_name: companyName },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile saved", description: "Your profile has been updated." });
    }
  }

  async function handleConnectSheets() {
    setConnectingSheets(true);
    try {
      const res = await apiClient.post<{ redirect_url: string }>("/composio/connect", {});
      window.location.href = res.redirect_url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to connect";
      toast({ title: "Error", description: message, variant: "destructive" });
      setConnectingSheets(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and integrations.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-primary">Profile</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ujwal Baheti"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="companyName">Company / Firm Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Baheti & Associates"
                className="mt-1"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Google Sheets */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Google Sheets</h2>
            {!loadingStatus && (
              <Badge variant={sheetsConnected ? "success" : "outline"}>
                {sheetsConnected ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Connected
                  </span>
                ) : (
                  "Not connected"
                )}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your Google account to export parsed data directly to Google Sheets.
          </p>
          {sheetsConnected ? (
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5">
              <Unlink className="h-4 w-4 mr-2" />
              Disconnect Google Sheets
            </Button>
          ) : (
            <Button onClick={handleConnectSheets} disabled={connectingSheets}>
              <Link2 className="h-4 w-4 mr-2" />
              {connectingSheets ? "Connecting..." : "Connect Google Sheets"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
