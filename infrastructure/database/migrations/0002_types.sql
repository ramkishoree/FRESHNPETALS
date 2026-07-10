-- Enum types shared across domains. Handbook section references noted per type.
-- Where the Handbook names a column's type but doesn't enumerate every value
-- (e.g. fulfillment_status, job_status), the value list is a documented,
-- reasonable inference — see docs/database-schema.md.

-- Commerce — Ch.10 Part 2/3
create type product_status as enum ('draft', 'ai_generated', 'pending_review', 'approved', 'published', 'archived', 'out_of_stock', 'hidden'); -- Ch.9 chunk / Ch.8 state machine
create type inventory_transaction_type as enum ('stock_added', 'reservation', 'reservation_release', 'sale', 'refund', 'correction', 'damage', 'transfer'); -- §30
create type order_status as enum ('pending_payment', 'paid', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'failed', 'refunded'); -- §43
create type payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded', 'cancelled'); -- §46
create type fulfillment_status as enum ('unfulfilled', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'failed'); -- inferred: denormalized fulfillment-only facet of order_status
create type checkout_session_status as enum ('draft', 'validated', 'payment_pending', 'completed', 'expired', 'cancelled'); -- §45
create type refund_status as enum ('requested', 'approved', 'rejected', 'processed', 'failed'); -- §48
create type delivery_status as enum ('pending', 'out_for_delivery', 'delivered', 'failed'); -- inferred, §51
create type review_status as enum ('pending', 'approved', 'rejected'); -- inferred, moderation per Ch.16 admin APIs

-- Identity — Ch.10 Part 4
create type auth_provider as enum ('email', 'google'); -- §73, v1 only; future providers are additive ALTER TYPE, not a redesign
create type oauth_provider as enum ('google'); -- §73
create type user_status as enum ('active', 'suspended', 'deactivated'); -- inferred, §64
create type api_key_status as enum ('active', 'revoked', 'expired'); -- inferred, §74

-- AI — Ch.10 Part 5 / Ch.14-15 risk model
create type ai_risk_level as enum ('informational', 'advisory', 'operational', 'financial', 'critical'); -- Ch.14/15 5-tier AI risk model; used by ai_capabilities.risk_level and ai_tools.danger_level
create type ai_agent_status as enum ('active', 'inactive', 'deprecated'); -- inferred, §89
create type ai_task_status as enum ('queued', 'running', 'waiting_approval', 'completed', 'rejected', 'cancelled', 'failed'); -- §96
create type ai_workflow_run_status as enum ('running', 'completed', 'failed', 'cancelled'); -- inferred, §99
create type ai_approval_decision as enum ('approved', 'rejected', 'edited', 'deferred'); -- §100
create type ai_prompt_status as enum ('draft', 'review', 'approved', 'published', 'deprecated', 'archived'); -- Ch.14 prompt lifecycle

-- Platform/Operations — Ch.10 Part 6
create type job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled'); -- inferred, §127
create type job_priority as enum ('critical', 'high', 'medium', 'low'); -- §127
create type outbox_status as enum ('pending', 'publishing', 'published', 'failed', 'dead_letter'); -- §121
create type notification_channel as enum ('email', 'whatsapp', 'telegram', 'push', 'sms'); -- §125
create type notification_status as enum ('pending', 'sent', 'failed'); -- inferred, §125
create type webhook_status as enum ('received', 'processing', 'processed', 'failed'); -- inferred, §130
create type health_status as enum ('healthy', 'warning', 'critical', 'offline'); -- §136

-- Marketing/CMS — Ch.10 Part 7
create type blog_status as enum ('draft', 'review', 'scheduled', 'published', 'archived'); -- §146
create type content_status as enum ('draft', 'published', 'archived'); -- inferred, static_pages/landing_pages §149/§150
create type redirect_type as enum ('301', '302', '410'); -- §157
