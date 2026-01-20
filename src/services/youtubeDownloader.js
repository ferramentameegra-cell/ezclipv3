import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Cria arquivo temporário de cookies a partir da variável de ambiente
 * Retorna o caminho do arquivo ou null se não houver cookies
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
    
    // Escrever conteúdo dos cookies
    fs.writeFileSync(cookiesPath, cookiesContent, 'utf8');
    
    console.log('[YT-DLP] Arquivo de cookies criado:', cookiesPath);
    return cookiesPath;
  } catch (error) {
    console.error('[YT-DLP] Erro ao criar arquivo de cookies:', error.message);
    return null;
  }
}

/**
 * Baixa vídeo do YouTube usando yt-dlp (MP4 garantido)
 * Suporta cookies para evitar detecção de bot
 * @param {string} videoId
 * @param {string} outputPath
 * @param {string} strategy - Estratégia de player client ('web' ou 'android_with_cookies')
 */
export function downloadYouTubeVideo(videoId, outputPath, strategy = 'web') {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Criar arquivo de cookies se disponível
    const cookiesPath = createCookiesFile();
    
    // Determinar estratégia de player client
    // android_with_cookies é mais confiável para evitar bloqueios 403
    const playerClient = strategy === 'android_with_cookies' ? 'android_with_cookies' : 'web';
    
    // Construir comando com múltiplas estratégias
    const baseArgs = [
      'yt-dlp',
      '-f "bv*[ext=mp4]+ba[ext=m4a]/mp4"',
      '--merge-output-format mp4',
      '--no-warnings',
      '--no-playlist',
      // User-Agent moderno
      '--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
      // Referer para parecer mais legítimo
      '--referer "https://www.youtube.com/"',
      // Cookies se disponível (OBRIGATÓRIO para android_with_cookies)
      ...(cookiesPath ? [`--cookies "${cookiesPath}"`] : []),
      // Estratégia de player client (android_with_cookies é mais confiável)
      `--extractor-args "youtube:player_client=${playerClient}"`,
      '--geo-bypass',
      '--no-check-certificate',
      `-o "${outputPath}"`,
      `"${url}"`
    ];
    
    const cmd = baseArgs.join(' ');

    console.log(`[YT-DLP] Download usando estratégia: ${playerClient}`);
    console.log('[YT-DLP] Comando:', cmd);
    if (cookiesPath) {
      console.log('[YT-DLP] ✅ Usando cookies de variável de ambiente');
    } else {
      if (playerClient === 'android_with_cookies') {
        console.warn('[YT-DLP] ⚠️ AVISO: android_with_cookies requer cookies. Configure YTDLP_COOKIES para evitar bloqueios 403.');
      } else {
        console.warn('[YT-DLP] ⚠️ Nenhum cookie configurado (YTDLP_COOKIES não definido)');
      }
    }

    exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (error, stdout, stderr) => {
      // Limpar arquivo de cookies temporário
      if (cookiesPath && fs.existsSync(cookiesPath)) {
        try {
          fs.unlinkSync(cookiesPath);
          console.log('[YT-DLP] Arquivo de cookies temporário removido');
        } catch (unlinkError) {
          console.warn('[YT-DLP] Erro ao remover cookies temporário:', unlinkError.message);
        }
      }
      
      if (error) {
        console.error('[YT-DLP] ERRO FATAL:', error);
        console.error('[YT-DLP] stderr:', stderr);
        return reject(error);
      }

      // stderr NÃO indica erro no yt-dlp (pode conter warnings)
      if (stderr && !stderr.includes('WARNING')) {
        console.log('[YT-DLP] stderr:', stderr);
      }
      
      console.log(`[YT-DLP] ✅ Download concluído usando ${playerClient}`);
      resolve(true);
    });
  });
}
