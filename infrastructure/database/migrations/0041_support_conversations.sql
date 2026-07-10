-- WhatsApp Support: conversations + messages.
--
-- Every inbound/outbound WhatsApp message and the AI-vs-human resolution
-- state lives here. Writes are service_role-only (the webhook handler and
-- admin-reply API route both use the admin client) — same "server is the
-- source of truth" pattern as orders/payments (0013_order_payment_rls.sql):
-- a customer's own WhatsApp message arrives via Meta's webhook, not a
-- direct client insert, so there is no legitimate authenticated INSERT
-- path to grant here either.

create type support_conversation_status as enum (
  'bot_active',
  'resolved',
  'escalated',
  'closed'
);

create type support_message_sender as enum (
  'customer',
  'bot',
  'owner'
);

create table public.support_conversations (
  id uuid primary key default uuid_generate_v7(),
  customer_id uuid references public.customers (id),
  order_id uuid references public.orders (id),
  whatsapp_wa_id text not null,
  status support_conversation_status not null default 'bot_active',
  ai_attempt_count integer not null default 0 check (ai_attempt_count >= 0),
  last_customer_message_at timestamptz,
  escalated_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_conversations_wa_id_idx on public.support_conversations (whatsapp_wa_id);
create index support_conversations_customer_id_idx on public.support_conversations (customer_id);
create index support_conversations_status_idx on public.support_conversations (status);

create trigger support_conversations_set_updated_at
  before update on public.support_conversations
  for each row execute function private.touch_row_no_version();

create table public.support_messages (
  id uuid primary key default uuid_generate_v7(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  sender support_message_sender not null,
  body text not null,
  whatsapp_message_id text,
  ai_model_id uuid references public.ai_models (id),
  created_at timestamptz not null default now()
);

create index support_messages_conversation_id_idx on public.support_messages (conversation_id, created_at);

alter table public.support_conversations enable row level security;
alter table public.support_conversations force row level security;

create policy support_conversations_select_own on public.support_conversations
  for select to authenticated
  using (customer_id = private.current_customer_id());

create policy support_conversations_admin_all on public.support_conversations
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

alter table public.support_messages enable row level security;
alter table public.support_messages force row level security;

create policy support_messages_select_own on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_conversations c
      where c.id = support_messages.conversation_id
        and c.customer_id = private.current_customer_id()
    )
  );

create policy support_messages_admin_all on public.support_messages
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());
