import express from 'express';
import { getRetentionVideos, getRetentionVideoByNiche } from '../controllers/retentionController.js';

const router = express.Router();

// Listar todos os vídeos de retenção
router.get('/', getRetentionVideos);

// Obter vídeos de retenção por nicho
router.get('/niche/:nicheId', getRetentionVideoByNiche);

export default router;

