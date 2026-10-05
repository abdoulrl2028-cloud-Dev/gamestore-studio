import type { GameStatus } from '@/types';

export const GAME_STATUS_LABEL: Record<GameStatus, string> = {
  draft: 'Rascunho',
  submitted: 'Enviado para análise',
  in_review: 'Em análise',
  rejected: 'Rejeitado',
  published: 'Publicado',
  unpublished: 'Não publicado',
};

export const AGE_RATINGS = ['L', '10', '12', '14', '16', '18'] as const;
