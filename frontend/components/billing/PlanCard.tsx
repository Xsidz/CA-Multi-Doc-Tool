"use client";

import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanKey = "free" | "starter" | "standard" | "pro";

interface PlanCardProps {
  plan: PlanKey;
  price: string;
  limit: string;
  features: string[];
  isCurrent?: boolean;
  isFeatured?: boolean;
  onUpgrade?: () => void;
}

const PLAN_LABELS: Record<PlanKey, string> = {
  free: "Free",
  starter: "Starter",
  standard: "Standard",
  pro: "Pro",
};

export function PlanCard({
  plan,
  price,
  limit,
  features,
  isCurrent,
  isFeatured,
  onUpgrade,
}: PlanCardProps) {
  const label = PLAN_LABELS[plan];

  return (
    <div
      className={cn(
        "relative rounded-xl border p-6 flex flex-col transition-shadow",
        isFeatured
          ? "bg-primary border-primary text-white shadow-xl"
          : isCurrent
          ? "border-secondary shadow-sm ring-2 ring-secondary/20 bg-white"
          : "border-border bg-white hover:shadow-md"
      )}
    >
      {/* Badges */}
      {isFeatured && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
            Most Popular
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-secondary text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 mt-1">
        <h3
          className={cn(
            "text-lg font-bold mb-1",
            isFeatured ? "text-white" : "text-primary"
          )}
        >
          {label}
        </h3>
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              "text-3xl font-bold",
              isFeatured ? "text-white" : "text-foreground"
            )}
          >
            {price}
          </span>
          {plan !== "free" && (
            <span
              className={cn(
                "text-sm",
                isFeatured ? "text-white/70" : "text-muted-foreground"
              )}
            >
              / month
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-sm font-semibold mt-1",
            isFeatured ? "text-accent" : "text-secondary"
          )}
        >
          {limit}
        </p>
      </div>

      {/* Feature list */}
      <ul className="space-y-2.5 flex-1 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <CheckCircle
              className={cn(
                "h-4 w-4 mt-0.5 flex-shrink-0",
                isFeatured ? "text-accent" : "text-secondary"
              )}
            />
            <span
              className={cn(
                isFeatured ? "text-white/90" : "text-muted-foreground"
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {isCurrent ? (
        <Button disabled className="w-full font-semibold opacity-70" variant="outline">
          Current Plan
        </Button>
      ) : (
        <Button
          onClick={onUpgrade}
          className={cn(
            "w-full font-semibold",
            isFeatured
              ? "bg-accent hover:bg-accent/90 text-accent-foreground"
              : "bg-primary hover:bg-primary/90 text-white"
          )}
        >
          Upgrade to {label}
        </Button>
      )}
    </div>
  );
}
