/**
 * PLANOS DISPONÍVEIS
 * Cada plano contém uma quantidade específica de créditos
 */

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 27,
    price: 9.90,
    description: 'Ideal para iniciantes - 27 clipes'
  },
  {
    id: 'creator',
    name: 'Creator',
    credits: 75,
    price: 19.90,
    description: 'Para criadores ativos - 75 clipes'
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 150,
    price: 34.90,
    description: 'Para profissionais - 150 clipes'
  },
  {
    id: 'studio',
    name: 'Studio',
    credits: 300,
    price: 59.90,
    description: 'Para estúdios - 300 clipes'
  },
  {
    id: 'scale',
    name: 'Scale',
    credits: 600,
    price: 99.90,
    description: 'Para agências - 600 clipes'
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
