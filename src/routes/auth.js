import express from 'express';
import { register, login, logout, getMe, resendConfirmationEmail } from '../controllers/authController.js';
import { requireSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Rotas públicas
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/resend-confirmation', resendConfirmationEmail);

// Rotas protegidas (requerem autenticação Supabase)
router.get('/me', requireSupabaseAuth, getMe);

export default router;



