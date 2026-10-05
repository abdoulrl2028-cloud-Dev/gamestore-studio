import { corsHeaders, json } from '../_shared/http.ts';
import { verifyStripeSignature } from '../_shared/stripe.ts';
import { createAdminClient } from '../_shared/supabase.ts';

type StripeSession = {
  id?: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  client_reference_id?: string;
  payment_intent?: string;
  metadata?: { order_id?: string };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const payload = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return json({ error: 'Webhook não configurado.' }, 503);
  const valid = await verifyStripeSignature(payload, req.headers.get('stripe-signature'), secret);
  if (!valid) return json({ error: 'Assinatura inválida.' }, 400);

  let event: { id?: string; type?: string; data?: { object?: StripeSession } };
  try {
    event = JSON.parse(payload);
  } catch {
    return json({ error: 'Evento inválido.' }, 400);
  }

  const session = event.data?.object;
  const orderId = session?.metadata?.order_id || session?.client_reference_id;
  if (!event.id || !event.type || !orderId) return json({ received: true, ignored: true });

  const admin = createAdminClient();
  if (event.type === 'checkout.session.async_payment_failed') {
    await admin.rpc('mark_order_failed', { p_order_id: orderId, p_reason: event.type });
    return json({ received: true });
  }

  const paidEvent = event.type === 'checkout.session.async_payment_succeeded'
    || (event.type === 'checkout.session.completed' && session?.payment_status === 'paid');
  if (!paidEvent) return json({ received: true, pending: true });

  const { data, error } = await admin.rpc('mark_order_paid', {
    p_order_id: orderId,
    p_provider: 'stripe',
    p_provider_payment_id: session?.payment_intent || session?.id || event.id,
    p_provider_event_id: event.id,
    p_amount_cents: session?.amount_total ?? -1,
    p_currency: session?.currency ?? '',
  });
  if (error) return json({ error: error.message }, 500);
  if (data && typeof data === 'object' && 'status' in data && data.status === 'mismatch') {
    return json({ received: true, status: 'mismatch' });
  }
  return json({ received: true, result: data });
});
