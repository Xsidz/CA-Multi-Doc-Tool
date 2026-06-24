"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api-client";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; confirm_close?: boolean; animation?: boolean };
  config?: Record<string, unknown>;
}

interface RazorpayInstance {
  open(): void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const PLANS = [
  {
    name: "Free",
    price: "₹0",
    plan: null as null,
    limit: "2 PDFs / month",
    features: ["All 5 document types", "Excel download"],
    featured: false,
  },
  {
    name: "Starter",
    price: "₹249",
    plan: "starter" as const,
    limit: "25 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Email support"],
    featured: false,
  },
  {
    name: "Standard",
    price: "₹449",
    plan: "standard" as const,
    limit: "50 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Priority support"],
    featured: true,
  },
  {
    name: "Pro",
    price: "₹699",
    plan: "pro" as const,
    limit: "120 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Priority support", "Early V2 AI access"],
    featured: false,
  },
];

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

export default function BillingPage() {
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  async function handleUpgrade(planKey: "starter" | "standard" | "pro") {
    setLoadingPlan(planKey);

    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: "Not logged in", variant: "destructive" });
      setLoadingPlan(null);
      return;
    }

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load Razorpay checkout");

      const order = await apiClient.post<{
        order_id: string;
        amount: number;
        currency: string;
        plan: string;
        key_id: string;
      }>("/payments/create-order", { plan: planKey });

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "StatutorySync",
        description: `${planKey.charAt(0).toUpperCase() + planKey.slice(1)} Plan — Monthly`,
        order_id: order.order_id,
        prefill: {
          email: session.user.email,
          contact: "9999999999",
        },
        config: {
          display: {
            blocks: {
              banks: { name: "Pay via UPI", instruments: [{ method: "upi" }] },
              card: { name: "Pay via Card", instruments: [{ method: "card" }] },
            },
            sequence: ["block.banks", "block.card"],
            preferences: { show_default_blocks: true },
          },
        },
        theme: { color: "#1E3A5F" },
        modal: {
          ondismiss: () => {
            toast({ title: "Payment cancelled" });
            setLoadingPlan(null);
          },
          confirm_close: false,
          animation: true,
        },
        handler: async (response: RazorpayResponse) => {
          try {
            const result = await apiClient.post<{ success: boolean; plan: string; pdf_limit: number }>(
              "/payments/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan: planKey,
              }
            );
            if (result.success) {
              toast({
                title: "Payment successful!",
                description: `${result.plan} plan activated — ${result.pdf_limit} PDFs/month.`,
              });
              window.location.reload();
            }
          } catch {
            toast({
              title: "Verification failed",
              description: `Contact support. Payment ID: ${response.razorpay_payment_id}`,
              variant: "destructive",
            });
          } finally {
            setLoadingPlan(null);
          }
        },
      });

      rzp.open();
    } catch (err) {
      toast({
        title: "Payment initiation failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
      setLoadingPlan(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Billing &amp; Plans</h1>
        <p className="text-muted-foreground mt-1">
          Choose the plan that fits your practice. Upgrade anytime.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => (
          <Card
            key={p.name}
            className={`relative flex flex-col ${
              p.featured ? "border-2 border-secondary shadow-lg" : "border border-border"
            }`}
          >
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-secondary text-white text-xs px-3 py-1">
                  Most Popular
                </Badge>
              </div>
            )}
            <CardHeader className="pb-2">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {p.name}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-bold text-foreground">{p.price}</span>
                {p.plan && <span className="text-sm text-muted-foreground">/month</span>}
              </div>
              <p className="text-sm text-secondary font-medium">{p.limit}</p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-4">
              <ul className="space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {p.plan ? (
                <Button
                  className={`w-full mt-auto ${
                    p.featured
                      ? "bg-secondary hover:bg-secondary/90 text-white"
                      : "bg-primary hover:bg-primary/90 text-white"
                  }`}
                  disabled={loadingPlan === p.plan}
                  onClick={() => handleUpgrade(p.plan!)}
                >
                  {loadingPlan === p.plan ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Upgrade to {p.name}
                    </span>
                  )}
                </Button>
              ) : (
                <Button variant="outline" disabled className="w-full mt-auto">
                  Current Free Plan
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-6 text-center">
        Payments processed securely by Razorpay. UPI, cards, netbanking accepted.
        Plans renew monthly.
      </p>
    </div>
  );
}
