-- ============================================================
-- Custom Access Token Hook
-- Injects tenant_id + role from public.users into the JWT
-- app_metadata on every sign-in / token refresh.
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE  -- reads DB but does not write; safe for Supabase Auth hook
AS $$
DECLARE
  claims          jsonb;
  user_tenant_id  uuid;
  user_role       text;
BEGIN
  -- 1. Pull tenant_id and role from public.users for this auth user
  SELECT tenant_id, role
    INTO user_tenant_id, user_role
    FROM public.users
   WHERE id = (event ->> 'user_id')::uuid;

  -- 2. Start from whatever claims Supabase already built
  claims := event -> 'claims';

  -- 3. Merge our custom fields into app_metadata
  --    app_metadata is server-controlled; users cannot overwrite it from the client
  claims := jsonb_set(claims, '{app_metadata}',
    COALESCE(claims -> 'app_metadata', '{}'::jsonb)
    || jsonb_build_object(
         'tenant_id', user_tenant_id,
         'role',      user_role
       )
  );

  -- 4. Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant Supabase Auth (supabase_auth_admin role) permission to execute this function
GRANT EXECUTE
  ON FUNCTION public.custom_access_token_hook
  TO supabase_auth_admin;

-- Revoke from public for security — only auth internals should call this
REVOKE EXECUTE
  ON FUNCTION public.custom_access_token_hook
  FROM PUBLIC, authenticated, anon;