"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  FileText,
  Shield,
  Lock,
  Check,
  ChevronDown,
  ArrowRight,
  FileSpreadsheet,
  CheckCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Design tokens (Coinbase-inspired, StatutorySync brand) ──────────────────
// Primary action: #1E3A5F (navy) — single action color, used scarcely
// Ink: #0a0b0d — display headlines, primary text
// Body: #5b616e — default running text
// Surface dark: #0a0b0d — dark hero background
// Surface dark elevated: #16181c — floating cards inside dark hero
// Canvas: #ffffff
// Surface strong: #eef0f3 — secondary button fills, badge pills
// Hairline: #dee1e6 — 1px dividers
// Teal semantic: #0F766E — success / green equivalent
// Saffron: #F59E0B — hero CTA accent

// ─── Data ────────────────────────────────────────────────────────────────────

// All sample data below is entirely fictional — no real company, TAN, GSTIN, or challan number.
const DOC_TYPES = [
  {
    key: "gstr3b",
    name: "GSTR-3B",
    short: "Monthly GST return",
    description: "Extract outward supplies, ITC utilisation, and tax payables from monthly GST returns filed on the GSTN portal.",
    fields: [
      { label: "GSTIN", example: "27AABCD1234E1ZP" },
      { label: "Tax Period", example: "January 2026" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Output IGST", example: "₹ 72,000" },
      { label: "Output CGST", example: "₹ 36,000" },
      { label: "Output SGST", example: "₹ 36,000" },
      { label: "Net Input IGST", example: "₹ 28,000" },
      { label: "Net Input CGST", example: "₹ 14,000" },
      { label: "Net Input SGST", example: "₹ 14,000" },
      { label: "IGST Payable", example: "₹ 44,000" },
      { label: "CGST Payable", example: "₹ 22,000" },
      { label: "SGST Payable", example: "₹ 22,000" },
      { label: "Interest Paid", example: "₹ 0" },
      { label: "Date of Filing", example: "20 Feb 2026" },
    ],
  },
  {
    key: "tds",
    name: "TDS ITNS281",
    short: "TDS payment challan",
    description: "Parse TDS/TCS challans from the TRACES / Income Tax portal. Extracts all breakdown components and infers the deduction month from payment date.",
    fields: [
      { label: "TAN", example: "BOMA99999X" },
      { label: "Company Name", example: "SAMPLE TRADING PVT LTD" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Section", example: "194C" },
      { label: "Major Head", example: "Other than Companies" },
      { label: "Total Amount Paid", example: "₹ 85,000" },
      { label: "Tax", example: "₹ 85,000" },
      { label: "Surcharge", example: "₹ 0" },
      { label: "Cess", example: "₹ 0" },
      { label: "Interest", example: "₹ 0" },
      { label: "Penalty", example: "₹ 0" },
      { label: "Challan No", example: "00001" },
      { label: "Payment Date", example: "07 Feb 2026" },
      { label: "Deduction Month", example: "January 2026" },
    ],
  },
  {
    key: "esic",
    name: "ESIC",
    short: "Employee State Insurance challan",
    description: "Extract employer and employee ESIC contributions from challan receipts, including separate challan numbers for each contribution type.",
    fields: [
      { label: "Challan Period", example: "Jan-2026" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Employer Contribution", example: "₹ 15,600" },
      { label: "Employee Contribution", example: "₹ 6,240" },
      { label: "Total ESIC", example: "₹ 21,840" },
      { label: "Employer Challan No", example: "9900000001" },
      { label: "Employee Challan No", example: "9900000002" },
      { label: "Employer Challan Date", example: "15 Feb 2026" },
      { label: "Employee Challan Date", example: "15 Feb 2026" },
    ],
  },
  {
    key: "pf",
    name: "PF ECR",
    short: "Provident Fund challan",
    description: "Parse PF Electronic Challan Cum Return documents from the EPFO portal with full account-wise breakdowns (AC01, AC02, AC10, AC21, AC22).",
    fields: [
      { label: "Establishment Code", example: "MH/TST/0099999/000" },
      { label: "Establishment Name", example: "SAMPLE TRADING PVT LTD" },
      { label: "Financial Year", example: "2025-26" },
      { label: "Wage Month", example: "January 2026" },
      { label: "Employer EPF (AC01)", example: "₹ 36,000" },
      { label: "Employer EPS (AC10)", example: "₹ 27,000" },
      { label: "Employer EDLI (AC21)", example: "₹ 3,000" },
      { label: "PF Admin (AC02)", example: "₹ 1,800" },
      { label: "EDLI Admin (AC22)", example: "₹ 300" },
      { label: "Employee EPF (AC01)", example: "₹ 36,000" },
      { label: "Grand Total", example: "₹ 1,04,100" },
      { label: "Challan Date", example: "14 Feb 2026" },
    ],
  },
  {
    key: "ptrc",
    name: "PTRC",
    short: "Professional Tax challan",
    description: "Extract Maharashtra Professional Tax Return Cum Challan details from MTR Form 6 receipts downloaded from Mahakosh.",
    fields: [
      { label: "Type of Return", example: "Maharashtra Profession Tax PTRC" },
      { label: "TAN", example: "BOMA99999X" },
      { label: "Company Name", example: "SAMPLE TRADING PVT LTD" },
      { label: "PTRC Return Month", example: "Jan 2026" },
      { label: "Date of Filing", example: "20/02/2026" },
      { label: "Year", example: "2026" },
      { label: "PT Paid", example: "₹ 2,500" },
      { label: "Challan No.", example: "MH2026020000001" },
    ],
  },
];

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "₹0",
    period: "",
    subtitle: "2 PDFs / month",
    features: ["All 5 document types", "Excel download", "Email support"],
    cta: "Get started",
    dark: false,
    featured: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: "₹249",
    period: "/mo",
    subtitle: "25 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Email support"],
    cta: "Get started",
    dark: false,
    featured: false,
  },
  {
    key: "standard",
    name: "Standard",
    price: "₹449",
    period: "/mo",
    subtitle: "50 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Priority support"],
    cta: "Get started",
    dark: true,
    featured: true,
  },
  {
    key: "pro",
    name: "Pro",
    price: "₹699",
    period: "/mo",
    subtitle: "120 PDFs / month",
    features: ["All 5 document types", "Excel + Google Sheets", "Priority support", "Dedicated account manager"],
    cta: "Get started",
    dark: false,
    featured: false,
  },
];

const FAQS = [
  {
    q: "Is my data secure?",
    a: "StatutorySync processes PDFs entirely in server memory and discards them immediately after parsing. No file bytes are written to disk or stored in any database. We are DPDP-compliant — only a SHA-256 hash of the filename and a timestamp are retained for usage tracking. Your clients' financial data never rests on our infrastructure.",
  },
  {
    q: "What happens to my PDFs after parsing?",
    a: "Nothing — they are gone. The moment parsing completes and your structured data is returned to the browser, the file is discarded from server memory. There is no storage, no queue, no backup.",
  },
  {
    q: "Which PDF formats are supported?",
    a: "We support text-layer PDFs generated directly by official government portals: GSTN (GSTR-3B), TRACES/Income Tax (TDS ITNS281), ESIC portal, EPFO (PF ECR), and Maharashtra's Mahakosh portal (PTRC). Scanned or image-only PDFs are not supported in V1.",
  },
  {
    q: "Can I process PDFs from any portal?",
    a: "Currently we support five specific document types. Each parser is purpose-built for the exact layout and field structure of that document — generic OCR gives unreliable results for statutory compliance data. We add new document types based on demand.",
  },
  {
    q: "What does 'PDFs / month' mean?",
    a: "Each individual PDF file you upload and parse counts as one unit. If you upload 5 TDS challans in one batch, that counts as 5. The counter resets on your billing anniversary date. Unused capacity does not roll over.",
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#dee1e6] last:border-0">
      <button
        className="w-full flex items-center justify-between py-5 text-left text-[#0a0b0d] hover:text-[#1E3A5F] transition-colors"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium text-base pr-8 leading-snug">{q}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-[#7c828a] transition-transform duration-200 flex-shrink-0", open && "rotate-180")}
        />
      </button>
      {open && (
        <p className="pb-5 text-[#5b616e] text-sm leading-relaxed pr-8">{a}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Hero preview samples (fictional — rotates every 3.5s) ───────────────────
const HERO_PREVIEWS = [
  {
    filename: "GSTR3B_Jan2026.pdf",
    label: "GSTR-3B",
    fieldCount: 14,
    duration: "1.2 s",
    fields: [
      { label: "GSTIN", value: "27AABCD1234E1ZP" },
      { label: "Tax Period", value: "January 2026" },
      { label: "Output IGST", value: "₹ 72,000" },
      { label: "Output CGST", value: "₹ 36,000" },
      { label: "Output SGST", value: "₹ 36,000" },
      { label: "Net ITC IGST", value: "₹ 28,000" },
      { label: "IGST Payable", value: "₹ 44,000" },
      { label: "CGST Payable", value: "₹ 22,000" },
      { label: "SGST Payable", value: "₹ 22,000" },
      { label: "Date of Filing", value: "20 Feb 2026" },
    ],
  },
  {
    filename: "TDS_ITNS281_Feb2026.pdf",
    label: "TDS ITNS281",
    fieldCount: 14,
    duration: "0.8 s",
    fields: [
      { label: "TAN", value: "BOMA99999X" },
      { label: "Company Name", value: "SAMPLE TRADING PVT LTD" },
      { label: "FY", value: "2025-26" },
      { label: "Section", value: "194C" },
      { label: "Major Head", value: "Other than Companies" },
      { label: "Total Amount", value: "₹ 85,000" },
      { label: "Tax", value: "₹ 85,000" },
      { label: "Surcharge", value: "₹ 0" },
      { label: "Challan No", value: "00001" },
      { label: "Deduction Month", value: "January 2026" },
    ],
  },
  {
    filename: "ESIC_Jan2026.pdf",
    label: "ESIC",
    fieldCount: 9,
    duration: "0.6 s",
    fields: [
      { label: "Challan Period", value: "Jan-2026" },
      { label: "Financial Year", value: "2025-26" },
      { label: "Employer Contribution", value: "₹ 15,600" },
      { label: "Employee Contribution", value: "₹ 6,240" },
      { label: "Total ESIC", value: "₹ 21,840" },
      { label: "Employer Challan No", value: "9900000001" },
      { label: "Employee Challan No", value: "9900000002" },
      { label: "Employer Date", value: "15 Feb 2026" },
      { label: "Employee Date", value: "15 Feb 2026" },
    ],
  },
  {
    filename: "PF_ECR_Jan2026.pdf",
    label: "PF ECR",
    fieldCount: 12,
    duration: "0.9 s",
    fields: [
      { label: "Establishment Code", value: "MH/TST/0099999/000" },
      { label: "Establishment Name", value: "SAMPLE TRADING PVT LTD" },
      { label: "Wage Month", value: "January 2026" },
      { label: "Employer EPF (AC01)", value: "₹ 36,000" },
      { label: "Employer EPS (AC10)", value: "₹ 27,000" },
      { label: "Employer EDLI (AC21)", value: "₹ 3,000" },
      { label: "PF Admin (AC02)", value: "₹ 1,800" },
      { label: "Employee EPF", value: "₹ 36,000" },
      { label: "Grand Total", value: "₹ 1,04,100" },
    ],
  },
  {
    filename: "PTRC_Feb2026.pdf",
    label: "PTRC",
    fieldCount: 8,
    duration: "0.5 s",
    fields: [
      { label: "TAN", value: "BOMA99999X" },
      { label: "Company Name", value: "SAMPLE TRADING PVT LTD" },
      { label: "PTRC Return Month", value: "Jan 2026" },
      { label: "Date of Filing", value: "20/02/2026" },
      { label: "PT Paid", value: "₹ 2,500" },
      { label: "Challan No.", value: "MH2026020000001" },
      { label: "Year", value: "2026" },
      { label: "Type", value: "Maharashtra PT PTRC" },
    ],
  },
];

export default function LandingPage() {
  const [activeDoc, setActiveDoc] = useState("gstr3b");
  const active = DOC_TYPES.find((d) => d.key === activeDoc) ?? DOC_TYPES[0];

  // Auto-rotate hero preview
  const [heroIdx, setHeroIdx] = useState(0);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setHeroIdx((i) => (i + 1) % HERO_PREVIEWS.length);
        setFading(false);
      }, 300);
    }, 3500);
    return () => clearInterval(timer);
  }, []);
  const heroPreview = HERO_PREVIEWS[heroIdx];

  return (
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#dee1e6]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 flex items-center justify-between" style={{ height: 64 }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-[15px] text-[#0a0b0d] tracking-tight">StatutorySync</span>
          </div>
          <div className="hidden sm:flex items-center gap-7">
            <a href="#how" className="text-[14px] font-medium text-[#5b616e] hover:text-[#0a0b0d] transition-colors">How it works</a>
            <a href="#pricing" className="text-[14px] font-medium text-[#5b616e] hover:text-[#0a0b0d] transition-colors">Pricing</a>
            <Link href="/login" className="text-[14px] font-medium text-[#5b616e] hover:text-[#0a0b0d] transition-colors">Sign in</Link>
          </div>
          <Link href="/signup">
            <button className="bg-[#1E3A5F] hover:bg-[#162d4a] text-white text-[15px] font-semibold px-5 h-[44px] rounded-full transition-colors">
              Get started
            </button>
          </Link>
        </div>
      </nav>

      {/* ── Hero — dark band ───────────────────────────────────────────────── */}
      <section style={{ background: "#0a0b0d" }} className="text-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

            {/* Left */}
            <div>
              {/* Badge pill */}
              <div className="inline-flex items-center gap-2 bg-[#16181c] border border-[#2a2e35] rounded-full px-4 py-1.5 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#05b169]"></span>
                <span className="text-[12px] font-semibold text-[#a8acb3] tracking-widest uppercase">Statutory Compliance Automation</span>
              </div>

              <h1
                className="text-white leading-[1.0] mb-6"
                style={{ fontSize: "clamp(44px, 5.5vw, 72px)", fontWeight: 400, letterSpacing: "-1.8px" }}
              >
                Your clients&rsquo;<br />
                PDFs.<br />
                <span style={{ color: "#F59E0B" }}>Structured data.</span><br />
                Instantly.
              </h1>

              <p className="text-[#a8acb3] text-[17px] leading-relaxed mb-10 max-w-[420px]">
                Stop copying figures from GSTR-3B, TDS challans, and PF returns into Excel by hand. Upload the PDF — get the data.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link href="/signup">
                  <button className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#0a0b0d] text-[16px] font-semibold px-8 h-[56px] rounded-full transition-colors">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
                <a href="#how">
                  <button className="bg-[#16181c] hover:bg-[#1e2127] text-white text-[16px] font-semibold px-8 h-[56px] rounded-full border border-[#2a2e35] transition-colors">
                    See how it works
                  </button>
                </a>
              </div>

              <div className="flex items-center gap-5 text-[13px] text-[#5b616e]">
                <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> DPDP compliant</span>
                <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Zero data stored</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> No credit card</span>
              </div>
            </div>

            {/* Right — product-UI mockup cards (Coinbase signature pattern) */}
            <div className="relative">
              {/* Main card — rotates through all 5 doc types */}
              <div
                className="rounded-2xl border border-[#2a2e35] overflow-hidden w-full transition-opacity duration-300"
                style={{ background: "#16181c", opacity: fading ? 0 : 1 }}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2e35]">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2a2e35]"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2a2e35]"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2a2e35]"></span>
                    </div>
                    <span className="font-mono text-[11px] text-[#5b616e] ml-1">{heroPreview.filename}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-900/30 border border-emerald-800/40 text-emerald-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Parsed
                  </span>
                </div>
                {/* Fields */}
                <div className="px-5 py-4">
                  {heroPreview.fields.map(({ label, value }) => (
                    <div key={label} className="flex items-baseline justify-between py-[7px] border-b border-[#1e2127] last:border-0">
                      <span className="font-mono text-[11px] text-[#0F766E] w-36 shrink-0">{label}</span>
                      <span className="font-mono text-[11px] text-[#e2e8f0] text-right ml-2 truncate">{value}</span>
                    </div>
                  ))}
                </div>
                {/* Card footer */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a2e35]">
                  <span className="font-mono text-[11px] text-[#3a3f47]">{heroPreview.fieldCount} fields · 0 errors</span>
                  <span className="font-mono text-[11px] text-[#3a3f47]">{heroPreview.duration}</span>
                </div>
              </div>
              {/* Rotation dots */}
              <div className="flex justify-center gap-1.5 mt-3">
                {HERO_PREVIEWS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setFading(true); setTimeout(() => { setHeroIdx(i); setFading(false); }, 300); }}
                    className="transition-all duration-200"
                    aria-label={HERO_PREVIEWS[i].label}
                  >
                    <span className={cn(
                      "block rounded-full transition-all duration-200",
                      i === heroIdx ? "w-4 h-1.5 bg-[#F59E0B]" : "w-1.5 h-1.5 bg-[#2a2e35] hover:bg-[#3a3f47]"
                    )} />
                  </button>
                ))}
              </div>

              {/* Floating secondary card */}
              <div
                className="absolute -bottom-4 -right-4 lg:-bottom-6 lg:-right-6 rounded-xl border border-[#2a2e35] p-4 w-48 shadow-2xl hidden lg:block"
                style={{ background: "#16181c" }}
              >
                <p className="text-[10px] font-semibold text-[#5b616e] uppercase tracking-widest mb-3">This session</p>
                {[
                  { name: "GSTR-3B", count: "12 files" },
                  { name: "TDS", count: "8 files" },
                  { name: "PF ECR", count: "5 files" },
                ].map(({ name, count }) => (
                  <div key={name} className="flex items-center justify-between py-1.5 border-b border-[#1e2127] last:border-0">
                    <span className="text-[12px] text-[#a8acb3]">{name}</span>
                    <span className="font-mono text-[12px] text-[#05b169]">{count}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Trust bar ──────────────────────────────────────────────────────── */}
      <div className="bg-[#f7f7f7] border-b border-[#dee1e6]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-[12px] text-[#7c828a] font-medium">Trusted by CA firms across India</span>
          {[
            { icon: Shield, label: "DPDP Compliant" },
            { icon: Lock, label: "Zero data stored" },
            { icon: FileText, label: "Official portal PDFs" },
            { icon: FileSpreadsheet, label: "Excel & Google Sheets" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 text-[#0F766E]" />
              <span className="text-[13px] text-[#5b616e]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Document types explorer ────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#0F766E] mb-3">What we extract</p>
            <h2
              className="text-[#0a0b0d]"
              style={{ fontSize: "clamp(36px, 3.5vw, 52px)", fontWeight: 400, letterSpacing: "-1.2px", lineHeight: 1.05 }}
            >
              Every statutory document,<br />
              every field you need.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 border border-[#dee1e6] rounded-2xl overflow-hidden">
            {/* Left list */}
            <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-[#dee1e6]">
              {DOC_TYPES.map((doc, i) => (
                <button
                  key={doc.key}
                  onClick={() => setActiveDoc(doc.key)}
                  className={cn(
                    "w-full text-left px-6 py-5 flex items-start justify-between gap-3 transition-colors",
                    i !== DOC_TYPES.length - 1 && "border-b border-[#dee1e6]",
                    activeDoc === doc.key
                      ? "bg-[#f7f7f7]"
                      : "hover:bg-[#fafafa]"
                  )}
                >
                  <div>
                    <p className={cn("text-[15px] font-semibold", activeDoc === doc.key ? "text-[#1E3A5F]" : "text-[#0a0b0d]")}>
                      {doc.name}
                    </p>
                    <p className="text-[13px] text-[#7c828a] mt-0.5">{doc.short}</p>
                  </div>
                  <ArrowRight className={cn("h-4 w-4 mt-0.5 flex-shrink-0 transition-colors", activeDoc === doc.key ? "text-[#1E3A5F]" : "text-[#dee1e6]")} />
                </button>
              ))}
            </div>

            {/* Right fields */}
            <div className="lg:col-span-3 p-7 lg:p-8 bg-white">
              <p className="text-[14px] text-[#5b616e] leading-relaxed mb-6">{active.description}</p>
              <div>
                <div className="grid grid-cols-2 gap-4 pb-2 border-b border-[#dee1e6] mb-1">
                  <span className="text-[11px] font-semibold text-[#7c828a] uppercase tracking-wide">Field</span>
                  <span className="text-[11px] font-semibold text-[#7c828a] uppercase tracking-wide">Example</span>
                </div>
                {active.fields.map(({ label, example }) => (
                  <div key={label} className="grid grid-cols-2 gap-4 py-[9px] border-b border-[#eef0f3] last:border-0">
                    <span className="text-[14px] text-[#0a0b0d]">{label}</span>
                    <span className="font-mono text-[13px] text-[#0F766E]">{example}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works — light gray band ─────────────────────────────────── */}
      <section id="how" style={{ background: "#f7f7f7" }} className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="mb-14">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#0F766E] mb-3">The workflow</p>
            <h2
              className="text-[#0a0b0d]"
              style={{ fontSize: "clamp(36px, 3.5vw, 52px)", fontWeight: 400, letterSpacing: "-1.2px", lineHeight: 1.05 }}
            >
              From PDF to spreadsheet<br />
              in under a minute.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                n: "1",
                title: "Select document type",
                body: "Choose from GSTR-3B, TDS ITNS281, ESIC, PF ECR, or PTRC. Each parser knows exactly what to look for.",
              },
              {
                n: "2",
                title: "Upload PDFs",
                body: "Drag and drop up to 20 files from any session. Text-layer PDFs from official government portals are fully supported.",
              },
              {
                n: "3",
                title: "Export structured data",
                body: "Download formatted Excel or push directly to Google Sheets — column headers, values, ready for your master compliance register.",
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="bg-white rounded-2xl border border-[#dee1e6] p-8">
                <div
                  className="w-9 h-9 rounded-full border border-[#dee1e6] flex items-center justify-center mb-5"
                >
                  <span className="font-mono text-[13px] font-semibold text-[#7c828a]">{n}</span>
                </div>
                <h3 className="text-[17px] font-semibold text-[#0a0b0d] mb-2">{title}</h3>
                <p className="text-[14px] text-[#5b616e] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>

          {/* Before/after time comparison */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-[#dee1e6] p-8">
              <div className="inline-flex items-center gap-2 bg-[#eef0f3] rounded-full px-3 py-1 mb-6">
                <span className="text-[11px] font-semibold text-[#7c828a] uppercase tracking-wide">Before</span>
                <span className="font-mono text-[12px] text-[#7c828a]">~45 min / client</span>
              </div>
              <div className="space-y-2.5">
                {[
                  "Open the GSTN portal, download GSTR-3B PDF",
                  "Open Excel, create a new row for the client",
                  "Manually enter Output IGST, CGST, SGST",
                  "Switch to TRACES, download TDS challan",
                  "Copy TAN, amount, date, challan number",
                  "Repeat for ESIC, PF ECR, PTRC challans",
                  "Cross-check all figures against source PDF",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#eef0f3] flex items-center justify-center text-[11px] font-medium text-[#7c828a] flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-[13px] text-[#5b616e]">{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#0F766E]/30 p-8">
              <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 mb-6">
                <span className="text-[11px] font-semibold text-[#0F766E] uppercase tracking-wide">After</span>
                <span className="font-mono text-[12px] text-[#0F766E]">~45 sec / client</span>
              </div>
              <div className="space-y-4">
                {[
                  { t: "Upload PDFs", d: "Drag all challans at once — any combination of doc types" },
                  { t: "One click to process", d: "Purpose-built parsers extract every field automatically" },
                  { t: "Download or sync", d: "Excel download or Google Sheets push — formatted and ready" },
                ].map(({ t, d }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#0F766E] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-[#0a0b0d]">{t}</p>
                      <p className="text-[13px] text-[#5b616e] mt-0.5">{d}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-7 pt-6 border-t border-[#eef0f3]">
                <Link href="/signup">
                  <button className="flex items-center gap-2 bg-[#1E3A5F] hover:bg-[#162d4a] text-white text-[15px] font-semibold px-6 h-11 rounded-full transition-colors">
                    Try it free
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#0F766E] mb-3">Pricing</p>
            <h2
              className="text-[#0a0b0d] mb-3"
              style={{ fontSize: "clamp(36px, 3.5vw, 52px)", fontWeight: 400, letterSpacing: "-1.2px", lineHeight: 1.05 }}
            >
              Simple. No surprises.
            </h2>
            <p className="text-[16px] text-[#5b616e]">Start free. Upgrade when your client count grows.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "rounded-2xl border p-8 flex flex-col relative",
                  plan.dark
                    ? "border-transparent text-white"
                    : "border-[#dee1e6] bg-white"
                )}
                style={plan.dark ? { background: "#0a0b0d" } : undefined}
              >
                {plan.featured && (
                  <div className="absolute top-5 right-5">
                    <span
                      className="text-[11px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: "#0F766E", color: "white" }}
                    >
                      Recommended
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className={cn("text-[12px] font-semibold uppercase tracking-widest mb-3", plan.dark ? "text-[#a8acb3]" : "text-[#7c828a]")}>
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span
                      className={cn("font-medium", plan.dark ? "text-white" : "text-[#0a0b0d]")}
                      style={{ fontSize: 44, letterSpacing: "-1px", lineHeight: 1.0, fontWeight: 400 }}
                    >
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className={cn("text-[14px]", plan.dark ? "text-[#5b616e]" : "text-[#7c828a]")}>{plan.period}</span>
                    )}
                  </div>
                  <p className={cn("text-[14px] font-medium mt-2", plan.dark ? "text-[#F59E0B]" : "text-[#0F766E]")}>
                    {plan.subtitle}
                  </p>
                </div>

                <ul className="flex-1 space-y-2.5 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px]">
                      <CheckCircle className={cn("h-4 w-4 mt-0.5 flex-shrink-0", plan.dark ? "text-[#F59E0B]" : "text-[#0F766E]")} />
                      <span className={plan.dark ? "text-[#a8acb3]" : "text-[#5b616e]"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/signup">
                  <button
                    className={cn(
                      "w-full h-11 rounded-full text-[15px] font-semibold transition-colors",
                      plan.dark
                        ? "bg-[#F59E0B] hover:bg-[#D97706] text-[#0a0b0d]"
                        : plan.featured
                        ? "bg-[#1E3A5F] hover:bg-[#162d4a] text-white"
                        : "bg-[#eef0f3] hover:bg-[#dee1e6] text-[#0a0b0d]"
                    )}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-7 py-5 border-t border-[#dee1e6] flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <span className="text-[13px] font-semibold text-[#0a0b0d]">All plans:</span>
            {["All 5 document types", "Excel download", "DPDP compliant", "Zero data stored"].map((f) => (
              <span key={f} className="flex items-center gap-1.5 text-[13px] text-[#5b616e]">
                <Check className="h-3.5 w-3.5 text-[#0F766E]" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band — dark ────────────────────────────────────────────────── */}
      <section style={{ background: "#0a0b0d" }} className="py-24">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 text-center">
          <h2
            className="text-white mb-5"
            style={{ fontSize: "clamp(36px, 3.5vw, 52px)", fontWeight: 400, letterSpacing: "-1.2px", lineHeight: 1.05 }}
          >
            Stop copying challan figures<br />
            into Excel by hand.
          </h2>
          <p className="text-[#5b616e] text-[16px] mb-8 max-w-lg mx-auto">
            Join 500+ CA professionals who parse statutory PDFs in seconds, not hours.
          </p>
          <Link href="/signup">
            <button className="flex items-center gap-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#0a0b0d] text-[16px] font-semibold px-8 h-14 rounded-full mx-auto transition-colors">
              Get started free
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
          <p className="text-[12px] text-[#3a3f47] mt-4">2 PDFs free · No credit card required</p>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-[720px] mx-auto px-6 lg:px-8">
          <div className="mb-12">
            <p className="text-[12px] font-semibold tracking-widest uppercase text-[#0F766E] mb-3">FAQ</p>
            <h2
              className="text-[#0a0b0d]"
              style={{ fontSize: "clamp(32px, 3vw, 44px)", fontWeight: 400, letterSpacing: "-1px", lineHeight: 1.1 }}
            >
              Common questions
            </h2>
          </div>
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-[#dee1e6]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-[#1E3A5F] flex items-center justify-center">
                  <FileText className="h-3 w-3 text-white" />
                </div>
                <span className="font-semibold text-[14px] text-[#0a0b0d]">StatutorySync</span>
              </div>
              <p className="text-[13px] text-[#7c828a] leading-relaxed">
                Statutory dues compliance automation for Indian CA professionals.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#a8acb3] uppercase tracking-widest mb-3">Product</p>
              <div className="space-y-2">
                {[
                  { label: "Upload & Parse", href: "/upload" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Sign in", href: "/login" },
                  { label: "Get started", href: "/signup" },
                ].map(({ label, href }) => (
                  <div key={label}>
                    <Link href={href} className="text-[13px] text-[#5b616e] hover:text-[#0a0b0d] transition-colors">
                      {label}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#a8acb3] uppercase tracking-widest mb-3">Legal</p>
              <div className="space-y-2">
                <div><Link href="/privacy" className="text-[13px] text-[#5b616e] hover:text-[#0a0b0d] transition-colors">Privacy Policy</Link></div>
                <div><Link href="/terms" className="text-[13px] text-[#5b616e] hover:text-[#0a0b0d] transition-colors">Terms of Service</Link></div>
              </div>
              <p className="text-[12px] text-[#a8acb3] mt-5">Built for Indian CA professionals</p>
            </div>
          </div>
          <div className="border-t border-[#eef0f3] pt-5">
            <p className="text-[12px] text-[#a8acb3]">© 2026 StatutorySync. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
