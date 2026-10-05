import { json, corsHeaders } from '../_shared/http.ts';
import { stripeForm } from '../_shared/stripeApi.ts';
import { createAdminClient, createUserClient } from '../_shared/supabase.ts';

type LineItem = { title: string; unit_amount: number };
type PendingOrder = {
  reused: boolean;
  order_id: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  checkout_url: string | null;
  payment_method: string;
  line_items: LineItem[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const userClient = createUserClient(req);
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Faça login para comprar.' }, 401);

    const body = await req.json().catch(() => null);
    const gameIds = Array.isArray(body?.gameIds) ? body.gameIds.filter((id: unknown) => typeof id === 'string') : [];
    const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim() : '';
    const paymentMethod = body?.paymentMethod === 'pix' ? 'pix' : 'card';

    if (!UUID.test(idempotencyKey) || gameIds.some((id: string) => !UUID.test(id))) {
      return json({ error: 'Pedido inválido.' }, 400);
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('create_pending_order', {
      p_user_id: userData.user.id,
      p_game_ids: gameIds,
      p_idempotency_key: idempotencyKey,
      p_coupon_code: couponCode || null,
      p_payment_method: paymentMethod,
    });
    if (error) return json({ error: error.message }, 400);
    const order = data as PendingOrder;
    if (order.status === 'paid') return json({ orderId: order.order_id, status: 'paid' });
    if (order.checkout_url) return json({ orderId: order.order_id, status: order.status, url: order.checkout_url });

    const secret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secret) return json({ error: 'Pagamentos ainda não foram configurados no servidor.' }, 503);

    let stripeCouponId = '';
    if (order.discount_cents > 0) {
      const couponParams = new URLSearchParams();
      couponParams.set('amount_off', String(order.discount_cents));
      couponParams.set('currency', order.currency);
      couponParams.set('duration', 'once');
      couponParams.set('max_redemptions', '1');
      couponParams.set('name', `Pedido ${order.order_id.slice(0, 8)}`);
      const coupon = await stripeForm(secret, '/v1/coupons', couponParams, `coupon_${order.order_id}`);
      stripeCouponId = String(coupon.id);
    }

    const scheme = Deno.env.get('APP_SCHEME') ?? 'gamestorestudio';
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${scheme}://checkout/result?order_id=${order.order_id}&outcome=return&session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${scheme}://checkout/result?order_id=${order.order_id}&outcome=cancel`);
    params.set('client_reference_id', order.order_id);
    params.set('metadata[order_id]', order.order_id);
    if (userData.user.email) params.set('customer_email', userData.user.email);
    const methods = order.payment_method === 'pix' ? ['pix'] : ['card'];
    methods.forEach((method, index) => params.set(`payment_method_types[${index}]`, method));
    (order.line_items ?? []).forEach((item, index) => {
      params.set(`line_items[${index}][quantity]`, '1');
      params.set(`line_items[${index}][price_data][currency]`, order.currency);
      params.set(`line_items[${index}][price_data][unit_amount]`, String(item.unit_amount));
      params.set(`line_items[${index}][price_data][product_data][name]`, item.title.slice(0, 120));
    });
    if (stripeCouponId) params.set('discounts[0][coupon]', stripeCouponId);

    const session = await stripeForm(secret, '/v1/checkout/sessions', params, `checkout_${order.order_id}`);
    const url = typeof session.url === 'string' ? session.url : '';
    if (!url) return json({ error: 'A Stripe não retornou o endereço de pagamento.' }, 502);

    await admin.from('orders').update({
      checkout_url: url,
      stripe_session_id: String(session.id),
    }).eq('id', order.order_id);

    return json({ orderId: order.order_id, status: 'pending', url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível iniciar o pagamento.';
    return json({ error: message }, 400);
  }
});
