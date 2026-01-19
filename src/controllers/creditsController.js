/**
 * CONTROLLER DE PLANOS E VÍDEOS
 * Gerencia compra de planos e visualização de vídeos processados
 */

import { getAllPlans, getPlanById } from '../models/plans.js';
import { getUserById, updateUser } from '../models/users.js';
import { getUserVideoStats } from '../services/videoService.js';
import { getUserVideoLogs } from '../models/videoLogs.js';

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
 * Obter informações de vídeos processados do usuário
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

    const videoStats = getUserVideoStats(user.id);
    const userData = getUserById(user.id);

    res.json({
      videos_used: videoStats.videos_used,
      videos_limit: videoStats.videos_limit,
      videos_remaining: videoStats.videos_remaining,
      is_unlimited: videoStats.is_unlimited,
      plan_id: userData.plan_id,
      plan_name: videoStats.plan_name,
      total_videos_processed: videoStats.total_videos_processed
    });
  } catch (error) {
    console.error('[VIDEOS] Erro ao obter informações:', error);
    res.status(500).json({
      error: 'Erro ao obter informações de vídeos',
      code: 'GET_VIDEO_INFO_ERROR'
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
    // Por enquanto, apenas atualiza o plano (mockado)
    console.log(`[PLANS] Compra mockada de plano: ${plan.name} (${plan.videos_limit || 'ilimitado'} vídeos) por usuário ${user.id}`);

    // Atualizar plano do usuário
    const userData = getUserById(user.id);
    const updates = {
      plan_id: planId,
      videos_limit: plan.videos_limit,
      videos_used: userData.videos_used || 0 // Manter vídeos já processados
    };

    // Se for upgrade, não resetar contador (créditos acumuláveis)
    // Se for downgrade, manter contador mas limitar pelo novo plano
    updateUser(user.id, updates);

    const updatedUser = getUserById(user.id);
    const videoStats = getUserVideoStats(user.id);

    res.json({
      message: 'Plano comprado com sucesso (mockado)',
      plan: {
        id: plan.id,
        name: plan.name,
        videos_limit: plan.videos_limit,
        is_unlimited: plan.is_unlimited,
        price: plan.price
      },
      videos_used: videoStats.videos_used,
      videos_limit: videoStats.videos_limit,
      videos_remaining: videoStats.videos_remaining,
      is_unlimited: videoStats.is_unlimited
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
 * Obter histórico de vídeos processados
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

    const logs = getUserVideoLogs(user.id);
    const videoStats = getUserVideoStats(user.id);

    res.json({
      logs,
      stats: {
        total_videos_processed: videoStats.total_videos_processed,
        videos_used: videoStats.videos_used,
        videos_limit: videoStats.videos_limit,
        videos_remaining: videoStats.videos_remaining,
        is_unlimited: videoStats.is_unlimited,
        plan_name: videoStats.plan_name
      }
    });
  } catch (error) {
    console.error('[VIDEOS] Erro ao obter histórico:', error);
    res.status(500).json({
      error: 'Erro ao obter histórico de vídeos',
      code: 'GET_VIDEO_HISTORY_ERROR'
    });
  }
};
