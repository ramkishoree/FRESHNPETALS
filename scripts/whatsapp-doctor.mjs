#!/usr/bin/env node
// Diagnoses why the owner's WhatsApp order alert isn't arriving. Everything
// that can silently swallow a template send lives in Meta's account state,
// not in this repo — token validity, phone number registration, and above
// all whether `order_placed_alert_v3` has actually been APPROVED. This
// script asks Meta directly and prints the answers.
//
// Usage:
//   META_WHATSAPP_ACCESS_TOKEN=... META_WHATSAPP_PHONE_NUMBER_ID=... \
//   META_WHATSAPP_BUSINESS_ACCOUNT_ID=... META_WHATSAPP_OWNER_WA_ID=... \
//   node scripts/whatsapp-doctor.mjs [--send]
//
// `--send` fires a real order alert to META_WHATSAPP_OWNER_WA_ID with dummy
// values, so you can confirm end to end that a message lands on the phone.

const GRAPH = 'https://graph.facebook.com/v21.0';
const TEMPLATE_NAME = 'order_placed_alert_v3';

const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
const wabaId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
const ownerWaId = process.env.META_WHATSAPP_OWNER_WA_ID;
const doSend = process.argv.includes('--send');

if (!token || !phoneNumberId) {
  console.error(
    'META_WHATSAPP_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID are required.\n' +
      'Copy them out of Vercel → Project Settings → Environment Variables (Production).',
  );
  process.exit(1);
}

async function graph(path, init = {}) {
  const response = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function report(label, { ok, status, payload }) {
  if (ok) return true;
  const error = payload?.error;
  console.log(`  ✗ ${label}: HTTP ${status} — ${error?.message ?? 'unknown error'}`);
  if (error?.code)
    console.log(`    code ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ''}`);
  if (error?.error_user_msg) console.log(`    ${error.error_user_msg}`);
  return false;
}

async function main() {
  console.log('\n1. Access token + phone number');
  const number = await graph(
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,code_verification_status,platform_type,throughput`,
  );
  if (report('phone number lookup failed', number)) {
    const p = number.payload;
    console.log(`  ✓ ${p.display_phone_number} — "${p.verified_name}"`);
    console.log(
      `    quality: ${p.quality_rating ?? 'n/a'} · verification: ${p.code_verification_status ?? 'n/a'}`,
    );
  }

  console.log(`\n2. Template "${TEMPLATE_NAME}"`);
  if (!wabaId) {
    console.log('  ? META_WHATSAPP_BUSINESS_ACCOUNT_ID not set — skipping template check.');
    console.log(
      '    Find it in Meta App Dashboard → WhatsApp → API Setup (WhatsApp Business Account ID).',
    );
  } else {
    const templates = await graph(
      `${wabaId}/message_templates?limit=100&fields=name,status,language,category,components,rejected_reason`,
    );
    if (report('template list failed', templates)) {
      const all = templates.payload.data ?? [];
      const matches = all.filter((t) => t.name === TEMPLATE_NAME);
      if (matches.length === 0) {
        console.log(`  ✗ "${TEMPLATE_NAME}" does not exist on this WhatsApp Business Account.`);
        console.log(
          `    Templates that do exist: ${all.map((t) => `${t.name} (${t.status})`).join(', ') || 'none'}`,
        );
        console.log('    Create it per docs/whatsapp-support.md → Setup step 4.');
      }
      for (const template of matches) {
        const flag = template.status === 'APPROVED' ? '✓' : '✗';
        console.log(
          `  ${flag} ${template.name} [${template.language}] status=${template.status} category=${template.category}`,
        );
        if (template.rejected_reason && template.rejected_reason !== 'NONE') {
          console.log(`    rejected_reason: ${template.rejected_reason}`);
        }
        const header = (template.components ?? []).find((c) => c.type === 'HEADER');
        console.log(`    header: ${header ? `${header.format}` : 'none declared'}`);
        const body = (template.components ?? []).find((c) => c.type === 'BODY');
        const placeholders = new Set((body?.text ?? '').match(/\{\{\d+\}\}/g) ?? []);
        console.log(`    body placeholders: ${placeholders.size} (the app sends 9)`);
        if (placeholders.size !== 9) {
          console.log('    ✗ placeholder count must be 9 or Meta rejects every send.');
        }
      }
    }
  }

  console.log('\n3. Test send');
  if (!doSend) {
    console.log('  – skipped (re-run with --send to deliver a real test alert).');
  } else if (!ownerWaId) {
    console.log('  ✗ META_WHATSAPP_OWNER_WA_ID not set — nowhere to send.');
  } else {
    const result = await graph(`${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: ownerWaId,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                'FNP-TEST-0001',
                'Dozen Red Roses x1',
                'INR 999.00',
                'Test Customer',
                '+911234567890',
                '4/122 Vipul Khand, Gomti Nagar, Lucknow',
                'Cash on delivery',
                '20 July 2026',
                '9 AM - 11 AM',
              ].map((text) => ({ type: 'text', text })),
            },
          ],
        },
      }),
    });
    if (report('test send failed', result)) {
      console.log(`  ✓ accepted by Meta — message id ${result.payload.messages?.[0]?.id}`);
      console.log(`    If nothing arrives on ${ownerWaId}, the number is wrong or the`);
      console.log('    recipient has never opened a WhatsApp chat with this business.');
    }
  }

  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
