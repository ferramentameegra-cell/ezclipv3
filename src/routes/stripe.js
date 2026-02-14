/**
 * ROTAS STRIPE
 * Checkout, webhooks e verificação de pagamentos
 */

import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController.js';
import { verifySession, validatePaymentLink } from '../controllers/stripeController.js';
import { createCheckoutSession } from '../controllers/checkoutController.js';
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Criar sessão de checkout (subscription) - requer autenticação Supabase
router.post('/create-checkout-session', requireSupabaseAuth, createCheckoutSession);

// Webhook do Stripe (não requer autenticação, usa assinatura)
// IMPORTANTE: Esta rota precisa do body raw, não JSON
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Verificar status de sessão
router.get('/verify-session', requireSupabaseAuth, verifySession);

// Validar compra via Payment Link
router.post('/validate-payment-link', requireSupabaseAuth, validatePaymentLink);

export default router;
