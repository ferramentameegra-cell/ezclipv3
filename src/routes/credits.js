import express from 'express';
import { getBalance, addCreditsToUser, getPlans } from '../controllers/creditsController.js';
import { optionalSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Listar planos disponíveis (rota pública - não requer autenticação)
router.get('/plans', getPlans);

// Obter saldo de créditos (autenticação opcional - não bloqueia)
router.get('/balance', optionalSupabaseAuth, getBalance);

// Adicionar créditos (protegido - usado por webhooks)
router.post('/add', addCreditsToUser);

export default router;
