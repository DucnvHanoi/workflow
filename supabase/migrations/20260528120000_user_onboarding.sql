-- Per-user onboarding step tracking (tour completion, checklist dismissal, etc.)

create table if not exists public.user_onboarding (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  step_key      text        not null,
  completed_at  timestamptz not null default now(),
  constraint user_onboarding_user_step_unique unique (user_id, step_key)
);

alter table public.user_onboarding enable row level security;

create policy "user_onboarding_select" on public.user_onboarding
  for select using (auth.uid() = user_id);

create policy "user_onboarding_insert" on public.user_onboarding
  for insert with check (auth.uid() = user_id);

create index user_onboarding_user_id_idx on public.user_onboarding (user_id);
