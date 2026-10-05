import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { aggregateRevenue, summarizeCart } from '../src/domain/cart.ts';
import { isAllowedGameFile, safeFileName } from '../src/domain/files.ts';
import { formatMoney, parsePriceToCents } from '../src/domain/money.ts';
import { couponSchema, credentialsSchema } from '../src/domain/validation.ts';
import { compareVersions, isSemver, slugify } from '../src/domain/versions.ts';
import { verifyStripeSignature } from '../supabase/functions/_shared/stripe.ts';

test('formata dinheiro e lê preços brasileiros', () => {
  assert.equal(parsePriceToCents('19,90'), 1990);
  assert.equal(parsePriceToCents('10'), 1000);
  assert.equal(parsePriceToCents('10.999'), null);
  assert.equal(parsePriceToCents('-1'), null);
  assert.match(formatMoney(1990, 'brl'), /19,90/);
});

test('calcula subtotal, desconto e moedas misturadas', () => {
  const summary = summarizeCart([
    { gameId: 'a', title: 'A', priceCents: 1000, currency: 'brl', coverPath: null },
    { gameId: 'b', title: 'B', priceCents: 500, currency: 'brl', coverPath: null },
  ], 2000);
  assert.equal(summary.subtotalCents, 1500);
  assert.equal(summary.discountCents, 1500);
  assert.equal(summary.totalCents, 0);
  assert.equal(summary.mixedCurrency, false);

  const mixed = summarizeCart([
    { gameId: 'a', title: 'A', priceCents: 1000, currency: 'brl', coverPath: null },
    { gameId: 'b', title: 'B', priceCents: 500, currency: 'usd', coverPath: null },
  ], 0);
  assert.equal(mixed.mixedCurrency, true);
});

test('agrupa receita por mês e moeda', () => {
  const rows = aggregateRevenue([
    { createdAt: '2026-10-02T00:00:00Z', totalCents: 1000, currency: 'brl' },
    { createdAt: '2026-10-20T00:00:00Z', totalCents: 500, currency: 'brl' },
    { createdAt: '2026-09-01T00:00:00Z', totalCents: 700, currency: 'usd' },
  ]);
  assert.equal(rows[0].month, '2026-10');
  assert.equal(rows[0].totalCents, 1500);
  assert.equal(rows[0].count, 2);
  assert.equal(rows[1].currency, 'usd');
});

test('compara versões e gera slugs', () => {
  assert.equal(compareVersions('1.2.0', '1.1.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(isSemver('1.0.0'), true);
  assert.equal(isSemver('01.0.0'), false);
  assert.equal(slugify('Ação e Aventura!'), 'acao-e-aventura');
});

test('aceita somente arquivos de jogo permitidos', () => {
  assert.equal(isAllowedGameFile('jogo.apk'), true);
  assert.equal(isAllowedGameFile('jogo.AAB'), true);
  assert.equal(isAllowedGameFile('malware.exe.txt'), false);
  assert.equal(safeFileName('../Meu Jogo.apk'), 'Meu_Jogo.apk');
});

test('valida login e cupom', () => {
  assert.equal(credentialsSchema.safeParse({ email: 'nao-e-email', password: '123' }).success, false);
  assert.equal(credentialsSchema.safeParse({ email: 'dev@example.com', password: 'senha-forte' }).success, true);
  assert.equal(couponSchema.safeParse({ code: 'LANCAMENTO', discountType: 'percent', discountValue: 120, maxRedemptions: null }).success, false);
  assert.equal(couponSchema.safeParse({ code: 'LANCAMENTO', discountType: 'percent', discountValue: 10, maxRedemptions: null }).success, true);
});

test('a assinatura do webhook da Stripe confere o corpo cru', async () => {
  const payload = '{"id":"evt_test"}';
  const secret = 'whsec_test_secret';
  const timestamp = '1700000000';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const signature = [...new Uint8Array(mac)].map((value) => value.toString(16).padStart(2, '0')).join('');
  const header = `t=${timestamp},v1=${signature}`;
  assert.equal(await verifyStripeSignature(payload, header, secret, 1700000000 * 1000), true);
  assert.equal(await verifyStripeSignature(payload, header, secret, 1700000401 * 1000), false);
  assert.equal(await verifyStripeSignature(`${payload} `, header, secret, 1700000000 * 1000), false);
});

test('a migration cria as tabelas exigidas e liga o RLS', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261003180000_init.sql', import.meta.url), 'utf8');
  for (const table of [
    'profiles', 'games', 'game_versions', 'game_images', 'game_videos', 'categories',
    'game_categories', 'orders', 'order_items', 'payments', 'downloads', 'reviews',
    'coupons', 'coupon_redemptions',
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}\\b`));
  }
  assert.equal((sql.match(/enable row level security/g) ?? []).length >= 15, true);
  assert.match(sql, /revoke all on table public\.game_versions/);
  assert.doesNotMatch(sql, /sk_live_|service_role_key\s*=\s*'[^']+'/i);
});

test('a publicação por desenvolvedor não deixa o cliente marcar o jogo como publicado', () => {
  const enums = readFileSync(new URL('../supabase/migrations/20261005010000_developer_enums.sql', import.meta.url), 'utf8');
  const sql = readFileSync(new URL('../supabase/migrations/20261005010100_developer_publishing.sql', import.meta.url), 'utf8');
  assert.match(enums, /'developer'/);
  assert.match(enums, /'submitted'/);
  assert.match(sql, /protect_game_submission/);
  assert.match(sql, /admin_review_game/);
  assert.match(sql, /attach_own_game_file/);
  assert.match(sql, /seller_id/);
  assert.match(sql, /game_files_owner_read/);
  assert.doesNotMatch(sql, /service_role/i);
});

test('o seed de desenvolvimento não publica um produto', () => {
  const sql = readFileSync(new URL('../supabase/seed/dev_only.sql', import.meta.url), 'utf8');
  assert.match(sql, /\[DEV\]/);
  assert.match(sql, /'draft'/);
  assert.match(sql, /production/);
});

test('o aplicativo não referencia segredos', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const forbidden = /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SERVICE_ROLE|sk_live_|sk_test_/;
  const walk = (directory: string): string[] => {
    return readdirSync(directory).flatMap((entry) => {
      const full = join(directory, entry);
      if (entry === 'node_modules' || entry === '.git' || entry === 'android') return [];
      if (statSync(full).isDirectory()) return walk(full);
      if (/\.(ts|tsx|js|json)$/.test(entry) && !full.includes(`${join('supabase', 'functions')}`)) return [full];
      return [];
    });
  };
  const files = walk(join(root, 'src'));
  for (const file of files) {
    assert.equal(forbidden.test(readFileSync(file, 'utf8')), false, file);
  }
});
