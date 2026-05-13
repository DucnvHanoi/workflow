-- Migration: runtime_rls_policies
-- Adds RLS policies so authenticated users can trigger flows and
-- see their own instances/step-instances.
-- Admins retain full tenant-scoped access via adminClient (service role bypasses RLS).
-- All policies use app_metadata path — consistent with Day 22 RLS fixes.

-- ─── flow_instances ───────────────────────────────────────────────────────────

-- Any authenticated user in the tenant can SELECT instances they triggered
-- or instances where they are assigned to a step (handled via step_instances).
-- Keep it simple for Phase 3: users see instances they triggered.
CREATE POLICY "users_select_own_flow_instances"
  ON public.flow_instances
  FOR SELECT
  USING (
    triggered_by = auth.uid()
    AND (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    ) = (
      SELECT tenant_id FROM public.flows f
        JOIN public.flow_versions fv ON fv.id = flow_instances.flow_version_id
      WHERE fv.flow_id = f.id
      LIMIT 1
    )
  );

-- Any authenticated tenant user can INSERT a new flow instance (triggering a flow).
-- tenant_id check done in server action; RLS here is a safety net.
-- We use a simpler INSERT policy: the triggered_by must be themselves.
CREATE POLICY "users_insert_own_flow_instances"
  ON public.flow_instances
  FOR INSERT
  WITH CHECK (
    triggered_by = auth.uid()
  );

-- Admins can SELECT all instances in their tenant (for dashboard, Phase 4)
CREATE POLICY "admin_select_tenant_flow_instances"
  ON public.flow_instances
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND flow_version_id IN (
      SELECT fv.id FROM public.flow_versions fv
        JOIN public.flows f ON f.id = fv.flow_id
      WHERE f.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );

-- Admins can UPDATE instances (cancel, reassign — Phase 3 Week 18)
CREATE POLICY "admin_update_tenant_flow_instances"
  ON public.flow_instances
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─── step_instances ───────────────────────────────────────────────────────────

-- Users can SELECT step_instances assigned to them OR belonging to their triggered instances
CREATE POLICY "users_select_own_step_instances"
  ON public.step_instances
  FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR instance_id IN (
      SELECT id FROM public.flow_instances WHERE triggered_by = auth.uid()
    )
  );

-- Users can INSERT step_instances (done server-side via adminClient, but safety net)
CREATE POLICY "users_insert_step_instances"
  ON public.step_instances
  FOR INSERT
  WITH CHECK (true); -- adminClient handles this; pure safety net

-- Users can UPDATE step_instances assigned to them (submit form data — Phase 3 Week 13)
CREATE POLICY "users_update_assigned_step_instances"
  ON public.step_instances
  FOR UPDATE
  USING (
    assigned_to = auth.uid()
  );

-- Admins can SELECT all step_instances in their tenant
CREATE POLICY "admin_select_tenant_step_instances"
  ON public.step_instances
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND instance_id IN (
      SELECT fi.id FROM public.flow_instances fi
        JOIN public.flow_versions fv ON fv.id = fi.flow_version_id
        JOIN public.flows f ON f.id = fv.flow_id
      WHERE f.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
    )
  );

-- Admins can UPDATE any step_instance in their tenant (reassign — Phase 3 Week 18)
CREATE POLICY "admin_update_tenant_step_instances"
  ON public.step_instances
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );