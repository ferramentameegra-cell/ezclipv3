import express from 'express';
import { downloadWithProgress } from '../controllers/downloadProgressController.js';

const router = express.Router();

/**
 * Download do YouTube com progresso (SSE)
 * GET /api/download/progress?url=
 */
router.get('/download/progress', downloadWithProgress);

export default router;
