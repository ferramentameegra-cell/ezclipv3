import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instância global do yt-dlp-wrap
let ytDlpWrapInstance = null;

/**
 * Inicializar yt-dlp-wrap (baixa binário automaticamente se necessário)
 */
function getYtDlpWrap() {
  if (!ytDlpWrapInstance) {
    try {
      ytDlpWrapInstance = new YTDlpWrap();
      console.log('[YT-DLP-WRAP] Instância criada');
    } catch (error) {
      console.error('[YT-DLP-WRAP] Erro ao criar instância:', error);
      throw new Error(`Falha ao inicializar yt-dlp-wrap: ${error.message}`);
    }
  }
  return ytDlpWrapInstance;
}

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
 * Baixa vídeo do YouTube usando yt-dlp-wrap (compatível com containers)
 * @param {string} videoUrl - URL completa do vídeo do YouTube
 * @param {string} outputPath - Caminho onde salvar o vídeo
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadWithYtDlp(videoUrl, outputPath) {
  let finalOutputPath = outputPath;
  
  try {
    // Sanitizar URL antes de baixar
    const sanitizedUrl = sanitizeYouTubeUrl(videoUrl);
    
    // Garantir que o diretório existe
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remover arquivo existente se houver
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    console.log(`[YT-DLP-WRAP] Iniciando download: ${sanitizedUrl} -> ${outputPath}`);

    // Obter instância do yt-dlp-wrap
    const ytDlp = getYtDlpWrap();

    // Configurar opções de download
    const downloadOptions = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      '--no-progress',
      '-o', outputPath
    ];

    // Executar download
    console.log(`[YT-DLP-WRAP] Executando download com opções: ${downloadOptions.join(' ')}`);
    
    await ytDlp.execPromise([sanitizedUrl, ...downloadOptions]);

    // Validar que o arquivo foi criado
    if (!fs.existsSync(outputPath)) {
      // yt-dlp pode adicionar extensão automaticamente
      const possiblePaths = [
        outputPath,
        outputPath.replace('.mp4', ''),
        outputPath + '.mp4',
        path.join(path.dirname(outputPath), path.basename(outputPath, path.extname(outputPath)) + '.mp4')
      ];
      
      let found = false;
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          finalOutputPath = possiblePath;
          found = true;
          console.log(`[YT-DLP-WRAP] Arquivo encontrado em: ${finalOutputPath}`);
          break;
        }
      }
      
      if (!found) {
        throw new Error('Arquivo não foi criado após download');
      }
    }

    const stats = fs.statSync(finalOutputPath);
    if (stats.size === 0) {
      fs.unlinkSync(finalOutputPath);
      throw new Error('Arquivo baixado está vazio');
    }

    console.log(`[YT-DLP-WRAP] Download concluído: ${finalOutputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    return finalOutputPath;
  } catch (error) {
    console.error('[YT-DLP-WRAP] Erro no download:', {
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
        console.error('[YT-DLP-WRAP] Erro ao remover arquivo corrompido:', unlinkError);
      }
    }
    
    // Limpar também o caminho final se diferente
    if (finalOutputPath !== outputPath && fs.existsSync(finalOutputPath)) {
      try {
        fs.unlinkSync(finalOutputPath);
      } catch (unlinkError) {
        console.error('[YT-DLP-WRAP] Erro ao remover arquivo final corrompido:', unlinkError);
      }
    }

    throw new Error(`Erro ao baixar vídeo: ${error.message}`);
  }
}

/**
 * Verifica se yt-dlp-wrap está disponível
 * @returns {Promise<boolean>}
 */
export async function isYtDlpAvailable() {
  try {
    const ytDlp = getYtDlpWrap();
    // Tentar obter versão para verificar se está funcionando
    await ytDlp.execPromise(['--version']);
    return true;
  } catch (error) {
    console.warn('[YT-DLP-WRAP] yt-dlp-wrap não disponível:', error.message);
    return false;
  }
}
