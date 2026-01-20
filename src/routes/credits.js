import express from 'express';
import { getBalance, addCreditsToUser } from '../controllers/creditsController.js';
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Obter saldo de créditos (requer autenticação)
router.get('/balance', requireSupabaseAuth, getBalance);

// Adicionar créditos (protegido - usado por webhooks)
router.post('/add', addCreditsToUser);

export default router;
