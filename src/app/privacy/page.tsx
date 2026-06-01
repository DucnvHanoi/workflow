/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link'
import { type Metadata } from 'next'
import { GitBranch } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — Aitomic Flow',
  description:
    'Aitomic Flow Privacy Policy. Learn how we collect, use, and protect your personal data in compliance with GDPR and CCPA.',
}

const LAST_UPDATED = 'May 28, 2026'
const EFFECTIVE_DATE = 'May 28, 2026'

const SECTIONS = [
  { id: 'controller', label: 'Who We Are' },
  { id: 'data-collected', label: 'Data We Collect' },
  { id: 'how-we-use', label: 'How We Use Your Data' },
  { id: 'legal-basis', label: 'Legal Bases (GDPR)' },
  { id: 'sharing', label: 'Sharing Your Data' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'your-rights', label: 'Your Rights' },
  { id: 'gdpr-rights', label: '— EU / GDPR Rights' },
  { id: 'ccpa-rights', label: '— California / CCPA Rights' },
  { id: 'cookies', label: 'Cookies & Tracking' },
  { id: 'transfers', label: 'International Transfers' },
  { id: 'security', label: 'Security' },
  { id: 'children', label: "Children's Privacy" },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact / DPO' },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <GitBranch className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">Aitomic Flow</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/terms" className="text-slate-500 hover:text-slate-900 transition-colors">
              Terms of Service
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
                  className={`block text-sm py-1 transition-colors ${s.label.startsWith('—') ? 'pl-3 text-slate-400 hover:text-indigo-500' : 'text-slate-500 hover:text-indigo-600'}`}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </aside>

          {/* Content */}
          <main className="min-w-0">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-slate-900">Privacy Policy</h1>
              <p className="text-sm text-slate-500 mt-2">
                Effective: {EFFECTIVE_DATE} · Last updated: {LAST_UPDATED}
              </p>
            </div>

            <div className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-base prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-600 prose-li:text-slate-600 prose-strong:text-slate-800 prose-a:text-indigo-600">
              <p>
                At Aitomic Flow ("we," "us," or "our"), we take your privacy seriously. This Privacy
                Policy explains how we collect, use, share, and protect personal data when you use
                Aitomic Flow (the "Service"). It applies to all users, whether you are a registered
                customer, a team member added by an administrator, or simply visiting our website.
              </p>
              <p>
                This policy is designed to comply with the{' '}
                <strong>General Data Protection Regulation (GDPR)</strong> (EU 2016/679), the{' '}
                <strong>UK GDPR</strong>, and the{' '}
                <strong>California Consumer Privacy Act (CCPA)</strong> as amended by the CPRA.
              </p>

              <h2 id="controller">1. Who We Are (Data Controller)</h2>
              <p>
                Aitomic Flow is the data controller for personal data processed through the Aitomic
                Flow platform. If you are using Aitomic Flow as an employee or user of an
                organisation (a "Tenant"), that organisation is a separate data controller for the
                workflows and data they manage, and Aitomic Flow acts as a data processor on their
                behalf.
              </p>
              <p>
                <strong>Contact:</strong>{' '}
                <a href="mailto:privacy@aitomicflow.com">privacy@aitomicflow.com</a>
              </p>

              <h2 id="data-collected">2. Personal Data We Collect</h2>

              <h3>Data you provide directly</h3>
              <ul>
                <li>
                  <strong>Account information:</strong> Name, email address, password (hashed), job
                  title, phone number, profile photo.
                </li>
                <li>
                  <strong>Organisation data:</strong> Organisation name, billing address, VAT/tax ID
                  (for paid plans).
                </li>
                <li>
                  <strong>Payment information:</strong> Processed by our payment provider (Stripe).
                  We do not store full card numbers.
                </li>
                <li>
                  <strong>Communications:</strong> Messages sent to our support team, feedback, and
                  survey responses.
                </li>
                <li>
                  <strong>Workflow content:</strong> Data entered into workflow forms, task
                  descriptions, file attachments, and comments.
                </li>
              </ul>

              <h3>Data collected automatically</h3>
              <ul>
                <li>
                  <strong>Usage data:</strong> Pages visited, features used, actions taken,
                  timestamps, and session duration.
                </li>
                <li>
                  <strong>Device and log data:</strong> IP address, browser type, operating system,
                  and referring URL.
                </li>
                <li>
                  <strong>Cookies and similar technologies:</strong> See Section 10 for details.
                </li>
              </ul>

              <h3>Data received from third parties</h3>
              <ul>
                <li>
                  <strong>Authentication providers:</strong> If you sign in with Google, we receive
                  your name and email address.
                </li>
                <li>
                  <strong>Email providers:</strong> If you contact us by email, your email address
                  and message content are received via our inbound mail provider (Postmark).
                </li>
              </ul>

              <h2 id="how-we-use">3. How We Use Your Personal Data</h2>
              <p>We use your personal data to:</p>
              <ul>
                <li>Create and manage your account and authenticate your identity.</li>
                <li>Provide, operate, and improve the Service.</li>
                <li>Process payments and manage subscriptions.</li>
                <li>
                  Send transactional emails (e.g., task assignments, workflow completions,
                  invitations).
                </li>
                <li>Respond to support requests, including AI-assisted responses.</li>
                <li>Send product updates, security alerts, and administrative notices.</li>
                <li>Detect and prevent fraud, abuse, and security incidents.</li>
                <li>Comply with legal obligations.</li>
                <li>
                  Analyse usage patterns to improve the Service (using aggregated or anonymised data
                  where possible).
                </li>
              </ul>
              <p>
                We do <strong>not</strong> sell your personal data to third parties.
              </p>

              <h2 id="legal-basis">4. Legal Bases for Processing (GDPR)</h2>
              <p>
                If you are in the European Economic Area (EEA) or UK, we process your personal data
                under the following legal bases:
              </p>
              <ul>
                <li>
                  <strong>Contract (Art. 6(1)(b)):</strong> To provide the Service you have
                  subscribed to and fulfil our contractual obligations.
                </li>
                <li>
                  <strong>Legitimate interests (Art. 6(1)(f)):</strong> To improve the Service,
                  prevent fraud, ensure security, and send relevant product communications. We
                  balance our interests against your rights.
                </li>
                <li>
                  <strong>Legal obligation (Art. 6(1)(c)):</strong> To comply with applicable laws
                  (e.g., tax, anti-money laundering).
                </li>
                <li>
                  <strong>Consent (Art. 6(1)(a)):</strong> For optional marketing communications and
                  non-essential cookies. You may withdraw consent at any time.
                </li>
              </ul>

              <h2 id="sharing">5. Sharing Your Personal Data</h2>
              <p>We share your data only with:</p>
              <ul>
                <li>
                  <strong>Service providers (processors):</strong> Cloud infrastructure
                  (Supabase/AWS), email delivery (Resend, Postmark), payment processing (Stripe),
                  error monitoring (Sentry). All processors are bound by data processing agreements.
                </li>
                <li>
                  <strong>Within your organisation:</strong> Workflow data is visible to
                  administrators and other users in your Tenant as required for the Service to
                  function.
                </li>
                <li>
                  <strong>AI providers:</strong> Customer support emails may be processed by
                  Anthropic's Claude API to generate responses. Only the email subject, body, and
                  relevant account context are shared. No data is used to train third-party AI
                  models under our agreements.
                </li>
                <li>
                  <strong>Legal requirements:</strong> When required by law, court order, or to
                  protect our rights or the safety of others.
                </li>
                <li>
                  <strong>Business transfers:</strong> In connection with a merger, acquisition, or
                  sale of assets, with prior notice to you.
                </li>
              </ul>

              <h2 id="retention">6. Data Retention</h2>
              <p>
                We retain personal data for as long as your account is active or as needed to
                provide the Service. Specifically:
              </p>
              <ul>
                <li>
                  <strong>Account data:</strong> Retained for the duration of your subscription plus
                  30 days after account closure.
                </li>
                <li>
                  <strong>Workflow and task data:</strong> Retained for the duration of your
                  subscription. Exported on request before closure.
                </li>
                <li>
                  <strong>Support communications:</strong> Retained for 2 years to allow follow-up
                  and quality improvement.
                </li>
                <li>
                  <strong>Billing records:</strong> Retained for 7 years to comply with financial
                  regulations.
                </li>
                <li>
                  <strong>Usage logs:</strong> Retained for 90 days in identifiable form; longer in
                  aggregated/anonymised form.
                </li>
              </ul>
              <p>After the applicable retention period, data is securely deleted or anonymised.</p>

              <h2 id="your-rights">7. Your Rights</h2>

              <h3 id="gdpr-rights">EU / UK Residents — GDPR Rights</h3>
              <p>If you are in the EEA or UK, you have the following rights under the GDPR:</p>
              <ul>
                <li>
                  <strong>Right of access (Art. 15):</strong> Request a copy of the personal data we
                  hold about you.
                </li>
                <li>
                  <strong>Right to rectification (Art. 16):</strong> Request correction of
                  inaccurate or incomplete data.
                </li>
                <li>
                  <strong>Right to erasure (Art. 17):</strong> Request deletion of your personal
                  data ("right to be forgotten") where there is no overriding legitimate reason to
                  retain it.
                </li>
                <li>
                  <strong>Right to restriction (Art. 18):</strong> Request that we limit processing
                  of your data in certain circumstances.
                </li>
                <li>
                  <strong>Right to data portability (Art. 20):</strong> Receive your data in a
                  structured, machine-readable format and transfer it to another controller.
                </li>
                <li>
                  <strong>Right to object (Art. 21):</strong> Object to processing based on
                  legitimate interests, including profiling, or to direct marketing at any time.
                </li>
                <li>
                  <strong>Rights related to automated decisions (Art. 22):</strong> Not to be
                  subject to solely automated decisions that produce significant legal effects.
                </li>
              </ul>
              <p>
                To exercise these rights, email{' '}
                <a href="mailto:privacy@aitomicflow.com">privacy@aitomicflow.com</a>. We will
                respond within 30 days. If you believe we have not adequately addressed your
                request, you have the right to lodge a complaint with your local data protection
                authority (e.g., the CNIL in France, the ICO in the UK, or the relevant supervisory
                authority in your EU member state).
              </p>

              <h3 id="ccpa-rights">California Residents — CCPA / CPRA Rights</h3>
              <p>If you are a California resident, you have the following rights:</p>
              <ul>
                <li>
                  <strong>Right to Know:</strong> Request disclosure of the categories and specific
                  pieces of personal information we have collected about you, and the purposes for
                  which it is used.
                </li>
                <li>
                  <strong>Right to Delete:</strong> Request deletion of personal information we have
                  collected, subject to certain exceptions.
                </li>
                <li>
                  <strong>Right to Correct:</strong> Request correction of inaccurate personal
                  information.
                </li>
                <li>
                  <strong>Right to Opt-Out of Sale or Sharing:</strong> We do not sell or share
                  personal information for cross-context behavioural advertising.
                </li>
                <li>
                  <strong>Right to Limit Use of Sensitive Personal Information:</strong> We use
                  sensitive personal information (e.g., account login credentials) only as necessary
                  to provide the Service.
                </li>
                <li>
                  <strong>Right to Non-Discrimination:</strong> We will not discriminate against you
                  for exercising your CCPA rights.
                </li>
              </ul>
              <p>
                To submit a CCPA request, email{' '}
                <a href="mailto:privacy@aitomicflow.com">privacy@aitomicflow.com</a> with the
                subject "California Privacy Request". We will verify your identity before processing
                the request and respond within 45 days (extendable by an additional 45 days with
                notice).
              </p>

              <h2 id="cookies">8. Cookies and Tracking Technologies</h2>
              <p>We use the following types of cookies:</p>
              <ul>
                <li>
                  <strong>Strictly necessary:</strong> Session cookies required for authentication
                  and security. These cannot be disabled.
                </li>
                <li>
                  <strong>Functional:</strong> Remember your preferences (e.g., collapsed sidebar,
                  dark mode).
                </li>
                <li>
                  <strong>Analytics:</strong> Aggregate usage statistics to improve the Service. We
                  use privacy-friendly analytics and do not track individuals across external sites.
                </li>
              </ul>
              <p>
                Non-essential cookies are only set with your consent. You can manage cookie
                preferences via your browser settings or by contacting us. Disabling strictly
                necessary cookies will prevent you from using the Service.
              </p>

              <h2 id="transfers">9. International Data Transfers</h2>
              <p>
                Aitomic Flow is hosted on infrastructure in the{' '}
                <strong>Asia-Pacific region (Singapore)</strong>. Some of our service providers are
                located in the United States and other countries. When we transfer personal data
                from the EEA or UK to countries without an EU adequacy decision, we rely on:
              </p>
              <ul>
                <li>Standard Contractual Clauses (SCCs) approved by the European Commission.</li>
                <li>UK International Data Transfer Agreements (IDTAs) where applicable.</li>
              </ul>
              <p>You may request a copy of the applicable transfer mechanisms by contacting us.</p>

              <h2 id="security">10. Security</h2>
              <p>
                We implement technical and organisational measures to protect your personal data,
                including:
              </p>
              <ul>
                <li>Encryption in transit (TLS 1.2+) and at rest.</li>
                <li>Row-level security on the database layer.</li>
                <li>Multi-factor authentication (MFA) support.</li>
                <li>Access controls limiting data access to authorised personnel.</li>
                <li>Regular security assessments.</li>
              </ul>
              <p>
                No system is completely secure. In the event of a data breach that is likely to
                result in a risk to your rights, we will notify the relevant supervisory authority
                within 72 hours and affected users without undue delay, as required by the GDPR.
              </p>

              <h2 id="children">11. Children's Privacy</h2>
              <p>
                The Service is not directed at children under the age of 16. We do not knowingly
                collect personal data from children under 16. If we become aware that we have
                collected such data without verified parental consent, we will delete it promptly.
                If you believe a child has provided us with personal data, please contact us at{' '}
                <a href="mailto:privacy@aitomicflow.com">privacy@aitomicflow.com</a>.
              </p>

              <h2 id="changes">12. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. When we make material changes,
                we will notify you by email and/or by posting a prominent notice in the Service at
                least 14 days before the changes take effect. We encourage you to review this policy
                periodically. The "Last updated" date at the top of this page indicates when the
                policy was last revised.
              </p>

              <h2 id="contact">13. Contact and Data Protection Officer</h2>
              <p>
                For any questions, requests, or concerns about this Privacy Policy or our data
                practices, please contact:
              </p>
              <p>
                <strong>Aitomic Flow — Privacy Team</strong>
                <br />
                Email: <a href="mailto:privacy@aitomicflow.com">privacy@aitomicflow.com</a>
                <br />
                Support: <a href="mailto:support@aitomicflow.com">support@aitomicflow.com</a>
              </p>
              <p>
                If you are in the EEA and we are required to appoint a Data Protection Officer (DPO)
                or EU representative under the GDPR, contact details will be provided here. For
                complaints unresolved by us, you may contact your national data protection
                authority. A list of EU supervisory authorities is available at{' '}
                <a
                  href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  edpb.europa.eu
                </a>
                .
              </p>
            </div>

            {/* Footer nav */}
            <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
              <span>
                © {new Date().getFullYear()} Aitomic Flow / Aitomic Flow. All rights reserved.
              </span>
              <div className="flex items-center gap-6">
                <Link href="/terms" className="hover:text-slate-700 transition-colors">
                  Terms of Service
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
