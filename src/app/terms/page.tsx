/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link'
import { type Metadata } from 'next'
import { GitBranch } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service — DragFlow',
  description:
    'DragFlow Terms of Service. Read the terms governing your use of the DragFlow platform.',
}

const LAST_UPDATED = 'May 28, 2026'
const EFFECTIVE_DATE = 'May 28, 2026'

const SECTIONS = [
  { id: 'acceptance', label: 'Acceptance of Terms' },
  { id: 'service', label: 'Description of Service' },
  { id: 'accounts', label: 'Account Registration' },
  { id: 'billing', label: 'Subscription & Billing' },
  { id: 'acceptable-use', label: 'Acceptable Use' },
  { id: 'ip', label: 'Intellectual Property' },
  { id: 'privacy', label: 'Privacy & Data' },
  { id: 'disclaimers', label: 'Disclaimers' },
  { id: 'liability', label: 'Limitation of Liability' },
  { id: 'indemnification', label: 'Indemnification' },
  { id: 'termination', label: 'Termination' },
  { id: 'governing-law', label: 'Governing Law' },
  { id: 'changes', label: 'Changes to Terms' },
  { id: 'contact', label: 'Contact' },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GitBranch className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">DragFlow</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-slate-500 hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/help" className="text-slate-500 hover:text-slate-900 transition-colors">
              Help Center
            </Link>
            <Link
              href="/login"
              className="text-indigo-600 font-medium hover:text-indigo-700 transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
          {/* Sidebar ToC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Contents
              </p>
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block text-sm text-slate-500 hover:text-indigo-600 py-1 transition-colors"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1>
              <p className="text-sm text-slate-500 mt-2">
                Effective: {EFFECTIVE_DATE} · Last updated: {LAST_UPDATED}
              </p>
            </div>

            <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-800 prose-a:text-indigo-600">
              <p>
                These Terms of Service ("Terms") govern your access to and use of DragFlow, a
                workflow automation platform ("Service") operated by BizFlow ("we," "us," or "our").
                By creating an account or using the Service, you agree to be bound by these Terms.
                If you do not agree, do not use the Service.
              </p>

              <h2 id="acceptance">1. Acceptance of Terms</h2>
              <p>
                By accessing or using DragFlow, you confirm that you are at least 18 years old, have
                the legal capacity to enter into a binding agreement, and agree to these Terms. If
                you are using the Service on behalf of an organisation, you represent that you have
                authority to bind that organisation to these Terms.
              </p>

              <h2 id="service">2. Description of Service</h2>
              <p>
                DragFlow provides a cloud-based workflow automation platform that enables
                organisations to design, deploy, and track multi-step approval workflows with
                AI-assisted features. The Service includes a drag-and-drop flow builder, task
                assignment, SLA tracking, reporting, and customer support tooling.
              </p>
              <p>
                We reserve the right to modify, suspend, or discontinue any part of the Service at
                any time with reasonable notice. We are not liable to you or any third party for any
                such modification, suspension, or discontinuation.
              </p>

              <h2 id="accounts">3. Account Registration</h2>
              <p>To use the Service, you must register for an account. You agree to:</p>
              <ul>
                <li>Provide accurate, current, and complete information during registration.</li>
                <li>
                  Maintain the security of your password and promptly notify us of any unauthorised
                  access.
                </li>
                <li>Be responsible for all activity that occurs under your account.</li>
                <li>Not share your account credentials with any third party.</li>
              </ul>
              <p>
                Each organisation ("Tenant") may have one or more administrator accounts and
                multiple user accounts. Administrators are responsible for managing their
                organisation's users and data within the Service.
              </p>

              <h2 id="billing">4. Subscription Plans and Billing</h2>
              <p>
                DragFlow offers a Free plan and paid plans (Pro, Enterprise). Paid subscriptions are
                billed on a monthly or annual basis as selected at checkout.
              </p>
              <ul>
                <li>
                  <strong>Charges.</strong> By subscribing to a paid plan, you authorise us to
                  charge your payment method on a recurring basis.
                </li>
                <li>
                  <strong>Upgrades / Downgrades.</strong> Plan changes take effect at the start of
                  the next billing cycle.
                </li>
                <li>
                  <strong>Cancellation.</strong> You may cancel your subscription at any time.
                  Access continues until the end of the current billing period; no partial refunds
                  are issued.
                </li>
                <li>
                  <strong>Taxes.</strong> Prices are exclusive of applicable taxes. You are
                  responsible for any taxes, levies, or duties imposed by your jurisdiction.
                </li>
                <li>
                  <strong>Free Trial.</strong> If we offer a free trial, we will notify you before
                  your trial converts to a paid subscription.
                </li>
              </ul>

              <h2 id="acceptable-use">5. Acceptable Use</h2>
              <p>You agree not to use the Service to:</p>
              <ul>
                <li>Violate any applicable law, regulation, or third-party rights.</li>
                <li>Transmit malware, spam, or any harmful or disruptive code.</li>
                <li>Attempt to gain unauthorised access to any system or data.</li>
                <li>
                  Scrape, crawl, or extract data from the Service by automated means without our
                  express written consent.
                </li>
                <li>Impersonate any person or entity or misrepresent your affiliation.</li>
                <li>
                  Use the Service to process data that is unlawful, defamatory, obscene, or that
                  infringes third-party intellectual property rights.
                </li>
              </ul>
              <p>
                We reserve the right to suspend or terminate accounts that violate these
                restrictions.
              </p>

              <h2 id="ip">6. Intellectual Property</h2>
              <p>
                <strong>Our IP.</strong> The Service, including its design, code, trademarks, and
                content created by us, is owned by BizFlow and protected by applicable intellectual
                property laws. These Terms do not grant you any ownership rights in the Service.
              </p>
              <p>
                <strong>Your Content.</strong> You retain ownership of all data, workflows, files,
                and content you upload or create within the Service ("Customer Data"). By using the
                Service, you grant us a limited, non-exclusive licence to host, store, and process
                Customer Data solely to provide the Service to you.
              </p>
              <p>
                <strong>Feedback.</strong> If you submit suggestions or feedback, we may use them
                without restriction or compensation to you.
              </p>

              <h2 id="privacy">7. Privacy and Data</h2>
              <p>
                Your use of the Service is also governed by our{' '}
                <Link href="/privacy">Privacy Policy</Link>, which is incorporated into these Terms
                by reference. By using the Service, you consent to the collection and use of your
                information as described in the Privacy Policy.
              </p>
              <p>
                You are responsible for obtaining any necessary consents from individuals whose data
                you process through the Service, and for complying with applicable data protection
                laws in your jurisdiction.
              </p>

              <h2 id="disclaimers">8. Disclaimers</h2>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
                WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
              </p>

              <h2 id="liability">9. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT WILL BIZFLOW BE
                LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
                ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR
                USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
              <p>
                OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ANY CLAIMS ARISING OUT OF THESE TERMS OR
                YOUR USE OF THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID TO
                US IN THE TWELVE MONTHS PRIOR TO THE CLAIM OR (B) USD 100.
              </p>
              <p>
                Some jurisdictions do not allow the exclusion or limitation of certain warranties or
                liability. In such jurisdictions, our liability is limited to the greatest extent
                permitted by law.
              </p>

              <h2 id="indemnification">10. Indemnification</h2>
              <p>
                You agree to defend, indemnify, and hold harmless BizFlow and its officers,
                directors, employees, and agents from any claims, damages, losses, and expenses
                (including reasonable legal fees) arising out of or related to: (a) your use of the
                Service; (b) your Customer Data; (c) your violation of these Terms; or (d) your
                infringement of any third-party rights.
              </p>

              <h2 id="termination">11. Termination</h2>
              <p>
                Either party may terminate the agreement at any time. We may suspend or terminate
                your access immediately if we reasonably believe you have violated these Terms. Upon
                termination:
              </p>
              <ul>
                <li>Your right to access the Service ceases immediately.</li>
                <li>
                  We will retain your Customer Data for 30 days, after which it may be permanently
                  deleted.
                </li>
                <li>You may request a data export before termination by contacting support.</li>
              </ul>
              <p>Sections 6, 8, 9, 10, and 12 survive termination.</p>

              <h2 id="governing-law">12. Governing Law and Disputes</h2>
              <p>
                These Terms are governed by the laws of the jurisdiction in which BizFlow is
                incorporated, without regard to conflict-of-law principles. Any disputes shall first
                be attempted to be resolved through good-faith negotiation. If unresolved within 30
                days, disputes shall be submitted to binding arbitration under internationally
                recognised arbitration rules. This does not prevent either party from seeking
                injunctive relief in a court of competent jurisdiction.
              </p>
              <p>
                If you are a consumer resident in the European Union, you may also have the right to
                seek resolution through an EU alternative dispute resolution body or the European
                Online Dispute Resolution platform at{' '}
                <a
                  href="https://ec.europa.eu/consumers/odr"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ec.europa.eu/consumers/odr
                </a>
                .
              </p>

              <h2 id="changes">13. Changes to Terms</h2>
              <p>
                We may update these Terms from time to time. When we make material changes, we will
                notify you by email or by displaying a prominent notice in the Service at least 14
                days before the changes take effect. Your continued use of the Service after the
                effective date constitutes acceptance of the updated Terms.
              </p>

              <h2 id="contact">14. Contact</h2>
              <p>Questions about these Terms should be sent to:</p>
              <p>
                <strong>BizFlow</strong>
                <br />
                Email: <a href="mailto:legal@bizflow.id.vn">legal@bizflow.id.vn</a>
                <br />
                Support: <a href="mailto:support@bizflow.id.vn">support@bizflow.id.vn</a>
              </p>
            </div>

            {/* Footer nav */}
            <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
              <span>© {new Date().getFullYear()} DragFlow / BizFlow. All rights reserved.</span>
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="hover:text-slate-700 transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/help" className="hover:text-slate-700 transition-colors">
                  Help Center
                </Link>
                <Link href="/" className="hover:text-slate-700 transition-colors">
                  Home
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
