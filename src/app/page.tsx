import { type Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getLimits, type PlanLimits } from '@/lib/billing/limits'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  GitBranch,
  Bot,
  ShieldCheck,
  BarChart2,
  Users,
  ScrollText,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  Menu,
  X,
  Mail,
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'DragFlow — Build smarter approval workflows with AI',
  description:
    'Design multi-step workflows visually, automate routing, track SLAs, and let AI help you build faster. No code required. Free plan available.',
  openGraph: {
    title: 'DragFlow — Build smarter approval workflows with AI',
    description:
      'Design multi-step workflows visually, automate routing, track SLAs, and let AI help you build faster.',
    type: 'website',
    siteName: 'DragFlow',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DragFlow — Build smarter approval workflows with AI',
    description:
      'Design multi-step workflows visually, automate routing, track SLAs, and let AI help you build faster.',
  },
}

// ── Navbar ────────────────────────────────────────────────────────────────────

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <GitBranch className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">DragFlow</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-500">
            <a href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">
              FAQ
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Get started free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button className="md:hidden p-2 text-slate-500 hover:text-slate-900">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white pt-20 pb-28">
      {/* Soft background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-b from-indigo-50 to-white opacity-70 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700">
            <Zap className="h-3.5 w-3.5" />
            Your AI workflow magic
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-center text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6 max-w-4xl mx-auto">
          Build smarter{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
            approval workflows
          </span>{' '}
          with AI
        </h1>

        {/* Sub */}
        <p className="text-center text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
          Design multi-step workflows visually, automate routing, track SLAs, and let AI help you
          build faster — no code required.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-indigo-200/60 text-base"
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium px-6 py-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-base"
          >
            Log in to workspace
          </Link>
        </div>
        <p className="text-center text-sm text-slate-400">
          Free plan available · No credit card required
        </p>

        {/* Product mockup */}
        <div className="relative mt-16 max-w-4xl mx-auto">
          {/* Main card */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 overflow-hidden">
            {/* Browser chrome */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 max-w-xs mx-auto bg-white border border-slate-200 rounded-md px-3 py-1 text-xs text-slate-400 text-center">
                app.dragflow.io/dashboard
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-6 bg-slate-50/40">
              {/* Stat row */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                {[
                  { label: 'Active Flows', value: '12', color: 'text-indigo-600' },
                  { label: 'Completed Today', value: '38', color: 'text-emerald-600' },
                  { label: 'SLA On-time', value: '94%', color: 'text-green-600' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-white rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                    <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Flow step row */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Employee Onboarding · In Progress
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'HR Review', state: 'done' },
                    { label: 'IT Setup', state: 'done' },
                    { label: 'Manager Sign-off', state: 'active' },
                    { label: 'Access Granted', state: 'pending' },
                  ].map((step, i, arr) => (
                    <div key={step.label} className="flex items-center gap-2">
                      <div
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          step.state === 'done'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : step.state === 'active'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}
                      >
                        {step.state === 'done' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        {step.state === 'active' && <Clock className="h-3.5 w-3.5" />}
                        {step.label}
                      </div>
                      {i < arr.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating: SLA alert */}
          <div className="absolute -right-6 top-16 hidden lg:block bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-52 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <span className="text-xs font-semibold text-slate-800">SLA Alert</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Manager Sign-off is due in <span className="text-amber-600 font-medium">2 hours</span>
              . Escalating soon.
            </p>
          </div>

          {/* Floating: AI suggestion */}
          <div className="absolute -left-6 bottom-14 hidden lg:block bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-56 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Bot className="h-4 w-4 text-violet-500" />
              </div>
              <span className="text-xs font-semibold text-slate-800">AI Suggestion</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Add a compliance check step before IT Setup for better security coverage.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Visual Flow Builder',
    description:
      'Design multi-step workflows with a drag-and-drop canvas. Add branches, conditions, and parallel steps — no coding needed.',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-600',
  },
  {
    icon: Bot,
    title: 'AI-Powered Assistance',
    description:
      'Let AI suggest form fields, generate branch conditions from plain English, and draft step descriptions as you build.',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-600',
  },
  {
    icon: ShieldCheck,
    title: 'SLA Tracking & Escalation',
    description:
      'Set deadlines on every step. Receive escalation alerts before SLAs breach and analyze breach rates across all your flows.',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
  },
  {
    icon: BarChart2,
    title: 'Analytics & Reports',
    description:
      'Flow performance, cycle times, bottleneck analysis, and period-over-period comparisons — all built in, zero setup.',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
  },
  {
    icon: Users,
    title: 'Team & Department Management',
    description:
      'Organize users into departments, assign heads, and route tasks automatically based on your org structure.',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
  },
  {
    icon: ScrollText,
    title: 'Full Audit Trail',
    description:
      'Every action logged with actor, timestamp, and context. Exportable records for compliance and accountability.',
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
  },
]

function FeaturesSection() {
  return (
    <section id="features" className="bg-slate-50 py-24 border-t border-slate-100">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-4">
            Features
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-5 tracking-tight">
            Everything your team needs
            <br className="hidden sm:block" /> to move faster
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            From workflow design to real-time tracking — DragFlow covers the full lifecycle of every
            approval process in your organization.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-slate-300 hover:-translate-y-1 transition-all duration-200"
            >
              <div
                className={`h-11 w-11 rounded-xl ${f.iconBg} flex items-center justify-center mb-5`}
              >
                <f.icon className={`h-5 w-5 ${f.iconColor}`} />
              </div>
              <h3 className="font-semibold text-slate-900 text-base mb-2">{f.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Pricing ───────────────────────────────────────────────────────────────────

type PlanFeature = { label: string; included: boolean }

type Plan = {
  name: string
  price: string
  priceNote: string
  description: string
  cta: string
  ctaHref: string
  highlighted: boolean
  badge?: string
  features: PlanFeature[]
}

const PLAN_META: Record<
  string,
  {
    name: string
    priceNote: string
    description: string
    cta: string
    ctaHref: string
    highlighted: boolean
    badge?: string
  }
> = {
  free: {
    name: 'Free',
    priceNote: 'forever',
    description: 'Perfect for small teams getting started with workflow automation.',
    cta: 'Get started free',
    ctaHref: '/signup',
    highlighted: false,
  },
  pro: {
    name: 'Pro',
    priceNote: 'per user / month',
    description: 'For growing teams that need unlimited flows, AI, and deep analytics.',
    cta: 'Start Pro',
    ctaHref: '/signup',
    highlighted: true,
    badge: 'Most popular',
  },
  enterprise: {
    name: 'Enterprise',
    priceNote: 'contact us',
    description: 'Unlimited scale, custom AI limits, and a dedicated support agreement.',
    cta: 'Contact us',
    ctaHref: 'mailto:hello@dragflow.io',
    highlighted: false,
  },
}

function buildFeatures(slug: string, limits: PlanLimits): PlanFeature[] {
  const qty: PlanFeature[] = [
    {
      label: limits.maxUsers ? `Up to ${limits.maxUsers} users` : 'Unlimited users',
      included: true,
    },
    {
      label: limits.maxFlows ? `${limits.maxFlows} active flows` : 'Unlimited flows',
      included: true,
    },
    {
      label: limits.maxDepartments
        ? `${limits.maxDepartments} departments`
        : 'Unlimited departments',
      included: true,
    },
    {
      label: limits.reportWindowDays
        ? `${limits.reportWindowDays}-day report history`
        : 'Full report history',
      included: true,
    },
  ]
  const tail: Record<string, PlanFeature[]> = {
    free: [
      { label: 'SLA tracking', included: true },
      { label: 'Audit trail', included: true },
      { label: 'AI-powered flow builder', included: limits.aiEnabled },
      { label: 'Full analytics (30d / 90d / all-time)', included: false },
      { label: 'Priority support', included: false },
    ],
    pro: [
      { label: 'SLA tracking & escalation', included: true },
      { label: 'Audit trail', included: true },
      { label: 'AI-powered flow builder', included: limits.aiEnabled },
      { label: 'Full analytics & bottleneck reports', included: true },
      { label: 'Priority support', included: true },
    ],
    enterprise: [
      { label: 'SLA tracking & escalation', included: true },
      { label: 'Audit trail', included: true },
      { label: 'AI-powered flow builder', included: limits.aiEnabled },
      { label: 'Custom AI usage limits per tenant', included: true },
      { label: 'Dedicated support & custom SLA', included: true },
    ],
  }
  return [...qty, ...(tail[slug] ?? tail.free)]
}

async function PricingSection() {
  const [free, pro, ent] = await Promise.all([
    getLimits('free'),
    getLimits('pro'),
    getLimits('enterprise'),
  ])

  const plans: Plan[] = [
    {
      ...PLAN_META.free,
      price: '$0',
      features: buildFeatures('free', free),
    },
    {
      ...PLAN_META.pro,
      price: pro.pricePerUserCents > 0 ? `$${pro.pricePerUserCents / 100}` : '$0',
      features: buildFeatures('pro', pro),
    },
    {
      ...PLAN_META.enterprise,
      price: 'Custom',
      features: buildFeatures('enterprise', ent),
    },
  ]

  return (
    <section id="pricing" className="bg-white py-24 border-t border-slate-100">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-4">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-5 tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Start free. Upgrade when your team is ready. No hidden fees.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${
                plan.highlighted
                  ? 'border-indigo-500 bg-indigo-600 shadow-2xl shadow-indigo-200/60 scale-[1.03]'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}

              {/* Name + price */}
              <div>
                <p
                  className={`text-sm font-semibold uppercase tracking-widest mb-3 ${
                    plan.highlighted ? 'text-indigo-200' : 'text-slate-500'
                  }`}
                >
                  {plan.name}
                </p>
                <div className="flex items-end gap-1.5 mb-1">
                  <span
                    className={`text-4xl font-bold tracking-tight ${
                      plan.highlighted ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm mb-1.5 ${
                      plan.highlighted ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {plan.priceNote}
                  </span>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    plan.highlighted ? 'text-indigo-100' : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              {/* CTA */}
              {plan.ctaHref.startsWith('mailto') ? (
                <a
                  href={plan.ctaHref}
                  className={`inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-indigo-700 hover:bg-indigo-50'
                      : 'bg-slate-900 text-white hover:bg-slate-700'
                  }`}
                >
                  <Mail className="h-4 w-4" />
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className={`inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlighted
                      ? 'bg-white text-indigo-700 hover:bg-indigo-50'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              {/* Divider */}
              <div
                className={`border-t ${plan.highlighted ? 'border-indigo-500' : 'border-slate-100'}`}
              />

              {/* Feature list */}
              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-3 text-sm">
                    {f.included ? (
                      <CheckCircle2
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          plan.highlighted ? 'text-indigo-200' : 'text-emerald-500'
                        }`}
                      />
                    ) : (
                      <X className="h-4 w-4 mt-0.5 shrink-0 text-slate-300" />
                    )}
                    <span
                      className={
                        f.included
                          ? plan.highlighted
                            ? 'text-indigo-50'
                            : 'text-slate-700'
                          : 'text-slate-400'
                      }
                    >
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-slate-400 mt-10">
          All plans include unlimited team members on read-only tasks.{' '}
          <a
            href="mailto:hello@dragflow.io"
            className="text-indigo-500 hover:text-indigo-600 underline underline-offset-2"
          >
            Questions? Contact us.
          </a>
        </p>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Is there really a free plan — forever?',
    a: 'Yes. The Free plan has no time limit and requires no credit card. You get 10 users, 2 active flows, 5 departments, 7-day report history, and basic SLA tracking. Upgrade to Pro only when your team outgrows it.',
  },
  {
    q: 'How does Pro billing work?',
    a: 'Pro is $5 per active user per month, billed monthly. You only pay for users who have accepted their invitation and can log in. You can cancel or downgrade at any time — your data stays intact.',
  },
  {
    q: 'Can I upgrade or downgrade my plan anytime?',
    a: 'Absolutely. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle, so you keep Pro features until the period you paid for ends.',
  },
  {
    q: 'What does the AI assistant actually do?',
    a: 'The AI helps you build flows faster. It can suggest form field names and types based on your step description, write branch conditions from plain English ("if department is HR"), and draft step instructions. It does not execute flows or make routing decisions — it only assists during the building phase.',
  },
  {
    q: "How is my organisation's data kept private?",
    a: 'Each organisation (tenant) is fully isolated — your flows, users, and submissions are never visible to other tenants. All data is stored in a dedicated partition enforced at the database level. We never use your data to train AI models.',
  },
  {
    q: 'Can I bring in my existing team?',
    a: 'Yes. Invite teammates one by one via email, or use the Bulk CSV Import to onboard your entire team at once. Each invited user receives an email with a link to set up their account.',
  },
]

function FAQSection() {
  return (
    <section id="faq" className="bg-slate-50 py-24 border-t border-slate-100">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-4">
            FAQ
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-5 tracking-tight">
            Common questions
          </h2>
          <p className="text-lg text-slate-500">
            Can&apos;t find what you&apos;re looking for?{' '}
            <a
              href="mailto:hello@dragflow.io"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Ask us directly.
            </a>
          </p>
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-white overflow-hidden"
            >
              <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none select-none hover:bg-slate-50 transition-colors">
                <span className="font-medium text-slate-900 text-sm leading-snug">{item.q}</span>
                <span className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <div className="px-6 pb-5 pt-1 text-sm text-slate-500 leading-relaxed border-t border-slate-100">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA Banner ────────────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section className="bg-indigo-600 py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl font-bold text-white mb-5 tracking-tight">
          Ready to streamline your workflows?
        </h2>
        <p className="text-indigo-200 text-lg mb-10 leading-relaxed">
          Join teams already using DragFlow to cut approval times and gain full visibility over
          every process.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-8 py-3.5 rounded-xl transition-colors shadow-md text-base"
          >
            Get started for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-indigo-100 hover:text-white font-medium px-6 py-3.5 rounded-xl border border-indigo-400 hover:border-indigo-300 transition-colors text-base"
          >
            Log in to workspace
          </Link>
        </div>
        <p className="mt-6 text-indigo-300 text-sm">
          Free plan available · No credit card required
        </p>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function LandingFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-indigo-500 flex items-center justify-center">
                <GitBranch className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white text-lg tracking-tight">DragFlow</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Your AI workflow magic. Build, automate, and track approval workflows — without
              writing a single line of code.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-white">Product</p>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-white">Account</p>
            <ul className="space-y-3 text-sm text-slate-400">
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Log in
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-white transition-colors">
                  Sign up free
                </Link>
              </li>
              <li>
                <a href="mailto:hello@dragflow.io" className="hover:text-white transition-colors">
                  Contact us
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <p>© {year} DragFlow. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-slate-400 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-400 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/tasks')

  return (
    <div className="min-h-screen">
      <LandingNav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  )
}
