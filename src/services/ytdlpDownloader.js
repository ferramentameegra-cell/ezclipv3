import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadYouTubeVideo as downloadWithYtdlCore } from './youtubeDownloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sanitizar URL do YouTube
 * Remove parâmetros de playlist, radio, e outros que podem causar problemas
 */
export function sanitizeYouTubeUrl(url) {
  try {
    const urlObj = new URL(url.trim());
    
    // Remover parâmetros problemáticos
    const paramsToRemove = ['list', 'index', 't', 'start_radio', 'feature', 'si'];
    paramsToRemove.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Garantir que apenas o parâmetro 'v' (video ID) permanece
    const videoId = urlObj.searchParams.get('v');
    if (videoId) {
      // Reconstruir URL limpa
      const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`[SANITIZE] URL sanitizada: ${url} -> ${cleanUrl}`);
      return cleanUrl;
    }
    
    // Se for youtu.be, manter como está (já é limpo)
    if (urlObj.hostname === 'youtu.be') {
      return url.trim();
    }
    
    return url.trim();
  } catch (error) {
    console.warn(`[SANITIZE] Erro ao sanitizar URL, usando original: ${error.message}`);
    return url.trim();
  }
}

/**
 * Extrair video ID de URL do YouTube
 */
function extractVideoId(url) {
  try {
    const urlObj = new URL(url.trim());
    
    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com')) {
      return urlObj.searchParams.get('v');
    }
    
    // youtu.be/VIDEO_ID
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    }
    
    // Fallback: regex
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/.*[?&]v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.trim().match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    console.warn(`[EXTRACT] Erro ao extrair video ID: ${error.message}`);
    return null;
  }
}

/**
 * Baixa vídeo do YouTube usando ytdl-core (compatível com containers)
 * ytdl-core é uma biblioteca Node.js pura, não requer binários do sistema
 * @param {string} videoUrl - URL completa do vídeo do YouTube
 * @param {string} outputPath - Caminho onde salvar o vídeo
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadWithYtDlp(videoUrl, outputPath) {
  try {
    // Sanitizar URL antes de baixar
    const sanitizedUrl = sanitizeYouTubeUrl(videoUrl);
    
    // Extrair video ID
    const videoId = extractVideoId(sanitizedUrl);
    if (!videoId) {
      throw new Error('Não foi possível extrair ID do vídeo da URL');
    }
    
    // Garantir que o diretório existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remover arquivo existente se houver
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log(`[YT-DLP] Iniciando download: ${sanitizedUrl} (ID: ${videoId}) -> ${outputPath}`);

    // Usar ytdl-core (biblioteca Node.js pura, compatível com containers)
    // downloadWithYtdlCore já faz o download completo
    await downloadWithYtdlCore(videoId, outputPath);

    // Validar que o arquivo foi criado
    if (!fs.existsSync(outputPath)) {
      throw new Error('Arquivo não foi criado após download');
    }

    const stats = fs.statSync(outputPath);
    if (stats.size === 0) {
      fs.unlinkSync(outputPath);
      throw new Error('Arquivo baixado está vazio');
    }

    console.log(`[YT-DLP] Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return outputPath;
  } catch (error) {
    console.error('[YT-DLP] Erro no download:', {
      message: error.message,
      stack: error.stack,
      url: videoUrl,
      outputPath: outputPath
    });
    
    // Limpar arquivo corrompido se existir
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch (unlinkError) {
        console.error('[YT-DLP] Erro ao remover arquivo corrompido:', unlinkError);
      }
    }

    throw new Error(`Erro ao baixar vídeo: ${error.message}`);
  }
}

/**
 * Verifica se yt-dlp está disponível
 * Como estamos usando ytdl-core (Node.js puro), sempre retorna true
 * @returns {Promise<boolean>}
 */
export async function isYtDlpAvailable() {
  // ytdl-core está sempre disponível (é uma dependência npm)
  return true;
}
