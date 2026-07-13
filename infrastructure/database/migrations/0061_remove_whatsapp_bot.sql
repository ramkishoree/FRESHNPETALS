-- Owner's explicit call: drop the WhatsApp support bot entirely (AI
-- reply attempts, escalation, admin Support Inbox — the Support Inbox
-- UI itself was already removed in an earlier admin-simplification
-- pass, this is the last of it). All application code that read/wrote
-- these tables (bot-runtime.ts, support-repository.ts, the
-- api/webhooks/whatsapp route, conversation-decision.ts) has been
-- deleted alongside this migration — confirmed via a repo-wide grep
-- with zero remaining references before writing this. The order-placed
-- WhatsApp alert to the owner (notifyOwnerOrderPlaced) is unaffected:
-- it never read or wrote these tables, only sent a template message.

drop table if exists public.support_messages;
drop table if exists public.support_conversations;
drop type if exists public.support_message_sender;
drop type if exists public.support_conversation_status;
