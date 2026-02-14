/**
 * CONTROLLER DE CRÉDITOS
 * Gerencia créditos dos usuários (1 crédito = 1 vídeo)
 */

import { getUserCredits, addCredits } from '../services/creditService.js';
import { getUserSubscriptionData } from '../services/subscriptionService.js';
import { getAllPlans } from '../models/plans.js';

/**
 * GET /api/credits/balance
 * Obter saldo (subscription: videos_used, videos_allowed)
 */
export const getBalance = async (req, res) => {
  try {
    if (!req.userId) {
      return res.json({
        videos_used: 0,
        videos_allowed: 1,
        plan_name: 'free',
        is_unlimited: false,
        message: 'Não autenticado'
      });
    }

    const sub = await getUserSubscriptionData(req.userId);
    const isUnlimited = sub.videos_allowed === -1;

    res.json({
      videos_used: sub.videos_used ?? 0,
      videos_allowed: sub.videos_allowed ?? 1,
      plan_name: sub.plan_name || 'free',
      subscription_status: sub.subscription_status,
      is_unlimited: isUnlimited,
      creditos: sub.videos_allowed === -1 ? -1 : Math.max(0, (sub.videos_allowed ?? 1) - (sub.videos_used ?? 0)) // compat
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao obter saldo:', error);
    res.status(500).json({
      error: 'Erro ao obter saldo',
      code: 'BALANCE_ERROR'
    });
  }
};

/**
 * GET /api/credits/plans
 * Listar todos os planos disponíveis (rota pública)
 */
export const getPlans = async (req, res) => {
  try {
    const plans = getAllPlans();
    
    console.log('[CREDITS] Planos disponíveis:', plans.length);
    
    res.json({
      success: true,
      plans: plans
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao listar planos:', error);
    res.status(500).json({
      error: 'Erro ao carregar planos',
      code: 'PLANS_ERROR'
    });
  }
};

/**
 * POST /api/credits/add
 * Adicionar créditos (usado por webhooks do Stripe, etc)
 * IMPORTANTE: Esta rota deve ser protegida e validar origem (webhook)
 */
export const addCreditsToUser = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({
        error: 'userId e amount (positivo) são obrigatórios',
        code: 'INVALID_PARAMS'
      });
    }

    const result = await addCredits(userId, amount);

    res.json({
      success: true,
      creditos: result.creditos,
      added: result.added
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao adicionar créditos:', error);
    res.status(500).json({
      error: error.message || 'Erro ao adicionar créditos',
      code: 'ADD_CREDITS_ERROR'
    });
  }
};
