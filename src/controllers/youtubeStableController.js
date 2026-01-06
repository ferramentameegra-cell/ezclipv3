/**
 * CONTROLLER YOUTUBE ESTÁVEL
 * Implementa info, acknowledge e download usando yt-dlp CLI
 */

import { getYouTubeVideoInfo, downloadYouTubeVideo } from '../services/youtubeServiceStable.js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Store de consent em memória (temporário)
const userConsent = new Map();

// Store de vídeos em memória
const videoStore = new Map();

/**
 * GET /api/youtube/info
 * Retorna metadata do vídeo usando yt-dlp
 */
export const getYouTubeInfo = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL do YouTube não fornecida'
      });
    }

    const metadata = await getYouTubeVideoInfo(url);
    
    return res.json({
      success: true,
      ...metadata
    });

  } catch (error) {
    console.error('[YOUTUBE-INFO] Erro:', error.message);

    if (error.message.includes('inválida') || error.message.includes('invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/youtube/acknowledge
 * Registra consentimento do usuário
 */
export const acknowledgeConsent = async (req, res) => {
  try {
    const { url, userHasRights } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL não fornecida'
      });
    }

    if (typeof userHasRights !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'userHasRights deve ser boolean'
      });
    }

    if (!userHasRights) {
      return res.status(403).json({
        success: false,
        error: 'Download não permitido sem consentimento de direitos'
      });
    }

    // Extrair video ID para usar como chave
    const urlPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    let videoId = null;
    for (const pattern of urlPatterns) {
      const match = url.trim().match(pattern);
      if (match && match[1]) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }

    // Armazenar consentimento
    userConsent.set(videoId, {
      url,
      userHasRights: true,
      acknowledgedAt: new Date()
    });

    console.log(`[ACKNOWLEDGE] Consentimento registrado para: ${videoId}`);

    return res.json({
      success: true,
      message: 'Consentimento registrado',
      videoId
    });

  } catch (error) {
    console.error('[ACKNOWLEDGE] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * POST /api/youtube/download
 * Download síncrono do vídeo usando yt-dlp
 */
export const downloadVideo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL não fornecida'
      });
    }

    // Extrair video ID
    const urlPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    let videoId = null;
    for (const pattern of urlPatterns) {
      const match = url.trim().match(pattern);
      if (match && match[1]) {
        videoId = match[1];
        break;
      }
    }

    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'URL inválida'
      });
    }

    // Verificar consentimento
    const consent = userConsent.get(videoId);
    if (!consent || !consent.userHasRights) {
      return res.status(403).json({
        success: false,
        error: 'Consentimento não registrado. Use /api/youtube/acknowledge primeiro'
      });
    }

    // Criar diretório de uploads
    const uploadsDir = '/tmp/uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Gerar ID único para o arquivo
    const storedVideoId = uuidv4();
    const outputPath = path.join(uploadsDir, `${storedVideoId}.mp4`);

    console.log(`[DOWNLOAD] Iniciando download: ${url} -> ${outputPath}`);

    // Download síncrono
    await downloadYouTubeVideo(url, outputPath);

    // Validar arquivo
    if (!fs.existsSync(outputPath)) {
      throw new Error('Arquivo não foi criado');
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      throw new Error('Arquivo está vazio');
    }

    // Obter duração com ffprobe
    let duration = 0;
    try {
      const ffmpeg = (await import('fluent-ffmpeg')).default;
      await new Promise((resolve) => {
        ffmpeg.ffprobe(outputPath, (err, metadata) => {
          if (!err && metadata?.format?.duration) {
            duration = Math.floor(metadata.format.duration);
          }
          resolve();
        });
      });
    } catch (probeError) {
      console.warn(`[DOWNLOAD] Erro ao obter duração: ${probeError.message}`);
    }

    // Armazenar informações do vídeo
    const videoInfo = {
      id: storedVideoId,
      youtubeUrl: url,
      youtubeVideoId: videoId,
      path: outputPath,
      duration: duration,
      fileSize: stats.size,
      downloadedAt: new Date()
    };

    videoStore.set(storedVideoId, videoInfo);

    console.log(`[DOWNLOAD] Download concluído: ${storedVideoId} (${(stats.size / 1024 / 1024).toFixed(2)} MB, ${duration}s)`);

    return res.json({
      success: true,
      videoId: storedVideoId,
      path: outputPath,
      duration: duration,
      fileSize: stats.size,
      playableUrl: `/api/youtube/play/${storedVideoId}`
    });

  } catch (error) {
    console.error('[DOWNLOAD] Erro:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET /api/youtube/play/:videoId
 * Servir vídeo baixado
 */
export const playVideo = (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video || !fs.existsSync(video.path)) {
      return res.status(404).json({
        error: 'Vídeo não encontrado'
      });
    }

    const stat = fs.statSync(video.path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4'
      });

      fs.createReadStream(video.path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(video.path).pipe(res);
    }
  } catch (error) {
    console.error('[PLAY] Erro:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/youtube/duration/:videoId
 * Retorna duração do vídeo (para trim)
 */
export const getVideoDuration = async (req, res) => {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video || !fs.existsSync(video.path)) {
      return res.status(404).json({
        error: 'Vídeo não encontrado'
      });
    }

    let duration = video.duration || 0;

    // Se não tem duração, obter com ffprobe
    if (duration === 0) {
      try {
        const ffmpeg = (await import('fluent-ffmpeg')).default;
        await new Promise((resolve) => {
          ffmpeg.ffprobe(video.path, (err, metadata) => {
            if (!err && metadata?.format?.duration) {
              duration = Math.floor(metadata.format.duration);
              // Atualizar store
              video.duration = duration;
              videoStore.set(videoId, video);
            }
            resolve();
          });
        });
      } catch (probeError) {
        console.error(`[DURATION] Erro: ${probeError.message}`);
      }
    }

    // Calcular clips possíveis
    const clips60s = Math.floor(duration / 60);
    const clips120s = Math.floor(duration / 120);

    return res.json({
      success: true,
      duration: duration,
      clips60s: clips60s,
      clips120s: clips120s
    });

  } catch (error) {
    console.error('[DURATION] Erro:', error);
    return res.status(500).json({
      error: error.message
    });
  }
};

