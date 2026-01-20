/**
 * CONTROLLER DE CRÉDITOS
 * Gerencia créditos dos usuários (1 crédito = 1 vídeo)
 */

import { getUserCredits, addCredits } from '../services/creditService.js';
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js';

/**
 * GET /api/credits/balance
 * Obter saldo de créditos do usuário autenticado
 */
export const getBalance = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        error: 'Não autenticado',
        code: 'NOT_AUTHENTICATED'
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
