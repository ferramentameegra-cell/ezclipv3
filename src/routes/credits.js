import express from 'express';
import { getPlans, getBalance, purchasePlan, getUsageHistory, createCheckout } from '../controllers/creditsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Listar planos (PÚBLICO - não requer autenticação)
router.get('/plans', getPlans);

// Rotas protegidas
router.get('/balance', requireAuth, getBalance);
router.post('/create-checkout', requireAuth, createCheckout); // Criar sessão de checkout Stripe
router.post('/purchase', requireAuth, purchasePlan); // Processar compra (após pagamento confirmado)
router.get('/usage', requireAuth, getUsageHistory);

export default router;
