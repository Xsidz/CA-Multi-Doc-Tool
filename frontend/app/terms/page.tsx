import Link from "next/link";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service — StatutorySync",
  description: "Terms and conditions for using StatutorySync.",
};

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-primary mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10">Last updated: June 25, 2026</p>

        <div className="space-y-8 text-foreground">

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By creating an account or using StatutorySync, you agree to these Terms of Service.
              If you do not agree, do not use the service. These terms form a binding agreement
              between you and StatutorySync.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              StatutorySync is a SaaS tool that extracts structured data from Indian statutory
              compliance PDFs (GSTR-3B, ESIC, PF ECR, PTRC, TDS ITNS281) and exports the output
              to Excel or Google Sheets. The service is intended for use by Chartered Accountants,
              tax professionals, and accounting firms operating in India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">3. Account Registration</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>You must provide accurate and complete information during signup.</li>
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must notify us immediately of any unauthorized access to your account.</li>
              <li>One account per person or entity. Do not share account credentials.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">4. Subscription Plans and Billing</h2>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Free plan:</strong> 2 PDF uploads per month at no cost.</li>
              <li><strong className="text-foreground">Paid plans:</strong> Starter (₹249/mo, 25 PDFs), Standard (₹449/mo, 50 PDFs), Pro (₹699/mo, 120 PDFs).</li>
              <li>Subscriptions renew monthly. PDF limits reset on the billing anniversary date.</li>
              <li>Payments are processed by Razorpay. We accept UPI, cards, and netbanking.</li>
              <li>All prices are in Indian Rupees (INR) and inclusive of applicable taxes.</li>
              <li>Refunds are not available for partially used billing periods. Contact support for exceptional circumstances.</li>
              <li>We reserve the right to change pricing with 30 days notice via email.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">5. Acceptable Use</h2>
            <p className="text-muted-foreground mb-3">You agree <strong className="text-foreground">not</strong> to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Upload documents you do not have lawful authority to process.</li>
              <li>Attempt to reverse-engineer, scrape, or extract the parsing logic.</li>
              <li>Circumvent plan limits through technical manipulation or multiple accounts.</li>
              <li>Use the service for any unlawful purpose under Indian or applicable law.</li>
              <li>Upload malicious files intended to disrupt the service.</li>
              <li>Resell or sublicense access to the service without written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">6. Data and Confidentiality</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain full ownership of the documents you upload and the data extracted from them.
              We do not store your PDF files — they are processed in memory and discarded immediately.
              You are responsible for ensuring your use of extracted data complies with applicable
              laws, including the Income Tax Act, GST laws, and DPDP Act. Do not upload documents
              containing third-party confidential information unless you have appropriate consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">7. Accuracy Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              StatutorySync uses automated PDF parsing. Extraction accuracy depends on the quality
              and format of source documents. <strong className="text-foreground">We do not guarantee that extracted data
              is 100% accurate.</strong> Always verify extracted figures against source documents before
              filing returns, making payments, or presenting data to clients. StatutorySync is a
              productivity tool, not a substitute for professional judgment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              StatutorySync, its parsing logic, user interface, and branding are the intellectual
              property of the service operator. You are granted a limited, non-exclusive,
              non-transferable license to use the service for its intended purpose. No rights
              are transferred to you beyond this license.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">9. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We aim for high availability but do not guarantee 100% uptime. Scheduled maintenance,
              infrastructure failures, or third-party outages may cause temporary interruptions.
              We are not liable for losses arising from service downtime.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by applicable law, StatutorySync shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your use
              of the service, including errors in extracted data, missed filing deadlines, or
              financial penalties. Our total liability to you in any month shall not exceed the
              subscription fee you paid in that month.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may cancel your subscription at any time. Access continues until the end of the
              current billing period. We reserve the right to suspend or terminate accounts that
              violate these terms, with or without notice. Upon termination, your account data will
              be deleted within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms are governed by the laws of India. Any disputes shall be subject to the
              exclusive jurisdiction of courts in Pune, Maharashtra, India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">13. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may revise these terms from time to time. Material changes will be communicated
              via email with at least 14 days notice. Continued use of the service after the
              effective date constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">14. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about these terms:
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
