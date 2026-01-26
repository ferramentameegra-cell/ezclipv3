/**
 * CONTROLLER DE CRÉDITOS
 * Gerencia créditos dos usuários (1 crédito = 1 vídeo)
 */

import { getUserCredits, addCredits } from '../services/creditService.js';
import { getAllPlans } from '../models/plans.js';

/**
 * GET /api/credits/balance
 * Obter saldo de créditos do usuário autenticado
 */
export const getBalance = async (req, res) => {
  try {
    // Se não houver usuário autenticado, retornar saldo padrão (não bloquear)
    if (!req.userId) {
      return res.json({
        creditos: 0,
        is_unlimited: false,
        message: 'Não autenticado - créditos não disponíveis'
      });
    }

    const creditos = await getUserCredits(req.userId);

    res.json({
      creditos: creditos,
      is_unlimited: creditos === -1
    });
  } catch (error) {
    console.error('[CREDITS] Erro ao obter saldo:', error);
    res.status(500).json({
      error: 'Erro ao obter saldo de créditos',
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
