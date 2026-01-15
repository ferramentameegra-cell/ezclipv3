import express from 'express';
import { acceptTerms } from '../controllers/termsController.js';

const router = express.Router();

// Registrar aceite dos Termos de Uso
router.post('/accept', acceptTerms);

export default router;
