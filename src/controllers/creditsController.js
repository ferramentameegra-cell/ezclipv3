/**
 * CONTROLLER DE CRÉDITOS E PLANOS
 * Gerencia compra de créditos e visualização de saldo
 */

import { getAllPlans, getPlanById } from '../models/plans.js';
import { getUserById, addCredits, getTotalCredits, updateUser } from '../models/users.js';
import { getUserUsageLogs, getUserUsageStats } from '../models/usageLogs.js';

/**
 * GET /api/credits/plans
 * Listar todos os planos disponíveis
 */
export const getPlans = (req, res) => {
  try {
    const plans = getAllPlans();
    res.json({ plans });
  } catch (error) {
    console.error('[CREDITS] Erro ao listar planos:', error);
    res.status(500).json({
      error: 'Erro ao listar planos',
      code: 'GET_PLANS_ERROR'
    });
  }
};

/**
 * GET /api/credits/balance
 * Obter saldo de créditos do usuário
 */
export const getBalance = (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const totalCredits = getTotalCredits(user.id);
    const userData = getUserById(user.id);

    res.json({
      free_trial_credits: userData.free_trial_credits,
      credits_balance: userData.credits_balance,
      total_credits: totalCredits,
      plan_id: userData.plan_id
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao obter saldo:', error);
    res.status(500).json({
      error: 'Erro ao obter saldo de créditos',
      code: 'GET_BALANCE_ERROR'
    });
  }
};

/**
 * POST /api/credits/purchase
 * Comprar plano (mockado - preparado para Stripe/Mercado Pago)
 */
export const purchasePlan = (req, res) => {
  try {
    const user = req.user;
    const { planId } = req.body;

    if (!user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!planId) {
      return res.status(400).json({
        error: 'ID do plano é obrigatório',
        code: 'MISSING_PLAN_ID'
      });
    }

    // Buscar plano
    const plan = getPlanById(planId);
    if (!plan) {
      return res.status(404).json({
        error: 'Plano não encontrado',
        code: 'PLAN_NOT_FOUND'
      });
    }

    // Em produção, aqui seria feito o pagamento via Stripe/Mercado Pago
    // Por enquanto, apenas adiciona créditos (mockado)
    console.log(`[CREDITS] Compra mockada de plano: ${plan.name} (${plan.credits} créditos) por usuário ${user.id}`);

    // Adicionar créditos ao usuário
    const updatedUser = addCredits(user.id, plan.credits);

    // Atualizar plan_id se necessário
    const userData = getUserById(user.id);
    if (!userData.plan_id) {
      updateUser(user.id, { plan_id: planId });
    }

    res.json({
      message: 'Plano comprado com sucesso (mockado)',
      plan: {
        id: plan.id,
        name: plan.name,
        credits: plan.credits,
        price: plan.price
      },
      new_balance: updatedUser.credits_balance,
      total_credits: getTotalCredits(user.id)
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao comprar plano:', error);
    res.status(500).json({
      error: 'Erro ao processar compra',
      code: 'PURCHASE_ERROR'
    });
  }
};

/**
 * GET /api/credits/usage
 * Obter histórico de uso de créditos
 */
export const getUsageHistory = (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    const logs = getUserUsageLogs(user.id);
    const stats = getUserUsageStats(user.id);

    res.json({
      logs,
      stats
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao obter histórico:', error);
    res.status(500).json({
      error: 'Erro ao obter histórico de uso',
      code: 'GET_USAGE_ERROR'
    });
  }
};
