-- Owner's explicit call: add Cash on Delivery as a real payment method.
-- New enum value only, in its own migration/transaction — a newly-added
-- enum value can't be referenced (in a DEFAULT, CHECK, or function body)
-- within the same transaction that added it, so the schema/function
-- changes that actually use 'cod_pending' live in the next migration.

alter type public.payment_status add value if not exists 'cod_pending';
