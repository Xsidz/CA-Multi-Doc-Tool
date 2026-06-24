import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — StatutorySync",
  description: "How StatutorySync collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-lg text-primary">StatutorySync</span>
        </Link>
        <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          ← Back to Home
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: June 25, 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">1. Who We Are</h2>
            <p className="text-muted-foreground leading-relaxed">
              StatutorySync is a statutory dues compliance automation tool built for Indian CA
              professionals. We help you extract structured data from statutory PDF documents
              (GSTR-3B, ESIC, PF ECR, PTRC, TDS ITNS281) and export it to Excel or Google Sheets.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">2. Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Account data:</strong> Your name, email address, and company name when you sign up.</li>
              <li><strong className="text-foreground">Usage data:</strong> Document type processed, timestamp, and count of PDFs parsed per billing period. We never store file content.</li>
              <li><strong className="text-foreground">Payment data:</strong> Razorpay order ID and payment ID for subscription records. Card or UPI details are never stored by us — they are handled entirely by Razorpay.</li>
              <li><strong className="text-foreground">Technical data:</strong> IP address, browser type, and session metadata for security and debugging purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">3. Your PDFs — Zero Storage Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">We do not store your PDF files.</strong> When you upload a PDF, it is processed
              entirely in server memory and immediately discarded after extraction. No file bytes
              are written to disk or saved to any database. Only a SHA-256 hash of the filename
              (not content) is logged for usage tracking. This is our core privacy guarantee.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">4. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>To provide and operate the StatutorySync service.</li>
              <li>To enforce plan limits and manage your subscription.</li>
              <li>To send transactional emails (payment confirmations, account alerts).</li>
              <li>To improve reliability and fix bugs using anonymized usage patterns.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              We do <strong className="text-foreground">not</strong> sell your data to third parties. We do not use your data for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">5. Third-Party Services</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Supabase:</strong> Authentication and database hosting. Data stored in Supabase servers.</li>
              <li><strong className="text-foreground">Razorpay:</strong> Payment processing. Subject to Razorpay&apos;s own privacy policy.</li>
              <li><strong className="text-foreground">Composio:</strong> Google Sheets OAuth integration. Subject to Composio&apos;s privacy policy.</li>
              <li><strong className="text-foreground">Railway / Vercel:</strong> Server infrastructure. Data processed within their cloud environments.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              Account data is retained as long as your account is active. Usage logs are retained
              for 12 months for billing and audit purposes, then permanently deleted. You can request
              deletion of your account and all associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">7. DPDP Compliance (India)</h2>
            <p className="text-muted-foreground leading-relaxed">
              We process personal data in compliance with India&apos;s Digital Personal Data Protection
              Act, 2023. As a Data Fiduciary, we collect only the minimum data necessary, process it
              only for stated purposes, and maintain reasonable security safeguards. You have the
              right to access, correct, and erase your personal data. To exercise these rights,
              contact us at the email below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">8. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              All data is transmitted over HTTPS. Authentication tokens use asymmetric cryptography
              (ES256) via Supabase. Payment verification uses HMAC-SHA256 signature validation.
              We do not log PII in application logs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">9. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use session cookies strictly for authentication (set by Supabase). We do not use
              advertising, tracking, or analytics cookies. No third-party cookie banners are required.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this policy periodically. Material changes will be communicated via
              email. Continued use of the service after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">11. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy-related queries, data deletion requests, or DPDP grievances:
            </p>
            <p className="mt-2 font-medium text-foreground">
              StatutorySync Support<br />
              Email: support@statutorysync.in
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 StatutorySync. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-2">
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
