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
    id: 'creator',
    name: 'Creator',
    videos_limit: 10,
    price: 79.00,
    description: 'Para criadores - 10 vídeos com cortes ilimitados',
    is_unlimited: false,
    stripe_checkout_url: 'https://buy.stripe.com/bJeaEXa6hgRB7J907m6Na00'
  },
  {
    id: 'pro',
    name: 'Pro',
    videos_limit: 40,
    price: 197.00,
    description: 'Para profissionais - 40 vídeos com cortes ilimitados',
    is_unlimited: false,
    stripe_checkout_url: 'https://buy.stripe.com/9B67sL4LXbxhaVl4nC6Na01'
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    videos_limit: null, // null = ilimitado
    price: 397.00,
    description: 'Para criadores profissionais e agências - vídeos ilimitados',
    is_unlimited: true,
    stripe_checkout_url: 'https://buy.stripe.com/4gM8wPditfNxe7x2fu6Na02'
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
