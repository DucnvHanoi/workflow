# Phase 1 — Gap Review (Day 22)

## Tenant Isolation Test Results

- [x] tenants — isolated ✅ (tenantARowsVisible: 0)
- [x] users — isolated ✅ (tenantARowsVisible: 0)
- [x] departments — isolated ✅
- [x] flows — isolated ✅
- [x] flow_versions — isolated ✅
- [x] flow_instances — isolated ✅
- [x] step_instances — isolated ✅
- [x] step_attachments — isolated ✅

## RLS Fixes Applied

- tenants: policy rewritten with correct ::uuid cast (was ::text)
- users: dropped stale users_select policy (old jwt path)
- users: fixed users_delete + users_update to use app_metadata path

## resolveAssignee() Results

- [x] fixed
- [x] manager_of_requestor
- [x] skip_level
- [x] department_head
- [x] role_in_dept

## Priority List Before Phase 2

1. None — Phase 1 complete, all milestones passed.
