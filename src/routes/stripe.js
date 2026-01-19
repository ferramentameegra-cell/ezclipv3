/**
 * ROTAS STRIPE
 * Gerencia webhooks e verificação de pagamentos
 */

import express from 'express';
import { handleStripeWebhook, verifySession, validatePaymentLink } from '../controllers/stripeController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Webhook do Stripe (não requer autenticação, usa assinatura)
// IMPORTANTE: Esta rota precisa do body raw, não JSON
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Verificar status de sessão (requer autenticação)
router.get('/verify-session', requireAuth, verifySession);

// Validar compra via Payment Link (requer autenticação)
router.post('/validate-payment-link', requireAuth, validatePaymentLink);

export default router;
