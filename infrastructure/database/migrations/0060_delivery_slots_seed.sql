-- Owner's explicit call: checkout never offered a delivery time slot at
-- all (the schema/API/admin CRUD for delivery_slots has existed since
-- Phase 3, but the table was never seeded and checkout-flow.tsx never
-- collected one) — "put demo slots but editable via admin panel." This
-- seeds one default delivery_group and six same-day 2-hour windows
-- covering normal business hours; /admin/delivery-slots already has a
-- working CRUD UI for the owner to add/remove/retime/deactivate slots
-- from here.

insert into public.delivery_groups (id, name, description, default_slot_duration_minutes, preparation_time_minutes, same_day_allowed, active)
values ('00000000-0000-0000-0000-0000000000d1', 'Standard delivery', 'Default delivery window group for all outlets.', 120, 30, true, true)
on conflict (id) do nothing;

insert into public.delivery_slots (delivery_group_id, label, start_time, end_time, max_capacity, is_active)
values
  ('00000000-0000-0000-0000-0000000000d1', '9 AM - 11 AM', '09:00', '11:00', 10, true),
  ('00000000-0000-0000-0000-0000000000d1', '11 AM - 1 PM', '11:00', '13:00', 10, true),
  ('00000000-0000-0000-0000-0000000000d1', '1 PM - 3 PM', '13:00', '15:00', 10, true),
  ('00000000-0000-0000-0000-0000000000d1', '3 PM - 5 PM', '15:00', '17:00', 10, true),
  ('00000000-0000-0000-0000-0000000000d1', '5 PM - 7 PM', '17:00', '19:00', 10, true),
  ('00000000-0000-0000-0000-0000000000d1', '7 PM - 9 PM', '19:00', '21:00', 10, true)
on conflict do nothing;
