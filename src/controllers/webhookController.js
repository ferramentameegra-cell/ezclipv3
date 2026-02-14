/**
 * WEBHOOK CONTROLLER
 * Processa eventos do Stripe e atualiza Supabase
 * Valida assinatura com STRIPE_WEBHOOK_SECRET
 */

import { constructWebhookEvent } from '../services/stripeService.js';
import { updateUserSubscription, getPlanVideosAllowed } from '../services/subscriptionService.js';

/**
 * Mapear status da subscription Stripe para nosso modelo
 */
function mapSubscriptionStatus(stripeStatus) {
  const map = {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    unpaid: 'unpaid',
    trialing: 'active'
  };
  return map[stripeStatus] || stripeStatus;
}

/**
 * Extrair plano e videos_allowed da subscription ou metadata
 */
function extractPlanFromSubscription(subscription) {
  const meta = subscription.metadata || subscription.items?.data?.[0]?.price?.product?.metadata || {};
  const plan = (meta.plan || 'creator').toLowerCase();

  const videosMap = {
    creator: 10,
    pro: 40,
    unlimited: -1
  };
  const videosAllowed = videosMap[plan] ?? 10;

  return { plan, videosAllowed };
}

/**
 * Processar checkout.session.completed
 */
async function handleCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const plan = (session.metadata?.plan || 'creator').toLowerCase();

  if (!userId) {
    console.warn('[WEBHOOK] checkout.session.completed sem userId');
    return;
  }

  const videosAllowed = getPlanVideosAllowed(plan);
  const customerId = session.customer || null;
  const subscriptionId = session.subscription || null;

  await updateUserSubscription({
    userId,
    planName: plan,
    videosAllowed,
    subscriptionStatus: 'active',
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId
  });

  console.log(`[WEBHOOK] ✅ Checkout completado: userId=${userId}, plan=${plan}, videos_allowed=${videosAllowed}`);
}

/**
 * Processar invoice.paid
 */
async function handleInvoicePaid(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const stripe = (await import('../services/stripeService.js')).stripe;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price.product'] });
  const { plan, videosAllowed } = extractPlanFromSubscription(subscription);

  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('[WEBHOOK] invoice.paid sem userId na subscription');
    return;
  }

  await updateUserSubscription({
    userId,
    planName: plan,
    videosAllowed,
    subscriptionStatus: mapSubscriptionStatus(subscription.status),
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id
  });

  console.log(`[WEBHOOK] ✅ Invoice pago: userId=${userId}, plan=${plan}`);
}

/**
 * Processar customer.subscription.updated
 */
async function handleSubscriptionUpdated(subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('[WEBHOOK] customer.subscription.updated sem userId');
    return;
  }

  const { plan, videosAllowed } = extractPlanFromSubscription(subscription);
  const status = mapSubscriptionStatus(subscription.status);

  await updateUserSubscription({
    userId,
    planName: plan,
    videosAllowed,
    subscriptionStatus: status,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id
  });

  console.log(`[WEBHOOK] ✅ Subscription atualizada: userId=${userId}, status=${status}`);
}

/**
 * Processar customer.subscription.deleted
 */
async function handleSubscriptionDeleted(subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('[WEBHOOK] customer.subscription.deleted sem userId');
    return;
  }

  // Voltar para plano Free ao cancelar
  await updateUserSubscription({
    userId,
    planName: 'free',
    videosAllowed: 1,
    subscriptionStatus: 'canceled',
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: null
  });

  console.log(`[WEBHOOK] ✅ Subscription cancelada: userId=${userId} -> plano free`);
}

/**
 * Handler principal do webhook Stripe
 * POST /webhook (body raw)
 */
export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('[WEBHOOK] STRIPE_WEBHOOK_SECRET não configurado');
    return res.status(400).send('Webhook secret não configurado');
  }

  let event;
  try {
    event = constructWebhookEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[WEBHOOK] Erro ao verificar assinatura:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[WEBHOOK] Evento recebido: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`[WEBHOOK] Evento não tratado: ${event.type}`);
    }
    return res.status(200).send();
  } catch (error) {
    console.error('[WEBHOOK] Erro ao processar:', error);
    return res.status(500).send('Erro ao processar webhook');
  }
}
