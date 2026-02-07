/**
 * WORKER ISOLADO PARA DOWNLOADS DO YOUTUBE
 * 
 * Este worker é uma camada isolada que permite:
 * - Uso de proxy residencial (futuro)
 * - Migração para VPS própria (futuro)
 * - Uso de API externa (futuro)
 * - Melhor controle de retry e estratégias
 * 
 * Arquitetura preparada para escala e troca de infraestrutura
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Configurações do worker
 */
const WORKER_CONFIG = {
  // Caminho do arquivo de cookies (pode ser definido via env)
  cookiesPath: process.env.YT_DLP_COOKIES_PATH || path.join(process.cwd(), 'cookies', 'cookies.txt'),
  
  // Timeout por tentativa (30 segundos)
  timeout: 30000,
  
  // Delay entre tentativas (1 segundo)
  retryDelay: 1000,
  
  // IP do servidor (para logs)
  serverIP: process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost',
};

/**
 * Estratégias de download com diferentes configurações
 * Ordem de tentativa: mais específicas primeiro
 */
// Função auxiliar para criar cookies temporário a partir de variável de ambiente
// Cache para evitar criar múltiplos arquivos
let cookiesPathCache = null;

function getCookiesPath() {
  // Se já foi criado, reutilizar
  if (cookiesPathCache && fs.existsSync(cookiesPathCache)) {
    return cookiesPathCache;
  }
  
  // Primeiro, tentar arquivo de cookies configurado
  if (fs.existsSync(WORKER_CONFIG.cookiesPath)) {
    cookiesPathCache = WORKER_CONFIG.cookiesPath;
    return cookiesPathCache;
  }
  
  // Se não, tentar criar a partir de variável de ambiente YTDLP_COOKIES
  const cookiesContent = process.env.YTDLP_COOKIES;
  if (cookiesContent && cookiesContent.trim() !== '') {
    try {
      const tempDir = os.tmpdir();
      const cookiesPath = path.join(tempDir, `ytdlp_cookies_${Date.now()}.txt`);
      fs.writeFileSync(cookiesPath, cookiesContent, 'utf8');
      console.log(`[DOWNLOAD-WORKER] Cookies criados a partir de YTDLP_COOKIES: ${cookiesPath}`);
      cookiesPathCache = cookiesPath;
      return cookiesPathCache;
    } catch (error) {
      console.error(`[DOWNLOAD-WORKER] Erro ao criar cookies de YTDLP_COOKIES: ${error.message}`);
    }
  }
  
  return null;
}

// Função para obter argumentos de uma estratégia com cookies dinâmicos
function getStrategyArgs(strategyBase, cookiesPath) {
  const baseArgs = [...strategyBase.args];
  if (cookiesPath) {
    baseArgs.push('--cookies', cookiesPath);
  }
  return baseArgs;
}

// Estratégias em ordem: quando Android falha com 403, tenta as próximas
// Cookies habilitados para todas (quando YTDLP_COOKIES ou YT_DLP_COOKIES_PATH estiver configurado)
const DOWNLOAD_STRATEGIES = [
  {
    name: 'android',
    description: 'Android Client',
    args: [
      '--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      '--referer', 'https://www.youtube.com/',
      '--geo-bypass',
      '--no-check-certificate',
      '--extractor-args', 'youtube:player_client=android'
    ],
    useCookies: true
  },
  {
    name: 'ios',
    description: 'iOS Client (fallback)',
    args: [
      '--user-agent', 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
      '--referer', 'https://www.youtube.com/',
      '--geo-bypass',
      '--no-check-certificate',
      '--extractor-args', 'youtube:player_client=ios'
    ],
    useCookies: true
  },
  {
    name: 'mweb',
    description: 'Mobile Web (fallback)',
    args: [
      '--user-agent', 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--geo-bypass',
      '--no-check-certificate',
      '--extractor-args', 'youtube:player_client=mweb'
    ],
    useCookies: true
  },
  {
    name: 'web',
    description: 'Web Desktop (fallback)',
    args: [
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--referer', 'https://www.youtube.com/',
      '--geo-bypass',
      '--no-check-certificate',
      '--extractor-args', 'youtube:player_client=web'
    ],
    useCookies: true
  },
  {
    name: 'tv_embedded',
    description: 'TV Embedded (último recurso)',
    args: [
      '--user-agent', 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version',
      '--referer', 'https://www.youtube.com/',
      '--geo-bypass',
      '--no-check-certificate',
      '--extractor-args', 'youtube:player_client=tv_embedded'
    ],
    useCookies: true
  }
];

/**
 * Detecta o comando yt-dlp disponível
 */
let ytDlpCommandCache = null;

async function detectYtDlpCommand() {
  if (ytDlpCommandCache) {
    return ytDlpCommandCache;
  }

  const possibleCommands = [
    { cmd: 'yt-dlp', args: ['--version'] },
    { cmd: '/usr/local/bin/yt-dlp', args: ['--version'] },
    { cmd: '/usr/bin/yt-dlp', args: ['--version'] },
    { cmd: 'python3', args: ['-m', 'yt_dlp', '--version'] },
    { cmd: 'python', args: ['-m', 'yt_dlp', '--version'] }
  ];

  for (const { cmd, args } of possibleCommands) {
    const available = await new Promise((resolve) => {
      try {
        const proc = spawn(cmd, args, { stdio: 'pipe' });
        let output = '';
        
        proc.stdout.on('data', (data) => { output += data.toString(); });
        proc.stderr.on('data', (data) => { output += data.toString(); });
        
        proc.on('close', (code) => {
          resolve(code === 0 || output.includes('yt-dlp') || output.includes('yt_dlp'));
        });
        
        proc.on('error', () => resolve(false));
        
        setTimeout(() => {
          if (!proc.killed) proc.kill();
          resolve(false);
        }, 3000);
      } catch {
        resolve(false);
      }
    });

    if (available) {
      if (args.includes('-m')) {
        ytDlpCommandCache = { executable: cmd, useModule: true };
      } else {
        ytDlpCommandCache = { executable: cmd, useModule: false };
      }
      console.log(`[DOWNLOAD-WORKER] ✅ yt-dlp detectado: ${ytDlpCommandCache.executable}${ytDlpCommandCache.useModule ? ' -m yt_dlp' : ''}`);
      return ytDlpCommandCache;
    }
  }

  console.error('[DOWNLOAD-WORKER] ❌ yt-dlp não encontrado');
  ytDlpCommandCache = { executable: 'yt-dlp', useModule: false };
  return ytDlpCommandCache;
}

/**
 * Valida URL do YouTube e extrai video ID
 */
function validateYouTubeUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL não fornecida ou inválida');
  }

  const trimmedUrl = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('URL do YouTube inválida');
}

/**
 * Detecta se o erro é um bloqueio 403 ou relacionado a bot/idade
 */
function is403Error(stderr, exitCode) {
  if (exitCode !== 1) return false;
  
  const errorLower = stderr.toLowerCase();
  return (
    errorLower.includes('403') ||
    errorLower.includes('forbidden') ||
    errorLower.includes('http error 403') ||
    errorLower.includes('sign in to confirm') ||
    errorLower.includes('sign in to confirm you\'re not a bot') ||
    errorLower.includes('bot') ||
    errorLower.includes('age-restricted') ||
    errorLower.includes('age verification') ||
    errorLower.includes('confirm your age') ||
    errorLower.includes('unable to extract') ||
    errorLower.includes('private video')
  );
}

/**
 * Tenta obter informações do vídeo com uma estratégia específica
 */
async function tryGetInfoWithStrategy(url, strategy, ytDlpCommand) {
  return new Promise((resolve, reject) => {
    let executable, args;
    
    // Obter cookies se a estratégia usar
    const cookiesPath = strategy.useCookies ? getCookiesPath() : null;
    const strategyArgs = getStrategyArgs(strategy, cookiesPath);
    
    const baseArgs = [
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      ...strategyArgs,
      url
    ];

    if (ytDlpCommand.useModule) {
      executable = ytDlpCommand.executable;
      args = ['-m', 'yt_dlp', ...baseArgs];
    } else {
      executable = ytDlpCommand.executable;
      args = baseArgs;
    }

    const logPrefix = `[DOWNLOAD-WORKER] [${strategy.name}]`;
    console.log(`${logPrefix} Tentando obter info: ${executable} ${args.join(' ')}`);

    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';
    let timeoutId = null;

    timeoutId = setTimeout(() => {
      if (!process.killed) {
        process.kill();
        reject(new Error('TIMEOUT'));
      }
    }, WORKER_CONFIG.timeout);

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code !== 0) {
        const is403 = is403Error(stderr, code);
        const isFormatError = stderr.includes('Requested format is not available') || 
                             stderr.includes('format is not available') ||
                             stderr.includes('format not available');
        
        if (is403) {
          if (stderr && stderr.trim()) {
            console.warn(`[DOWNLOAD-WORKER] stderr (classificado 403): ${stderr.slice(-500)}`);
          }
          reject(new Error('403_FORBIDDEN'));
        } else if (isFormatError) {
          reject(new Error('FORMAT_NOT_AVAILABLE'));
        } else if (stderr.includes('Video unavailable')) {
          reject(new Error('Vídeo não disponível ou privado'));
        } else {
          reject(new Error(`yt-dlp falhou: ${stderr.slice(0, 200)}`));
        }
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve(info);
      } catch (parseError) {
        reject(new Error('Resposta inválida do yt-dlp'));
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(new Error('yt-dlp não encontrado no sistema'));
    });
  });
}

/**
 * Tenta fazer download com uma estratégia específica
 */
async function tryDownloadWithStrategy(url, outputPath, strategy, ytDlpCommand, onProgress) {
  return new Promise((resolve, reject) => {
    let executable, args;
    
    // Obter cookies se a estratégia usar
    const cookiesPath = strategy.useCookies ? getCookiesPath() : null;
    const strategyArgs = getStrategyArgs(strategy, cookiesPath);
    
    const baseArgs = [
      '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/bestvideo+bestaudio/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-warnings',
      '--no-check-formats',
      ...strategyArgs,
      '-o', outputPath,
      url
    ];

    if (ytDlpCommand.useModule) {
      executable = ytDlpCommand.executable;
      args = ['-m', 'yt_dlp', ...baseArgs];
    } else {
      executable = ytDlpCommand.executable;
      args = baseArgs;
    }

    const logPrefix = `[DOWNLOAD-WORKER] [${strategy.name}]`;
    console.log(`${logPrefix} Iniciando download: ${executable} ${args.join(' ')}`);

    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      if (onProgress && data.toString().includes('[download]')) {
        onProgress(data.toString());
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      if (onProgress && data.toString().includes('[download]')) {
        onProgress(data.toString());
      }
    });

    process.on('close', (code) => {
      if (code !== 0) {
        const is403 = is403Error(stderr, code);
        const isFormatError = stderr.includes('Requested format is not available') || 
                             stderr.includes('format is not available') ||
                             stderr.includes('format not available');
        
        if (is403) {
          if (stderr && stderr.trim()) {
            console.warn(`[DOWNLOAD-WORKER] stderr (classificado 403): ${stderr.slice(-500)}`);
          }
          reject(new Error('403_FORBIDDEN'));
        } else if (isFormatError) {
          reject(new Error('FORMAT_NOT_AVAILABLE'));
        } else {
          reject(new Error(`Download falhou: ${stderr.slice(-300)}`));
        }
        return;
      }

      // Validar arquivo
      if (!fs.existsSync(outputPath)) {
        reject(new Error('Arquivo não foi criado após download'));
        return;
      }

      const stats = fs.statSync(outputPath);
      if (stats.size === 0) {
        fs.unlinkSync(outputPath);
        reject(new Error('Arquivo baixado está vazio'));
        return;
      }

      console.log(`${logPrefix} ✅ Download concluído: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      resolve(outputPath);
    });

    process.on('error', (error) => {
      reject(new Error('yt-dlp não encontrado no sistema'));
    });
  });
}

/**
 * Obtém informações do vídeo com retry automático
 */
export async function getVideoInfo(url) {
  const videoId = validateYouTubeUrl(url);
  const ytDlpCommand = await detectYtDlpCommand();
  
  console.log(`[DOWNLOAD-WORKER] Obtendo info para: ${videoId} (IP: ${WORKER_CONFIG.serverIP})`);

  // Verificar cookies
  const cookiesPath = getCookiesPath();
  if (cookiesPath) {
    console.log(`[DOWNLOAD-WORKER] ✅ Cookies disponíveis: ${cookiesPath}`);
  } else {
    console.log(`[DOWNLOAD-WORKER] ⚠️ Cookies não encontrados. Configure YTDLP_COOKIES ou YT_DLP_COOKIES_PATH`);
  }

  let lastError = null;
  let attempts = [];

  for (const strategy of DOWNLOAD_STRATEGIES) {
    try {
      const startTime = Date.now();
      const info = await tryGetInfoWithStrategy(url, strategy, ytDlpCommand);
      const duration = Date.now() - startTime;

      attempts.push({
        strategy: strategy.name,
        success: true,
        duration,
        timestamp: new Date().toISOString()
      });

      console.log(`[DOWNLOAD-WORKER] ✅ Sucesso com estratégia "${strategy.name}" (${duration}ms)`);
      
      return {
        videoId: info.id || videoId,
        title: info.title || 'Sem título',
        duration: Math.floor(info.duration || 0),
        thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        author: info.uploader || info.channel || 'Desconhecido',
        viewCount: info.view_count || 0,
        description: info.description || '',
        strategy: strategy.name,
        attempts
      };
    } catch (error) {
      const duration = Date.now() - Date.now();
      attempts.push({
        strategy: strategy.name,
        success: false,
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      });

      lastError = error;

      // Verificar se é erro de formato não disponível
      const isFormatError = error.message === 'FORMAT_NOT_AVAILABLE' ||
                           error.message.includes('Requested format is not available') || 
                           error.message.includes('format is not available') ||
                           error.message.includes('format not available');
      
      // Se não for erro 403 ou de formato, não tentar outras estratégias
      if (error.message !== '403_FORBIDDEN' && !error.message.includes('403') && !isFormatError) {
        console.error(`[DOWNLOAD-WORKER] ❌ Erro não recuperável: ${error.message}`);
        throw new Error(`Erro ao obter informações: ${error.message}`);
      }
      
      // Se for erro de formato, tentar próxima estratégia
      if (isFormatError) {
        console.warn(`[DOWNLOAD-WORKER] ⚠️ Estratégia "${strategy.name}" falhou (formato não disponível), tentando próxima...`);
        await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.retryDelay));
        continue;
      }

      console.warn(`[DOWNLOAD-WORKER] ⚠️ Estratégia "${strategy.name}" falhou (403), tentando próxima...`);
      await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.retryDelay));
    }
  }

  // Todas as estratégias falharam
  console.error(`[DOWNLOAD-WORKER] ❌ Todas as estratégias falharam para: ${videoId}`);
  console.error(`[DOWNLOAD-WORKER] Tentativas:`, JSON.stringify(attempts, null, 2));
  
  throw new Error('YouTube bloqueou o acesso (403). Bloqueio por IP de datacenter detectado. Considere usar cookies do navegador ou migrar para VPS com IP residencial.');
}

/**
 * Faz download do vídeo com retry automático
 */
export async function downloadVideo(url, outputPath, onProgress) {
  const videoId = validateYouTubeUrl(url);
  const ytDlpCommand = await detectYtDlpCommand();
  
  console.log(`[DOWNLOAD-WORKER] Download iniciado: ${videoId} -> ${outputPath} (IP: ${WORKER_CONFIG.serverIP})`);

  // Verificar cookies
  const cookiesPath = getCookiesPath();
  if (cookiesPath) {
    console.log(`[DOWNLOAD-WORKER] ✅ Cookies disponíveis: ${cookiesPath}`);
  } else {
    console.log(`[DOWNLOAD-WORKER] ⚠️ Cookies não encontrados. Configure YTDLP_COOKIES ou YT_DLP_COOKIES_PATH`);
  }

  // Garantir diretório existe
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Remover arquivo existente
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  let lastError = null;
  let attempts = [];

  for (const strategy of DOWNLOAD_STRATEGIES) {
    try {
      const startTime = Date.now();
      const result = await tryDownloadWithStrategy(url, outputPath, strategy, ytDlpCommand, onProgress);
      const duration = Date.now() - startTime;

      attempts.push({
        strategy: strategy.name,
        success: true,
        duration,
        timestamp: new Date().toISOString()
      });

      console.log(`[DOWNLOAD-WORKER] ✅ Download concluído com estratégia "${strategy.name}" (${duration}ms)`);
      
      return {
        path: result,
        strategy: strategy.name,
        attempts
      };
    } catch (error) {
      const duration = Date.now() - Date.now();
      attempts.push({
        strategy: strategy.name,
        success: false,
        error: error.message,
        duration,
        timestamp: new Date().toISOString()
      });

      lastError = error;

      // Verificar se é erro de formato não disponível
      const isFormatError = error.message === 'FORMAT_NOT_AVAILABLE' ||
                           error.message.includes('Requested format is not available') || 
                           error.message.includes('format is not available') ||
                           error.message.includes('format not available');
      
      // Se não for erro 403 ou de formato, não tentar outras estratégias
      if (error.message !== '403_FORBIDDEN' && !error.message.includes('403') && !isFormatError) {
        console.error(`[DOWNLOAD-WORKER] ❌ Erro não recuperável: ${error.message}`);
        throw error;
      }
      
      // Se for erro de formato, tentar próxima estratégia
      if (isFormatError) {
        console.warn(`[DOWNLOAD-WORKER] ⚠️ Estratégia "${strategy.name}" falhou (formato não disponível), tentando próxima...`);
        
        // Limpar arquivo parcial
        if (fs.existsSync(outputPath)) {
          try {
            fs.unlinkSync(outputPath);
          } catch (unlinkError) {
            // Ignorar
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.retryDelay));
        continue;
      }

      console.warn(`[DOWNLOAD-WORKER] ⚠️ Estratégia "${strategy.name}" falhou (403), tentando próxima...`);

      // Limpar arquivo parcial
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (unlinkError) {
          // Ignorar
        }
      }

      await new Promise(resolve => setTimeout(resolve, WORKER_CONFIG.retryDelay));
    }
  }

  // Todas as estratégias falharam
  console.error(`[DOWNLOAD-WORKER] ❌ Todas as estratégias de download falharam para: ${videoId}`);
  console.error(`[DOWNLOAD-WORKER] Tentativas:`, JSON.stringify(attempts, null, 2));
  
  throw new Error('YouTube bloqueou o acesso (403). Bloqueio por IP de datacenter detectado. Considere usar cookies do navegador ou migrar para VPS com IP residencial.');
}

/**
 * Verifica se yt-dlp está disponível
 */
export async function checkAvailability() {
  const command = await detectYtDlpCommand();
  const cookiesPath = getCookiesPath();
  
  return {
    ytDlpAvailable: command !== null,
    ytDlpCommand: command,
    cookiesAvailable: cookiesPath !== null,
    cookiesPath: cookiesPath || WORKER_CONFIG.cookiesPath,
    serverIP: WORKER_CONFIG.serverIP
  };
}
