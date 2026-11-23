-- Fix the deferred tyre stock validation trigger from v1.3.11.
-- A deferred constraint trigger executes after the SECURITY DEFINER RPC call
-- has returned; its SECURITY INVOKER function therefore runs as authenticated,
-- which is intentionally not granted direct access to tyredesk.records.
-- Restore the original trust boundary: run read-only validation as the
-- restricted tyredesk_rpc role, not as postgres and not as authenticated.
-- The existing trigger and all shop data remain unchanged.
begin;
grant tyredesk_rpc to postgres with set true;
grant create on schema tyredesk to tyredesk_rpc;
alter function tyredesk.guard_inventory_identity_v2() owner to tyredesk_rpc;
alter function tyredesk.guard_inventory_identity_v2() security definer;
revoke create on schema tyredesk from tyredesk_rpc;
grant tyredesk_rpc to postgres with set false;
-- Do not grant authenticated or anon table access or function execute rights.
commit;
