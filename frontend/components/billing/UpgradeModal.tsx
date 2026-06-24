"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  used: number;
  limit: number;
}

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Next plan after free is Starter
const NEXT_PLAN = { key: "starter" as const, name: "Starter", price: "₹249/mo", limit: "25 PDFs/month" };

export function UpgradeModal({ open, onClose, used, limit }: UpgradeModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Not logged in", variant: "destructive" });
      setLoading(false);
      return;
    }

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load Razorpay");

      const order = await apiClient.post<{
        order_id: string; amount: number; currency: string; key_id: string;
      }>("/payments/create-order", { plan: NEXT_PLAN.key });

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "StatutorySync",
        description: "Starter Plan — Monthly",
        order_id: order.order_id,
        prefill: { email: session.user.email },
        theme: { color: "#1E3A5F" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            await apiClient.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: NEXT_PLAN.key,
            });
            toast({ title: "Upgraded!", description: "Starter plan active — 25 PDFs/month." });
            onClose();
            window.location.reload();
          } catch {
            toast({ title: "Verification failed", description: `Save payment ID: ${response.razorpay_payment_id}`, variant: "destructive" });
          } finally {
            setLoading(false);
          }
        },
      });
      rzp.open();
    } catch (err) {
      toast({ title: "Payment failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">You&apos;ve reached your limit</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Used {used} of {limit} PDFs this month.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-primary">{NEXT_PLAN.name} — {NEXT_PLAN.price}</p>
          <p className="text-sm text-muted-foreground">{NEXT_PLAN.limit} · Excel + Google Sheets</p>
        </div>

        <Button
          className="w-full bg-accent hover:bg-accent/90 text-foreground font-semibold"
          disabled={loading}
          onClick={handleUpgrade}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-foreground border-t-transparent rounded-full" />
              Opening payment...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Upgrade Now — ₹249/month
            </span>
          )}
        </Button>

        <button onClick={onClose} className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}
