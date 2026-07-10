-- Seed — Roles & Permissions. Ch.10 §65 (v1 roles), §67 (permission list,
-- given verbatim as examples — more are added incrementally as each
-- business module ships in later phases, not invented speculatively here).
-- Administrator and Owner get every seeded permission (§33/§80: both get
-- full access, no data-level distinction). Customer/Anonymous get none —
-- their access is row-ownership-based (RLS), not permission-string-based.

insert into public.roles (name, description, priority, system_role) values
  ('anonymous', 'Unauthenticated visitor', 0, true),
  ('customer', 'Registered or guest purchaser', 10, true),
  ('administrator', 'Agency/dev operator with full platform access', 100, true),
  ('owner', 'Business owner with full platform access', 200, true)
on conflict (name) do nothing;

insert into public.permissions (name, description) values
  ('products.read', 'View product catalog, including unpublished'),
  ('products.create', 'Create new products'),
  ('products.update', 'Edit existing products'),
  ('products.publish', 'Publish/unpublish products'),
  ('products.delete', 'Soft-delete products'),
  ('orders.read', 'View orders'),
  ('orders.update', 'Update order status/fulfillment'),
  ('inventory.update', 'Adjust stock levels'),
  ('blogs.publish', 'Publish/unpublish blog posts'),
  ('coupons.create', 'Create coupons'),
  ('offers.publish', 'Publish/unpublish offers'),
  ('users.manage', 'Manage user accounts'),
  ('roles.manage', 'Manage roles and role assignments'),
  ('settings.manage', 'Manage platform settings'),
  ('ai.execute', 'Trigger AI agent tasks/workflows'),
  ('ai.approve', 'Approve or reject AI-generated changes'),
  ('system.deploy', 'Trigger a production deployment')
on conflict (name) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.name in ('administrator', 'owner')
on conflict do nothing;
