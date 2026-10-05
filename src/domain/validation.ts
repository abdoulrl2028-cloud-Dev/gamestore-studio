import { z } from 'zod';

import { parsePriceToCents } from '@/domain/money';
import { isSemver } from '@/domain/versions';

export const credentialsSchema = z.object({
  email: z.email({ error: 'Informe um e-mail válido.' }),
  password: z.string().min(8, { error: 'A senha precisa ter pelo menos 8 caracteres.' }).max(72),
});

export const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2, { error: 'Informe seu nome.' }).max(80),
});

export const gameFormSchema = z.object({
  title: z.string().trim().min(2, { error: 'Informe o nome do jogo.' }).max(120),
  shortDescription: z.string().trim().min(10, { error: 'A descrição curta precisa ter pelo menos 10 caracteres.' }).max(180),
  description: z.string().trim().min(20, { error: 'Descreva o jogo com pelo menos 20 caracteres.' }).max(8000),
  price: z.string().trim().refine((value) => parsePriceToCents(value) !== null, {
    error: 'Informe um preço válido, como 19,90.',
  }),
  currency: z.enum(['brl', 'usd'], { error: 'Escolha BRL ou USD.' }),
  genre: z.string().trim().min(2, { error: 'Informe o gênero.' }).max(40),
  platforms: z.array(z.enum(['android', 'windows', 'linux', 'macos'])).min(1, { error: 'Selecione uma plataforma.' }),
  version: z.string().trim().refine(isSemver, { error: 'Use uma versão no formato 1.0.0.' }),
  minRequirements: z.string().trim().min(3, { error: 'Informe os requisitos mínimos.' }).max(2000),
  recommendedRequirements: z.string().trim().min(3, { error: 'Informe os requisitos recomendados.' }).max(2000),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, { error: 'Escolha de 1 a 5 estrelas.' }).max(5),
  body: z.string().trim().max(2000, { error: 'A avaliação pode ter no máximo 2000 caracteres.' }),
});

export const couponSchema = z.object({
  code: z.string().trim().min(3, { error: 'O cupom precisa ter pelo menos 3 caracteres.' }).max(40),
  discountType: z.enum(['percent', 'fixed']),
  discountValue: z.number().int().positive({ error: 'Informe um valor de desconto maior que zero.' }),
  maxRedemptions: z.number().int().positive().nullable(),
}).superRefine((value, context) => {
  if (value.discountType === 'percent' && value.discountValue > 100) {
    context.addIssue({
      code: 'custom',
      path: ['discountValue'],
      message: 'A porcentagem máxima é 100.',
    });
  }
});

export const developerGameSchema = gameFormSchema.extend({
  ageRating: z.enum(['L', '10', '12', '14', '16', '18'], { error: 'Escolha a classificação indicativa.' }),
  categoryId: z.string().uuid({ error: 'Selecione uma categoria.' }),
  privacyPolicyUrl: z.string().trim().regex(/^https:\/\/.+/, { error: 'A política de privacidade precisa ser um link https.' }),
  developerWebsite: z.string().trim().refine((value) => value === '' || /^https:\/\/.+/.test(value), {
    error: 'O site do desenvolvedor precisa ser um link https.',
  }),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, { error: 'Informe o nome da categoria.' }).max(40),
});

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
