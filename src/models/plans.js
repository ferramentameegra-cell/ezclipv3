/**
 * PLANOS DISPONÍVEIS
 * Cada plano permite processar uma quantidade específica de vídeos
 * Cortes por vídeo são ilimitados
 */

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    videos_limit: 1,
    price: 0,
    description: 'Ideal para teste - 1 vídeo com cortes ilimitados',
    is_unlimited: false
  },
  {
    id: 'starter',
    name: 'Starter',
    videos_limit: 10,
    price: 97.00,
    description: 'Para iniciantes - 10 vídeos com cortes ilimitados',
    is_unlimited: false
  },
  {
    id: 'creator',
    name: 'Creator',
    videos_limit: 30,
    price: 197.00,
    description: 'Para criadores ativos - 30 vídeos com cortes ilimitados',
    is_unlimited: false
  },
  {
    id: 'pro',
    name: 'Pro',
    videos_limit: 50,
    price: 297.00,
    description: 'Para profissionais - 50 vídeos com cortes ilimitados',
    is_unlimited: false
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    videos_limit: null, // null = ilimitado
    price: 497.00,
    description: 'Para criadores profissionais e agências - vídeos ilimitados',
    is_unlimited: true
  }
];

/**
 * Obter plano por ID
 */
export function getPlanById(planId) {
  return PLANS.find(plan => plan.id === planId) || null;
}

/**
 * Obter todos os planos
 */
export function getAllPlans() {
  return PLANS;
}
