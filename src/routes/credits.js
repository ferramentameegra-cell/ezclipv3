import express from 'express';
import { getBalance, addCreditsToUser } from '../controllers/creditsController.js';
import { optionalSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Obter saldo de créditos (autenticação opcional - não bloqueia)
router.get('/balance', optionalSupabaseAuth, getBalance);

// Adicionar créditos (protegido - usado por webhooks)
router.post('/add', addCreditsToUser);

export default router;
