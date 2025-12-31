import express from 'express';
import { applyTrim, calculateClipsCount } from '../controllers/trimController.js';

const router = express.Router();

// Aplicar trim no vídeo
router.post('/apply', applyTrim);

// Calcular quantidade de clips
router.post('/calculate-clips', calculateClipsCount);

export default router;

