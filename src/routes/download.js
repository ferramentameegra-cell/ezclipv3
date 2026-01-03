import express from 'express';
import { downloadWithProgress } from '../controllers/downloadProgressController.js';
import { getVideoState, VIDEO_STATES } from '../services/videoStateManager.js';

const router = express.Router();

/**
 * Download do YouTube com progresso (SSE)
 * GET /api/download/progress?url=
 */
router.get('/download/progress', downloadWithProgress);

// Verificar estado do vídeo
router.get('/state/:videoId', (req, res) => {
  try {
    const { videoId } = req.params;
    const state = getVideoState(videoId);
    
    if (!state) {
      return res.status(404).json({
        success: false,
        error: 'Estado do vídeo não encontrado',
        state: VIDEO_STATES.IDLE
      });
    }
    
    res.json({
      success: true,
      videoId: state.id,
      state: state.state,
      progress: state.progress,
      error: state.error,
      ready: state.state === VIDEO_STATES.READY,
      metadata: state.metadata
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
