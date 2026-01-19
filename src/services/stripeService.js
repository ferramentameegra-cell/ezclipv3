/**
 * SERVIÇO STRIPE
 * Gerencia integração com Stripe para processamento de pagamentos
 */

import Stripe from 'stripe';

// Chaves do Stripe (OBRIGATÓRIAS via variáveis de ambiente)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('[STRIPE] ⚠️ STRIPE_SECRET_KEY não configurada! Configure a variável de ambiente.');
}

if (!STRIPE_PUBLISHABLE_KEY) {
  console.error('[STRIPE] ⚠️ STRIPE_PUBLISHABLE_KEY não configurada! Configure a variável de ambiente.');
}

// Inicializar Stripe
let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2024-11-20.acacia', // Última versão estável
  });
} else {
  console.warn('[STRIPE] Stripe não inicializado - STRIPE_SECRET_KEY não configurada');
}
export { stripe };

// Exportar chave pública para frontend
export const getPublishableKey = () => STRIPE_PUBLISHABLE_KEY;

/**
 * Criar sessão de checkout do Stripe
 */
export async function createCheckoutSession({ planId, planName, price, videosLimit, userId, userEmail }) {
  if (!stripe) {
    throw new Error('Stripe não está configurado. Configure STRIPE_SECRET_KEY.');
  }
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `Plano ${planName} - EZ Clips AI`,
              description: videosLimit === null 
                ? 'Vídeos ilimitados com cortes ilimitados por vídeo'
                : `${videosLimit} vídeo(s) com cortes ilimitados por vídeo`,
            },
            unit_amount: Math.round(price * 100), // Stripe usa centavos
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:8080'}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:8080'}/?payment=cancelled`,
      client_reference_id: userId,
      customer_email: userEmail,
      metadata: {
        planId,
        planName,
        videosLimit: videosLimit === null ? 'unlimited' : videosLimit.toString(),
        userId,
      },
    });

    return session;
  } catch (error) {
    console.error('[STRIPE] Erro ao criar checkout session:', error);
    throw error;
  }
}

/**
 * Verificar status de uma sessão de checkout
 */
export async function getCheckoutSession(sessionId) {
  if (!stripe) {
    throw new Error('Stripe não está configurado. Configure STRIPE_SECRET_KEY.');
  }
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('[STRIPE] Erro ao recuperar checkout session:', error);
    throw error;
  }
}

/**
 * Processar webhook do Stripe
 */
export function constructWebhookEvent(payload, signature, secret) {
  if (!stripe) {
    throw new Error('Stripe não está configurado. Configure STRIPE_SECRET_KEY.');
  }
  
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('[STRIPE] Erro ao verificar webhook:', error);
    throw error;
  }
}

export default {
  stripe,
  getPublishableKey,
  createCheckoutSession,
  getCheckoutSession,
  constructWebhookEvent,
};
