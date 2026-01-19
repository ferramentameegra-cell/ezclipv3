/**
 * CONTROLLER STRIPE
 * Gerencia webhooks e confirmação de pagamentos
 */

import { stripe, constructWebhookEvent, getCheckoutSession } from '../services/stripeService.js';
import { getPlanById } from '../models/plans.js';
import { getUserById, updateUser } from '../models/users.js';
import { getUserVideoStats } from '../services/videoService.js';

/**
 * POST /api/stripe/webhook
 * Webhook do Stripe para processar eventos de pagamento
 */
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[STRIPE] STRIPE_WEBHOOK_SECRET não configurado - webhook desabilitado');
    return res.status(400).send('Webhook secret não configurado');
  }

  let event;

  try {
    // req.body já vem como Buffer do middleware express.raw
    event = constructWebhookEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[STRIPE] Erro ao verificar webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Processar evento
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'payment_intent.succeeded':
        console.log('[STRIPE] PaymentIntent succeeded:', event.data.object.id);
        break;
      
      case 'payment_intent.payment_failed':
        console.error('[STRIPE] PaymentIntent failed:', event.data.object.id);
        break;
      
      default:
        console.log(`[STRIPE] Evento não tratado: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[STRIPE] Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro ao processar webhook' });
  }
};

/**
 * Processar checkout completado
 */
async function handleCheckoutCompleted(session) {
  try {
    console.log('[STRIPE] Checkout session completed:', session.id);
    
    const { planId, userId } = session.metadata || {};
    
    if (!planId || !userId) {
      console.error('[STRIPE] Metadata faltando na sessão:', session.id);
      return;
    }

    // Verificar se pagamento foi confirmado
    if (session.payment_status !== 'paid') {
      console.warn('[STRIPE] Pagamento não confirmado para sessão:', session.id);
      return;
    }

    // Buscar plano
    const plan = getPlanById(planId);
    if (!plan) {
      console.error('[STRIPE] Plano não encontrado:', planId);
      return;
    }

    // Buscar usuário
    const user = getUserById(userId);
    if (!user) {
      console.error('[STRIPE] Usuário não encontrado:', userId);
      return;
    }

    // Atualizar plano do usuário
    const updates = {
      plan_id: planId,
      videos_limit: plan.videos_limit,
      videos_used: user.videos_used || 0 // Manter vídeos já processados
    };

    updateUser(userId, updates);

    const videoStats = getUserVideoStats(userId);
    
    console.log(`[STRIPE] ✅ Plano ${plan.name} ativado para usuário ${userId} via webhook`);
    console.log(`[STRIPE] Vídeos: ${videoStats.videos_used}/${videoStats.videos_limit || 'ilimitado'}`);

  } catch (error) {
    console.error('[STRIPE] Erro ao processar checkout completado:', error);
    throw error;
  }
}

/**
 * GET /api/stripe/verify-session
 * Verificar status de uma sessão de checkout
 */
export const verifySession = async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId é obrigatório',
        code: 'MISSING_SESSION_ID'
      });
    }

    const session = await getCheckoutSession(sessionId);

    res.json({
      sessionId: session.id,
      payment_status: session.payment_status,
      status: session.status,
      metadata: session.metadata
    });
  } catch (error) {
    console.error('[STRIPE] Erro ao verificar sessão:', error);
    res.status(500).json({
      error: 'Erro ao verificar sessão',
      code: 'VERIFY_SESSION_ERROR',
      details: error.message
    });
  }
};

/**
 * POST /api/stripe/validate-payment-link
 * Validar compra via Payment Link (buscar pagamentos recentes do usuário)
 */
export const validatePaymentLink = async (req, res) => {
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
        error: 'planId é obrigatório',
        code: 'MISSING_PLAN_ID'
      });
    }

    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe não configurado',
        code: 'STRIPE_NOT_CONFIGURED'
      });
    }

    // Buscar pagamentos recentes do usuário (últimos 5 minutos)
    // Payment Links criam Checkout Sessions com client_reference_id
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
    
    const sessions = await stripe.checkout.sessions.list({
      limit: 10,
      created: { gte: fiveMinutesAgo },
      expand: ['data.payment_intent']
    });

    // Procurar sessão com client_reference_id correspondente ao usuário
    const userSession = sessions.data.find(session => 
      session.client_reference_id === user.id &&
      session.payment_status === 'paid' &&
      session.status === 'complete'
    );

    if (!userSession) {
      return res.json({
        success: false,
        message: 'Nenhum pagamento confirmado encontrado'
      });
    }

    // Verificar se já foi processado (verificar metadata ou status do usuário)
    const userData = getUserById(user.id);
    const plan = getPlanById(planId);

    if (!plan) {
      return res.status(404).json({
        error: 'Plano não encontrado',
        code: 'PLAN_NOT_FOUND'
      });
    }

    // Se o plano já está ativado, retornar sucesso
    if (userData.plan_id === planId) {
      return res.json({
        success: true,
        message: 'Plano já está ativado',
        plan: {
          id: plan.id,
          name: plan.name,
          videos_limit: plan.videos_limit,
          is_unlimited: plan.is_unlimited
        }
      });
    }

    // Ativar o plano
    const updates = {
      plan_id: planId,
      videos_limit: plan.videos_limit,
      videos_used: userData.videos_used || 0
    };

    updateUser(user.id, updates);

    const videoStats = getUserVideoStats(user.id);

    console.log(`[STRIPE] ✅ Plano ${plan.name} ativado para usuário ${user.id} via validação manual`);

    res.json({
      success: true,
      message: 'Plano ativado com sucesso',
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
    console.error('[STRIPE] Erro ao validar Payment Link:', error);
    res.status(500).json({
      error: 'Erro ao validar pagamento',
      code: 'VALIDATE_PAYMENT_LINK_ERROR',
      details: error.message
    });
  }
};
