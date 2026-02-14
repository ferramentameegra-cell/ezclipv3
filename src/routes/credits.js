import express from 'express';
import { getBalance, addCreditsToUser, getPlans, createCheckout } from '../controllers/creditsController.js';
import { optionalSupabaseAuth, requireSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Listar planos disponíveis (rota pública - não requer autenticação)
router.get('/plans', getPlans);

// Obter saldo de créditos (autenticação opcional - não bloqueia)
router.get('/balance', optionalSupabaseAuth, getBalance);

// Criar checkout: free = ativa direto (1 vídeo), pagos = sessão Stripe
router.post('/create-checkout', requireSupabaseAuth, createCheckout);

// Adicionar créditos (protegido - usado por webhooks)
router.post('/add', addCreditsToUser);

export default router;
