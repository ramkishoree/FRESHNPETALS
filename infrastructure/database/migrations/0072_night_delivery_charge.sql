-- Night delivery charge: a flat surcharge for a late delivery slot.
--
-- The owner delivers late as a favour, not as a default, and wanted it
-- priced. Two settings rather than one so the cutoff is the owner's
-- decision rather than a constant in the code — "late" is 8 PM in one
-- season and 7 PM in another.
--
-- Seeded at 0, deliberately. A surcharge that switched itself on with a
-- default amount would overcharge every late order placed between this
-- migration running and the owner noticing.
--
-- Triggered by the *delivery slot*, not the order time: the cost is
-- going out at night, so a 2 PM order for a 9 PM slot pays it and an
-- 11 PM order for tomorrow morning does not.

insert into public.system_settings (key, category, value, requires_owner, description)
values
  (
    'night_charge_inr',
    'delivery',
    '0'::jsonb,
    false,
    'Flat rupee surcharge added when the chosen delivery slot starts at or after night_charge_after_time. 0 disables it.'
  ),
  (
    'night_charge_after_time',
    'delivery',
    '"20:00"'::jsonb,
    false,
    'Delivery slots starting at or after this 24-hour HH:MM time count as night deliveries.'
  )
on conflict (key) do nothing;
