import express from 'express';
import { applyTrim, countClips } from '../controllers/trimController.js';

const router = express.Router();

// Aplicar trim
router.post('/', applyTrim);

// Calcular quantidade de clips
router.post('/count-clips', countClips);

export default router;
