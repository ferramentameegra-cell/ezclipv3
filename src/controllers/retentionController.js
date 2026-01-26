import fs from 'fs';
import { RETENTION_VIDEOS, NICHES } from '../models/niches.js';
import { getAvailableRetentionVideos, getRetentionVideoPath, retentionVideoExists, saveRetentionVideo, getNicheRetentionVideo, getNicheRetentionYoutubeUrl } from '../services/retentionVideoManager.js';

export const getRetentionVideos = (req, res) => {
  try {
    // Retornar vídeos com informação de disponibilidade
    const videos = getAvailableRetentionVideos();
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRetentionVideoByNiche = async (req, res) => {
  try {
    const { nicheId } = req.params;
    const niche = NICHES[nicheId];
    
    if (!niche) {
      return res.status(404).json({ error: 'Nicho não encontrado' });
    }
    
    // NOVO SISTEMA: Retornar vídeo de retenção do YouTube do nicho
    const retentionYoutubeUrl = niche.retentionYoutubeUrl;
    const retentionVideoPath = await getNicheRetentionVideo(nicheId);
    
    // Retornar também vídeos antigos (fallback)
    const allVideos = getAvailableRetentionVideos();
    const nicheVideos = niche.retentionVideos
      ? niche.retentionVideos
          .map(videoId => allVideos.find(v => v.id === videoId))
          .filter(v => v !== undefined)
      : [];
    
    res.json({ 
      niche: {
        id: niche.id,
        name: niche.name,
        description: niche.description
      },
      retentionYoutubeUrl: retentionYoutubeUrl || null,
      retentionVideoPath: retentionVideoPath || null,
      retentionVideoDownloaded: retentionVideoPath !== null && fs.existsSync(retentionVideoPath),
      // Vídeos antigos (fallback)
      legacyVideos: nicheVideos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obter caminho de um vídeo de retenção específico
 */
export const getRetentionVideoFile = (req, res) => {
  try {
    const { retentionVideoId } = req.params;
    
    if (!retentionVideoId) {
      return res.status(400).json({ error: 'ID do vídeo de retenção não fornecido' });
    }

    if (!retentionVideoExists(retentionVideoId)) {
      return res.status(404).json({ 
        error: 'Vídeo de retenção não encontrado',
        hint: `Adicione o arquivo ${retentionVideoId}.mp4 em retention-library/ ou faça upload via POST /api/retention/upload`
      });
    }

    const videoPath = getRetentionVideoPath(retentionVideoId);
    const videoMeta = RETENTION_VIDEOS[retentionVideoId];

    res.json({
      id: retentionVideoId,
      path: videoPath,
      ...videoMeta,
      exists: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Upload de vídeo de retenção
 * 
 * Body (form-data):
 * - video: arquivo de vídeo
 * - retentionVideoId: ID do vídeo (deve existir em RETENTION_VIDEOS)
 */
export const uploadRetentionVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const retentionVideoId = req.body.retentionVideoId;

    if (!retentionVideoId) {
      // Limpar arquivo temporário
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: 'ID do vídeo de retenção não fornecido',
        hint: 'Envie retentionVideoId no body (ex: hydraulic-press)'
      });
    }

    // Verificar se o ID existe no modelo
    if (!RETENTION_VIDEOS[retentionVideoId]) {
      // Limpar arquivo temporário
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: `Vídeo de retenção não encontrado no modelo: ${retentionVideoId}`,
        hint: 'Adicione o vídeo primeiro em src/models/niches.js (RETENTION_VIDEOS)'
      });
    }

    // Salvar vídeo
    const finalPath = await saveRetentionVideo(retentionVideoId, req.file.path);

    // Limpar arquivo temporário
    if (req.file.path !== finalPath && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const videoMeta = RETENTION_VIDEOS[retentionVideoId];

    res.json({
      success: true,
      message: `Vídeo de retenção '${retentionVideoId}' adicionado com sucesso`,
      video: {
        id: retentionVideoId,
        path: finalPath,
        ...videoMeta,
        exists: true
      }
    });
  } catch (error) {
    console.error('[RETENTION-UPLOAD] Erro:', error);
    
    // Limpar arquivo temporário em caso de erro
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('[RETENTION-UPLOAD] Erro ao limpar arquivo:', unlinkError);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
};



