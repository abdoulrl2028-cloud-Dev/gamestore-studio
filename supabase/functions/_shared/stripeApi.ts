export async function stripeForm(
  secretKey: string,
  path: string,
  params: URLSearchParams,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers,
    body: params,
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === 'object' && payload.error && 'message' in payload.error
      ? String((payload.error as { message?: string }).message)
      : 'A Stripe recusou a cobrança.';
    throw new Error(message);
  }
  return payload;
}
