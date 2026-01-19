import express from 'express';
import { getPlans, getBalance, purchasePlan, getUsageHistory } from '../controllers/creditsController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Listar planos (PÚBLICO - não requer autenticação)
router.get('/plans', getPlans);

// Rotas protegidas
router.get('/balance', requireAuth, getBalance);
router.post('/purchase', requireAuth, purchasePlan);
router.get('/usage', requireAuth, getUsageHistory);

export default router;
