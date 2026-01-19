import express from 'express';
import { register, login, forgotPassword, getMe } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Rotas públicas
router.post('/register', register);
router.post('/login', loginLimiter, login); // Rate limiting agressivo para login
router.post('/forgot-password', forgotPassword);

// Rotas protegidas
router.get('/me', requireAuth, getMe);

export default router;



