/**
 * ROBUST DOWNLOADER - Sistema de Download à Prova de Falhas
 * 
 * Implementa:
 * - Múltiplas estratégias de download (Android, iOS, Web, TV)
 * - Retry automático com backoff exponencial
 * - Barra de progresso em tempo real
 * - Tratamento robusto de erros 403
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { STORAGE_CONFIG } from '../config/storage.config.js';

// Estratégias de download em ordem de prioridade
const DOWNLOAD_STRATEGIES = [
  {
    name: 'Android',
    extractorArgs: 'youtube:player_client=android',
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    format: 'bestvideo[height<=1080]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[height<=1080]/best'
  },
  {
    name: 'iOS',
    extractorArgs: 'youtube:player_client=ios',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
    format: 'bestvideo[height<=720]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[height<=720]/best'
  },
  {
    name: 'Web',
    extractorArgs: 'youtube:player_client=web',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    format: 'best[height<=720]/bestvideo+bestaudio/best'
  },
  {
    name: 'TV',
    extractorArgs: 'youtube:player_client=tv_embedded',
    userAgent: 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version',
    format: 'best[height<=480]/bestvideo+bestaudio/best'
  }
];

// Número máximo de tentativas por estratégia
const MAX_RETRIES = 5;

// Timeout para download (5 minutos)
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000;

/**
 * Criar arquivo de cookies temporário se disponível
 */
function createCookiesFile() {
  const cookiesContent = process.env.YTDLP_COOKIES;
  if (!cookiesContent || cookiesContent.trim() === '') {
    return null;
  }

  try {
    const tempDir = process.env.NODE_ENV === 'production' 
      ? '/tmp/ytdlp-cookies'
      : path.join(process.cwd(), 'tmp', 'ytdlp-cookies');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const cookiesPath = path.join(tempDir, `ytdlp_cookies_${Date.now()}.txt`);
    fs.writeFileSync(cookiesPath, cookiesContent, 'utf8');
    
    console.log('[ROBUST-DOWNLOADER] Arquivo de cookies criado:', cookiesPath);
    return cookiesPath;
  } catch (error) {
    console.error('[ROBUST-DOWNLOADER] Erro ao criar arquivo de cookies:', error.message);
    return null;
  }
}

/**
 * Tentar download com uma estratégia específica
 */
async function tryDownloadStrategy(youtubeVideoId, videoId, strategy, onProgress) {
  return new Promise((resolve, reject) => {
    const outputPath = STORAGE_CONFIG.getVideoPath(videoId);
    const outputTemplate = outputPath.replace('.mp4', '.%(ext)s');
    
    // Criar diretório se não existir
    const uploadsDir = STORAGE_CONFIG.UPLOADS_DIR;
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Criar arquivo de cookies se disponível
    const cookiesPath = createCookiesFile();
    
    // User-Agent da estratégia ou da variável de ambiente
    const userAgent = process.env.YTDLP_USER_AGENT || strategy.userAgent;
    
    // Construir argumentos do yt-dlp
    const ytdlpArgs = [
      '--no-warnings',
      '--no-playlist',
      '--newline', // Para capturar progresso linha por linha
      '--format', strategy.format,
      '--merge-output-format', 'mp4',
      '--user-agent', userAgent,
      '--referer', 'https://www.youtube.com/',
      '--extractor-args', strategy.extractorArgs,
      '--no-check-certificate',
      '--retries', '3',
      '--fragment-retries', '3',
      '--file-access-retries', '3',
      '--sleep-requests', '1',
      '-4', // Forçar IPv4
      '-o', outputTemplate,
      `https://www.youtube.com/watch?v=${youtubeVideoId}`
    ];
    
    // Adicionar cookies se disponível
    if (cookiesPath) {
      ytdlpArgs.push('--cookies', cookiesPath);
    }
    
    console.log(`[ROBUST-DOWNLOADER] Tentando estratégia "${strategy.name}"...`);
    console.log(`[ROBUST-DOWNLOADER] Output: ${outputPath}`);
    
    const ytdlp = spawn('yt-dlp', ytdlpArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let lastProgress = 0;
    let stderr = '';
    let stdout = '';
    let hasResolved = false;
    
    // Timeout para evitar travamento
    const timeout = setTimeout(() => {
      if (!hasResolved) {
        hasResolved = true;
        ytdlp.kill('SIGKILL');
        reject(new Error(`Timeout após ${DOWNLOAD_TIMEOUT / 1000}s`));
      }
    }, DOWNLOAD_TIMEOUT);
    
    // Capturar stderr (yt-dlp envia progresso aqui)
    ytdlp.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      
      // Procurar progresso no formato [download] XX.X%
      const progressMatch = text.match(/\[download\]\s+(\d{1,3}\.\d+)%/i);
      if (progressMatch) {
        const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
        if (percent > lastProgress) {
          lastProgress = percent;
          onProgress({
            status: 'downloading',
            progress: percent,
            message: `Baixando com ${strategy.name}... ${percent.toFixed(1)}%`
          });
        }
      }
    });
    
    // Capturar stdout também
    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Processo finalizado
    ytdlp.on('close', (code) => {
      clearTimeout(timeout);
      
      // Limpar arquivo de cookies temporário
      if (cookiesPath && fs.existsSync(cookiesPath)) {
        try {
          fs.unlinkSync(cookiesPath);
        } catch (e) {
          // Ignorar erro ao remover cookies
        }
      }
      
      if (hasResolved) return;
      hasResolved = true;
      
      if (code === 0) {
        // Procurar arquivo baixado com qualquer extensão
        const possibleExtensions = ['mp4', 'webm', 'mkv', 'm4a'];
        let downloadedFile = null;
        
        for (const ext of possibleExtensions) {
          const testPath = outputPath.replace('.mp4', `.${ext}`);
          if (fs.existsSync(testPath)) {
            const stats = fs.statSync(testPath);
            if (stats.size > 0) {
              downloadedFile = testPath;
              
              // Se não for .mp4, renomear para .mp4
              if (ext !== 'mp4') {
                try {
                  fs.renameSync(testPath, outputPath);
                  downloadedFile = outputPath;
                  console.log(`[ROBUST-DOWNLOADER] Arquivo renomeado para .mp4: ${outputPath}`);
                } catch (renameError) {
                  console.warn(`[ROBUST-DOWNLOADER] Erro ao renomear arquivo: ${renameError.message}`);
                }
              }
              break;
            }
          }
        }
        
        // Se não encontrou, tentar outputPath original
        if (!downloadedFile && fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          if (stats.size > 0) {
            downloadedFile = outputPath;
          }
        }
        
        if (downloadedFile) {
          onProgress({
            status: 'completed',
            progress: 100,
            message: 'Download concluído com sucesso!'
          });
          console.log(`[ROBUST-DOWNLOADER] ✅ Download concluído: ${downloadedFile} (${(fs.statSync(downloadedFile).size / 1024 / 1024).toFixed(2)} MB)`);
          resolve(downloadedFile);
        } else {
          reject(new Error('Arquivo baixado não encontrado ou está vazio'));
        }
      } else {
        const errorMsg = `Estratégia ${strategy.name} falhou com código ${code}`;
        console.error(`[ROBUST-DOWNLOADER] ❌ ${errorMsg}`);
        console.error(`[ROBUST-DOWNLOADER] stderr: ${stderr.slice(-500)}`);
        reject(new Error(errorMsg));
      }
    });
    
    ytdlp.on('error', (error) => {
      clearTimeout(timeout);
      if (!hasResolved) {
        hasResolved = true;
        reject(new Error(`Erro ao executar yt-dlp: ${error.message}`));
      }
    });
  });
}

/**
 * Download com retry automático e múltiplas estratégias
 * 
 * @param {string} youtubeVideoId - ID do vídeo do YouTube
 * @param {string} videoId - ID interno do vídeo (para nomear arquivo)
 * @param {Function} onProgress - Callback de progresso: ({ status, progress, message }) => void
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadWithRetries(youtubeVideoId, videoId, onProgress) {
  onProgress({
    status: 'starting',
    progress: 0,
    message: 'Iniciando download...'
  });
  
  console.log(`[ROBUST-DOWNLOADER] ========================================`);
  console.log(`[ROBUST-DOWNLOADER] Iniciando download robusto`);
  console.log(`[ROBUST-DOWNLOADER] YouTube Video ID: ${youtubeVideoId}`);
  console.log(`[ROBUST-DOWNLOADER] Video ID: ${videoId}`);
  console.log(`[ROBUST-DOWNLOADER] Estratégias disponíveis: ${DOWNLOAD_STRATEGIES.length}`);
  console.log(`[ROBUST-DOWNLOADER] Máximo de tentativas por estratégia: ${MAX_RETRIES}`);
  console.log(`[ROBUST-DOWNLOADER] ========================================`);
  
  // Tentar cada estratégia em sequência
  for (const strategy of DOWNLOAD_STRATEGIES) {
    // Tentar cada estratégia até MAX_RETRIES vezes
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[ROBUST-DOWNLOADER] Tentando estratégia "${strategy.name}", tentativa ${attempt}/${MAX_RETRIES}...`);
        onProgress({
          status: 'downloading',
          progress: 0,
          message: `Tentando estratégia ${strategy.name} (tentativa ${attempt}/${MAX_RETRIES})...`
        });
        
        const resultPath = await tryDownloadStrategy(youtubeVideoId, videoId, strategy, onProgress);
        
        console.log(`[ROBUST-DOWNLOADER] ✅ Sucesso com estratégia "${strategy.name}" na tentativa ${attempt}`);
        return resultPath;
        
      } catch (error) {
        console.error(`[ROBUST-DOWNLOADER] ⚠️ Falha na tentativa ${attempt} com ${strategy.name}: ${error.message}`);
        
        // Se foi a última tentativa desta estratégia, tentar próxima estratégia
        if (attempt === MAX_RETRIES) {
          console.error(`[ROBUST-DOWNLOADER] ❌ Estratégia "${strategy.name}" falhou após ${MAX_RETRIES} tentativas.`);
          // Continuar para próxima estratégia
          break;
        } else {
          // Backoff exponencial: 2^attempt segundos
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`[ROBUST-DOWNLOADER] Aguardando ${delay / 1000}s para próxima tentativa...`);
          onProgress({
            status: 'retrying',
            progress: 0,
            message: `Aguardando ${delay / 1000}s antes de tentar novamente...`
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }
  
  // Todas as estratégias falharam
  const errorMsg = 'Falha no download do vídeo após todas as tentativas e estratégias.';
  console.error(`[ROBUST-DOWNLOADER] ❌ ${errorMsg}`);
  onProgress({
    status: 'failed',
    progress: 0,
    message: errorMsg
  });
  
  throw new Error(errorMsg);
}
