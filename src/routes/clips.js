import express from 'express';
import { generateClips } from '../controllers/clipsController.js';

const router = express.Router();

// Gerar clips
router.post('/generate-clips', generateClips);

export default router;

