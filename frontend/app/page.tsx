"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FileText,
  Shield,
  Lock,
  CheckCircle,
  ChevronDown,
  Zap,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Data ────────────────────────────────────────────────────────────────────

const DOC_TYPES = [
  {
    key: "gstr3b",
    name: "GSTR-3B",
    short: "Monthly GST return",
    description: "Extract outward supplies, ITC, tax liabilities and payables from monthly GST returns filed on the GSTN portal.",
    fields: [
      { label: "GSTIN", example: "27AAAFG1234A1Z5" },
      { label: "Tax Period", example: "January 2026" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Output IGST", example: "₹ 84,500" },
      { label: "Output CGST", example: "₹ 42,250" },
      { label: "Output SGST", example: "₹ 42,250" },
      { label: "ITC IGST", example: "₹ 31,200" },
      { label: "ITC CGST", example: "₹ 15,600" },
      { label: "ITC SGST", example: "₹ 15,600" },
      { label: "IGST Payable", example: "₹ 53,300" },
      { label: "CGST Payable", example: "₹ 26,650" },
      { label: "SGST Payable", example: "₹ 26,650" },
      { label: "Date of Filing", example: "20 Feb 2026" },
      { label: "Total Fields", example: "35 extracted" },
    ],
  },
  {
    key: "tds",
    name: "TDS ITNS281",
    short: "TDS payment challan",
    description: "Parse TDS/TCS challans from the TRACES/Income Tax portal. Extracts all breakdown components and deduction month.",
    fields: [
      { label: "TAN", example: "MUMG22556C" },
      { label: "Company Name", example: "GARWARE FULFLEX INDIA PVT LTD" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Section", example: "195" },
      { label: "Major Head", example: "Other than Companies" },
      { label: "Total Amount Paid", example: "₹ 1,34,723" },
      { label: "Tax", example: "₹ 1,34,723" },
      { label: "Surcharge", example: "₹ 0" },
      { label: "Cess", example: "₹ 0" },
      { label: "Interest", example: "₹ 0" },
      { label: "Challan No", example: "45389" },
      { label: "Payment Date", example: "06 Feb 2026" },
      { label: "Deduction Month", example: "January 2026" },
    ],
  },
  {
    key: "esic",
    name: "ESIC",
    short: "Employee State Insurance challan",
    description: "Extract employer and employee ESIC contributions from challan receipts downloaded from the ESIC portal.",
    fields: [
      { label: "Challan Period", example: "Jan-2026" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Employer Contribution", example: "₹ 18,450" },
      { label: "Employee Contribution", example: "₹ 7,380" },
      { label: "Total ESIC", example: "₹ 25,830" },
      { label: "Employer Challan No", example: "4521897630" },
      { label: "Employee Challan No", example: "4521897631" },
      { label: "Employer Challan Date", example: "15 Feb 2026" },
      { label: "Employee Challan Date", example: "15 Feb 2026" },
    ],
  },
  {
    key: "pf",
    name: "PF ECR",
    short: "Provident Fund challan",
    description: "Parse PF Electronic Challan Cum Return documents from the EPFO portal with full account-wise breakdowns.",
    fields: [
      { label: "Establishment Code", example: "MH/BAN/0012345/000" },
      { label: "Establishment Name", example: "GARWARE FULFLEX INDIA" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Wage Month", example: "January 2026" },
      { label: "Employer EPF (AC01)", example: "₹ 43,200" },
      { label: "Employer EPS (AC10)", example: "₹ 32,400" },
      { label: "Employer EDLI (AC21)", example: "₹ 3,600" },
      { label: "PF Admin (AC02)", example: "₹ 2,160" },
      { label: "EDLI Admin (AC22)", example: "₹ 360" },
      { label: "Employee EPF (AC01)", example: "₹ 43,200" },
      { label: "Grand Total", example: "₹ 1,24,920" },
    ],
  },
  {
    key: "ptrc",
    name: "PTRC",
    short: "Professional Tax challan",
    description: "Extract Maharashtra Professional Tax Return Cum Challan details from MTR Form 6 receipts.",
    fields: [
      { label: "Type of Return", example: "Maharashtra Profession Tax PTRC" },
      { label: "TAN", example: "MUMG22556C" },
      { label: "Company Name", example: "GARWARE FULFLEX INDIA PVT LTD" },
      { label: "PTRC Return Month", example: "Jan 2026" },
      { label: "Date of Filing", example: "20/02/2026" },
      { label: "Year", example: "2026" },
      { label: "PT Paid", example: "₹ 2,500" },
      { label: "Challan No.", example: "MH2026021500001" },
    ],
  },
];

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    pdfCount: "2 PDFs / month",
    features: ["All 5 document types", "Excel download", "Email support"],
    cta: "Get Started Free",
    featured: false,
    dark: false,
    recommended: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: "₹249",
    period: "/ month",
    pdfCount: "25 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Email support"],
    cta: "Start Starter",
    featured: false,
    dark: false,
    recommended: false,
  },
  {
    key: "standard",
    name: "Standard",
    price: "₹449",
    period: "/ month",
    pdfCount: "50 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Priority support"],
    cta: "Start Standard",
    featured: true,
    dark: false,
    recommended: true,
  },
  {
    key: "pro",
    name: "Pro",
    price: "₹699",
    period: "/ month",
    pdfCount: "120 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Priority support", "Dedicated account manager"],
    cta: "Start Pro",
    featured: false,
    dark: true,
    recommended: false,
  },
];

const FAQS = [
  {
    q: "Is my data secure?",
    a: "Yes. StatutorySync processes PDFs entirely in server memory and discards them immediately after parsing. No file bytes are written to disk or stored in any database. We are DPDP-compliant — only a SHA-256 hash of the filename and a timestamp are retained for usage tracking.",
  },
  {
    q: "What happens to my PDFs after parsing?",
    a: "Nothing — they are gone. The moment parsing completes and your structured data is returned to the browser, the file is discarded from server memory. There is no storage, no queue, no backup. Your clients' financial data never rests on our infrastructure.",
  },
  {
    q: "Which PDF formats are supported?",
    a: "We support text-layer PDFs generated directly by official government portals: GSTN (GSTR-3B), TRACES/Income Tax (TDS ITNS281), ESIC portal, EPFO (PF ECR), and Maharashtra's e-payment portal (PTRC). Scanned or image-only PDFs are not supported — OCR is on our roadmap.",
  },
  {
    q: "Can I process PDFs from any portal?",
    a: "Currently we support the five specific document types listed above. Each parser is purpose-built for the exact layout and field structure of that document — generic OCR would give unreliable results for statutory compliance data. We add new document types based on demand.",
  },
  {
    q: "What does 'PDFs / month' mean?",
    a: "Each individual PDF file you upload and parse counts as one unit. If you upload 5 TDS challans in one batch, that counts as 5. The counter resets on your billing anniversary date each month. Unused capacity does not roll over.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left text-foreground hover:text-primary transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium pr-8">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 flex-shrink-0",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="pb-5 text-muted-foreground text-sm leading-relaxed pr-8">
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [activeDoc, setActiveDoc] = useState("gstr3b");
  const activeDocData = DOC_TYPES.find((d) => d.key === activeDoc) ?? DOC_TYPES[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans">

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-15 flex items-center justify-between" style={{ height: "60px" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-lg text-primary tracking-tight">StatutorySync</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Pricing
            </a>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Login
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold h-8 px-4 text-sm">
                Start Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="text-[#0F766E] text-xs font-semibold tracking-widest uppercase">
                  Statutory Compliance Automation
                </span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight mb-6" style={{ letterSpacing: "-0.02em" }}>
                Your clients&apos; PDFs.<br />
                <span className="text-[#F59E0B]">Structured data.</span><br />
                Instantly.
              </h1>
              <p className="text-lg text-[#CBD5E1] leading-relaxed mb-8 max-w-lg">
                Stop copying figures from GSTR-3B, TDS challans, and PF returns into Excel by hand.
                Upload the PDF — get the data.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] font-semibold px-8 h-12 text-base gap-2"
                  >
                    Start Free — No card needed
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-6 text-sm text-[#94A3B8]">
                <span><strong className="text-white font-semibold">500+</strong> CAs</span>
                <span className="text-[#334155]">·</span>
                <span><strong className="text-white font-semibold">5</strong> document types</span>
                <span className="text-[#334155]">·</span>
                <span><strong className="text-white font-semibold">Zero</strong> data stored</span>
              </div>
            </div>

            {/* Right: Extraction preview */}
            <div className="lg:justify-self-end w-full max-w-md">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-[#334155]" style={{ background: "#0F1C2E" }}>
                {/* Header bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E3A5F]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#64748B]">TDS_ITNS281_Jan2026.pdf</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-900/40 text-emerald-400 text-xs font-medium px-2 py-0.5 rounded-full border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Parsed
                  </span>
                </div>
                {/* Fields */}
                <div className="p-4 space-y-0">
                  {[
                    { label: "TAN", value: "MUMG22556C" },
                    { label: "Company", value: "GARWARE FULFLEX INDIA PVT LTD" },
                    { label: "Financial Year", value: "2025-26" },
                    { label: "Section", value: "195" },
                    { label: "Major Head", value: "Other than Companies" },
                    { label: "Amount Paid", value: "₹ 1,34,723" },
                    { label: "Tax", value: "₹ 1,34,723" },
                    { label: "Surcharge", value: "₹ 0" },
                    { label: "Challan No", value: "45389" },
                    { label: "Payment Date", value: "06 Feb 2026" },
                    { label: "Deduction Month", value: "January 2026" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between py-1.5 border-b border-[#1E293B] last:border-0">
                      <span className="font-mono text-xs text-[#0F766E] shrink-0 w-36">{label}</span>
                      <span className="font-mono text-xs text-[#E2E8F0] text-right truncate ml-2">{value}</span>
                    </div>
                  ))}
                </div>
                {/* Footer */}
                <div className="px-4 py-3 border-t border-[#1E3A5F] flex items-center justify-between">
                  <span className="font-mono text-xs text-[#475569]">11 fields extracted</span>
                  <span className="font-mono text-xs text-[#475569]">0.8s</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Trust bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-xs text-muted-foreground font-medium">Trusted by CA firms across India for</span>
          {[
            { icon: Shield, label: "DPDP Compliant" },
            { icon: Lock, label: "Zero data stored" },
            { icon: FileText, label: "Govt portal PDFs only" },
            { icon: FileSpreadsheet, label: "Excel & Google Sheets" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 text-secondary flex-shrink-0" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Document Types Interactive ─────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-secondary mb-3">What we parse</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Every statutory document,<br className="hidden sm:block" /> exactly the fields you need.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 border border-border rounded-xl overflow-hidden">
            {/* Left: Doc type list */}
            <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-border">
              {DOC_TYPES.map((doc, i) => (
                <button
                  key={doc.key}
                  onClick={() => setActiveDoc(doc.key)}
                  className={cn(
                    "w-full text-left px-6 py-5 flex items-start justify-between gap-4 transition-colors",
                    i !== DOC_TYPES.length - 1 && "border-b border-border",
                    activeDoc === doc.key
                      ? "bg-primary/5 border-l-2 border-l-primary"
                      : "hover:bg-muted/50 border-l-2 border-l-transparent"
                  )}
                >
                  <div>
                    <p className={cn("font-semibold text-sm", activeDoc === doc.key ? "text-primary" : "text-foreground")}>
                      {doc.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{doc.short}</p>
                  </div>
                  {activeDoc === doc.key && (
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Right: Field table */}
            <div className="lg:col-span-3 p-6 lg:p-8">
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                {activeDocData.description}
              </p>
              <div className="space-y-0">
                <div className="grid grid-cols-2 gap-4 pb-2 mb-1 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Field</span>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Example Value</span>
                </div>
                {activeDocData.fields.map(({ label, example }) => (
                  <div key={label} className="grid grid-cols-2 gap-4 py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm text-foreground">{label}</span>
                    <span className="font-mono text-xs text-secondary">{example}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Before / After ─────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-secondary mb-3">The time difference</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              A compliance task that used to take 45 minutes.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Before */}
            <div className="rounded-xl border border-border bg-white p-8">
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="text-xs font-semibold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-wide">Before</span>
                <span className="text-xs text-muted-foreground">~45 minutes per client</span>
              </div>
              <div className="space-y-3">
                {[
                  "Open the GSTN portal and download GSTR-3B PDF",
                  "Open Excel, create a new row for the client",
                  "Manually type each figure — Output IGST, CGST, SGST...",
                  "Open the TRACES portal for TDS challan",
                  "Copy TAN, amount, challan number, date into Excel",
                  "Repeat for ESIC, PF, PTRC challans",
                  "Cross-check figures — one mistype = wrong workpaper",
                  "Format the sheet, send to partner for review",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0 mt-0.5 text-muted-foreground">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* After */}
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-8">
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="text-xs font-semibold text-secondary bg-secondary/10 px-3 py-1 rounded-full uppercase tracking-wide">After</span>
                <span className="text-xs text-secondary font-medium">~45 seconds per client</span>
              </div>
              <div className="space-y-3">
                {[
                  { step: "Upload PDFs", sub: "Drag and drop up to 20 at once — any combination of doc types" },
                  { step: "Select document type", sub: "One tab click: GSTR-3B, TDS, ESIC, PF ECR, or PTRC" },
                  { step: "Click Process", sub: "Purpose-built parser extracts every field in under 3 seconds" },
                  { step: "Download Excel or push to Sheets", sub: "Formatted output ready for your master compliance register" },
                ].map(({ step, sub }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-secondary/20">
                <Link href="/signup">
                  <Button className="bg-secondary hover:bg-secondary/90 text-white font-semibold gap-2 w-full sm:w-auto">
                    Try it free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section className="bg-white py-20" id="pricing">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-secondary mb-3">Pricing</p>
            <h2 className="text-3xl lg:text-4xl font-bold text-primary tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Simple. No surprises.
            </h2>
            <p className="text-muted-foreground mt-3">Start free. Upgrade when you need more PDFs.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "rounded-xl border p-6 flex flex-col relative",
                  plan.dark
                    ? "bg-primary border-primary text-white"
                    : plan.featured
                    ? "border-secondary border-l-4 bg-white shadow-sm"
                    : "bg-white border-border"
                )}
              >
                {plan.recommended && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-secondary mb-4 uppercase tracking-wide">
                    <Zap className="h-3 w-3" />
                    Recommended
                  </span>
                )}

                <div className="mb-5">
                  <h3 className={cn("text-sm font-semibold mb-2 uppercase tracking-wide", plan.dark ? "text-white/70" : "text-muted-foreground")}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-4xl font-bold tracking-tight", plan.dark ? "text-white" : "text-foreground")}>
                      {plan.price}
                    </span>
                    <span className={cn("text-sm", plan.dark ? "text-white/60" : "text-muted-foreground")}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={cn("text-sm font-medium mt-1.5", plan.dark ? "text-[#F59E0B]" : "text-secondary")}>
                    {plan.pdfCount}
                  </p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <CheckCircle className={cn("h-4 w-4 mt-0.5 flex-shrink-0", plan.dark ? "text-[#F59E0B]" : "text-secondary")} />
                      <span className={cn(plan.dark ? "text-white/85" : "text-muted-foreground")}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/signup">
                  <Button
                    className={cn(
                      "w-full font-semibold",
                      plan.dark
                        ? "bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A]"
                        : plan.featured
                        ? "bg-secondary hover:bg-secondary/90 text-white"
                        : ""
                    )}
                    variant={plan.dark || plan.featured ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-8 py-4 border-t border-border flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">All plans include:</span>
            {["All 5 document types", "Excel download", "DPDP compliant", "No data stored"].map((f) => (
              <span key={f} className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-secondary" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="max-w-2xl mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-secondary mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-primary tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              Questions
            </h2>
          </div>
          <div className="divide-y-0">
            {FAQS.map((faq) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-primary text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            {/* Col 1 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-white/15 rounded flex items-center justify-center">
                  <FileText className="h-3 w-3 text-white" />
                </div>
                <span className="font-semibold text-white">StatutorySync</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">
                Statutory dues compliance automation for Indian CA professionals.
              </p>
            </div>
            {/* Col 2 */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">Product</p>
              <div className="space-y-2">
                {[
                  { label: "Upload & Parse", href: "/upload" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Login", href: "/login" },
                  { label: "Sign Up Free", href: "/signup" },
                ].map(({ label, href }) => (
                  <div key={label}>
                    <Link href={href} className="text-sm text-white/60 hover:text-white transition-colors">
                      {label}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            {/* Col 3 */}
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-3">Legal</p>
              <div className="space-y-2">
                <div>
                  <Link href="/privacy" className="text-sm text-white/60 hover:text-white transition-colors">Privacy Policy</Link>
                </div>
                <div>
                  <Link href="/terms" className="text-sm text-white/60 hover:text-white transition-colors">Terms of Service</Link>
                </div>
              </div>
              <p className="text-xs text-white/40 mt-6">Built for Indian CA professionals</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6">
            <p className="text-xs text-white/40">
              &copy; 2026 StatutorySync. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
