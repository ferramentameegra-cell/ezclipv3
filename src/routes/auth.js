import express from 'express';
import { register, login, logout, getMe, resendConfirmationEmail, forgotPassword } from '../controllers/authController.js';
import { optionalSupabaseAuth } from '../middleware/supabaseAuth.js';

const router = express.Router();

// Rotas públicas
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/resend-confirmation', resendConfirmationEmail);
router.post('/forgot-password', forgotPassword);

// Rotas protegidas (autenticação opcional - não bloqueia)
router.get('/me', optionalSupabaseAuth, getMe);

export default router;



