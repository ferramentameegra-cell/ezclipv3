/**
 * CONTROLLER DE CHECKOUT
 * Cria sessão de checkout para assinaturas Stripe
 */

import { createSubscriptionCheckoutSession } from '../services/stripeService.js';
import { getPlanById } from '../models/plans.js';

const VALID_PLANS = ['creator', 'pro', 'unlimited'];

/**
 * POST /api/stripe/create-checkout-session
 * Cria sessão de checkout em modo subscription
 * Body: { planId: 'creator' | 'pro' | 'unlimited' }
 */
export async function createCheckoutSession(req, res) {
  try {
    const userId = req.userId || req.user?.id;
    const userEmail = req.user?.email;

    if (!userId || !userEmail) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const { planId } = req.body;

    if (!planId || !VALID_PLANS.includes(planId.toLowerCase())) {
      return res.status(400).json({
        error: 'planId obrigatório: creator, pro ou unlimited',
        code: 'INVALID_PLAN'
      });
    }

    const plan = getPlanById(planId);
    if (!plan) {
      return res.status(404).json({
        error: 'Plano não encontrado',
        code: 'PLAN_NOT_FOUND'
      });
    }

    const session = await createSubscriptionCheckoutSession({
      userId,
      userEmail,
      planId: planId.toLowerCase()
    });

    res.json({
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('[CHECKOUT] Erro:', error);
    res.status(500).json({
      error: error.message || 'Erro ao criar sessão de checkout',
      code: 'CHECKOUT_ERROR'
    });
  }
}
