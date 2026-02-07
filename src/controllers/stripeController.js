/**
 * CONTROLLER STRIPE
 * Gerencia webhooks e confirmação de pagamentos
 */

import { stripe, constructWebhookEvent, getCheckoutSession } from '../services/stripeService.js';
import { getPlanById } from '../models/plans.js';
import { getUserById, updateUser } from '../models/users.js';
import { getUserVideoStats } from '../services/videoService.js';

/**
 * POST /webhook/stripe (ou /api/stripe/webhook)
 * Webhook do Stripe para processar eventos de pagamento (Payment Links).
 * Mínimo: valida assinatura, extrai dados, loga, retorna 200.
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
    // req.body vem como Buffer do middleware express.raw
    event = constructWebhookEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[STRIPE] Erro ao verificar assinatura do webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[STRIPE] Webhook recebido: ${event.type}`);

  try {
    if (event.type === 'checkout.session.completed') {
      handleCheckoutCompleted(event.data.object);
    } else {
      console.log(`[STRIPE] Evento não tratado: ${event.type}`);
    }
    return res.status(200).send();
  } catch (error) {
    console.error('[STRIPE] Erro ao processar webhook:', error);
    return res.status(500).send('Erro ao processar webhook');
  }
};

/**
 * Processar checkout completado (Payment Link).
 * Extrai dados e loga. Sem lógica de créditos/planos.
 */
function handleCheckoutCompleted(session) {
  const customerEmail = session.customer_email || session.customer_details?.email || '-';
  const sessionId = session.id;
  const amountTotal = session.amount_total ?? 0;
  const currency = (session.currency || 'brl').toUpperCase();

  console.log('[STRIPE] Pagamento confirmado:', {
    customer_email: customerEmail,
    session_id: sessionId,
    amount_total: amountTotal,
    currency,
  });
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
