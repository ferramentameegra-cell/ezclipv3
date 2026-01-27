/**
 * CONTROLLER DE DOWNLOAD COM PROGRESSO SSE
 * Corrigido com tratamento de erros específicos e mensagens claras
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { initVideoState, updateVideoState, VIDEO_STATES } from '../services/videoStateManager.js';

export const videoStore = new Map();

// Cache do arquivo de cookies para reutilizar entre tentativas
let cookiesPathCache = null;
let cookiesContentCache = null;

/**
 * Cria arquivo temporário de cookies a partir da variável de ambiente
 * Retorna o caminho do arquivo ou null se não houver cookies
 * Reutiliza arquivo se conteúdo não mudou
 */
function createCookiesFile() {
  const cookiesContent = process.env.YTDLP_COOKIES;
  
  // Se não há cookies, limpar cache e retornar null
  if (!cookiesContent || cookiesContent.trim() === '') {
    if (cookiesPathCache && fs.existsSync(cookiesPathCache)) {
      try {
        fs.unlinkSync(cookiesPathCache);
      } catch (e) {
        // Ignorar erro ao remover
      }
    }
    cookiesPathCache = null;
    cookiesContentCache = null;
    return null;
  }

  // Se conteúdo não mudou e arquivo existe, reutilizar
  if (cookiesPathCache && cookiesContentCache === cookiesContent && fs.existsSync(cookiesPathCache)) {
    console.log('[DOWNLOAD] ✅ Reutilizando arquivo de cookies existente:', cookiesPathCache);
    return cookiesPathCache;
  }

  try {
    // Criar arquivo temporário
    const tempDir = os.tmpdir();
    const cookiesPath = path.join(tempDir, `ytdlp_cookies_${Date.now()}.txt`);
    
    // Escrever conteúdo dos cookies
    fs.writeFileSync(cookiesPath, cookiesContent, 'utf8');
    
    // Remover arquivo antigo se existir
    if (cookiesPathCache && fs.existsSync(cookiesPathCache) && cookiesPathCache !== cookiesPath) {
      try {
        fs.unlinkSync(cookiesPathCache);
      } catch (e) {
        // Ignorar erro ao remover arquivo antigo
      }
    }
    
    // Atualizar cache
    cookiesPathCache = cookiesPath;
    cookiesContentCache = cookiesContent;
    
    console.log('[DOWNLOAD] ✅ Arquivo de cookies criado:', cookiesPath);
    console.log('[DOWNLOAD] ✅ Tamanho do arquivo de cookies:', fs.statSync(cookiesPath).size, 'bytes');
    return cookiesPath;
  } catch (error) {
    console.error('[DOWNLOAD] ❌ Erro ao criar arquivo de cookies:', error.message);
    cookiesPathCache = null;
    cookiesContentCache = null;
    return null;
  }
}

/**
 * Obtém User-Agent da variável de ambiente ou usa padrão
 */
function getUserAgent() {
  return process.env.YTDLP_USER_AGENT || 
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
}

// Cache do comando yt-dlp detectado
let ytDlpCommandCache = null;

/**
 * Detecta o comando yt-dlp disponível no sistema
 */
async function detectYtDlpCommand() {
  // Se já foi detectado, usar cache
  if (ytDlpCommandCache) {
    return ytDlpCommandCache;
  }

  // Priorizar binário yt-dlp diretamente (mais confiável)
  // Tentar módulo Python apenas como fallback
  const possibleCommands = [
    { cmd: 'yt-dlp', args: ['--version'], useModule: false },
    { cmd: '/usr/local/bin/yt-dlp', args: ['--version'], useModule: false },
    { cmd: '/usr/bin/yt-dlp', args: ['--version'], useModule: false },
    { cmd: '/opt/homebrew/bin/yt-dlp', args: ['--version'], useModule: false },
    { cmd: process.env.HOME + '/Library/Python/3.9/bin/yt-dlp', args: ['--version'], useModule: false },
    // Fallback para módulo Python (menos confiável)
    { cmd: 'python3', args: ['-m', 'yt_dlp', '--version'], useModule: true },
    { cmd: 'python', args: ['-m', 'yt_dlp', '--version'], useModule: true }
  ];

  for (const { cmd, args, useModule } of possibleCommands) {
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
        }, 2000);
      } catch {
        resolve(false);
      }
    });

    if (available) {
      ytDlpCommandCache = { executable: cmd, useModule: useModule || false };
      console.log(`[DOWNLOAD] ✅ yt-dlp detectado: ${ytDlpCommandCache.executable}${ytDlpCommandCache.useModule ? ' -m yt_dlp' : ''}`);
      return ytDlpCommandCache;
    }
  }

  console.error('[DOWNLOAD] ❌ yt-dlp não encontrado');
  ytDlpCommandCache = { executable: 'yt-dlp', useModule: false };
  return ytDlpCommandCache;
}

/**
 * Cria argumentos para spawn do yt-dlp baseado no comando detectado
 */
function buildYtDlpArgs(downloadArgs) {
  const cmd = ytDlpCommandCache || { executable: 'yt-dlp', useModule: false };
  
  if (cmd.useModule) {
    return {
      executable: cmd.executable,
      args: ['-m', 'yt_dlp', ...downloadArgs]
    };
  } else {
    return {
      executable: cmd.executable,
      args: downloadArgs
    };
  }
}

function sanitizeYouTubeUrl(url) {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/watch?v=${v}`;
    if (u.hostname === "youtu.be") return url;
    return null;
  } catch {
    return null;
  }
}

/**
 * Obter duração do vídeo usando ffprobe
 */
function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    try {
      const ffprobe = spawn("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        filePath
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = "";
      let stderr = "";

      ffprobe.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffprobe.on("close", (code) => {
        if (code === 0) {
          try {
            const json = JSON.parse(stdout);
            const duration = Math.floor(Number(json.format?.duration || 0));
            if (duration > 0) {
              console.log(`[FFPROBE] Duração obtida: ${duration}s`);
              resolve(duration);
              return;
            }
          } catch (parseError) {
            console.error(`[FFPROBE] Erro ao parsear JSON: ${parseError.message}`);
          }
        } else {
          console.error(`[FFPROBE] Erro (code ${code}): ${stderr.slice(-200)}`);
        }
        resolve(0);
      });

      ffprobe.on("error", (error) => {
        console.error(`[FFPROBE] Erro ao executar: ${error.message}`);
        resolve(0);
      });
    } catch (error) {
      console.error(`[FFPROBE] Erro geral: ${error.message}`);
      resolve(0);
    }
  });
}

/**
 * Analisa erros do yt-dlp e retorna mensagem específica
 */
function parseYtDlpError(stderr, exitCode) {
  const errorLower = stderr.toLowerCase();
  
  // Erros específicos conhecidos
  if (errorLower.includes('video unavailable') || errorLower.includes('private video')) {
    return 'Este vídeo não está disponível ou é privado. Use um vídeo público.';
  }
  
  if (errorLower.includes('sign in to confirm') || errorLower.includes('sign in to confirm you\'re not a bot') || errorLower.includes('bot') || errorLower.includes('use --cookies') || errorLower.includes('--cookies-from-browser')) {
    const hasCookies = process.env.YTDLP_COOKIES && process.env.YTDLP_COOKIES.trim() !== '';
    if (!hasCookies) {
      return '❌ ERRO CRÍTICO: YouTube detectou acesso automatizado. É OBRIGATÓRIO configurar cookies do navegador na variável YTDLP_COOKIES no Railway. Sem cookies, o download não funcionará. Veja o arquivo COMO_CONFIGURAR_COOKIES_YOUTUBE.md para instruções detalhadas.';
    } else {
      // Verificar se o arquivo de cookies foi criado corretamente
      const cookiesPath = createCookiesFile();
      if (!cookiesPath || !fs.existsSync(cookiesPath)) {
        return '❌ ERRO: Cookies configurados mas arquivo não foi criado. Verifique se YTDLP_COOKIES está no formato Netscape correto. Veja: COMO_CONFIGURAR_COOKIES_YOUTUBE.md';
      }
      const stats = fs.statSync(cookiesPath);
      if (stats.size === 0) {
        return '❌ ERRO: Arquivo de cookies está vazio. Verifique se YTDLP_COOKIES contém cookies válidos no formato Netscape. Veja: COMO_CONFIGURAR_COOKIES_YOUTUBE.md';
      }
      return '⚠️ YouTube detectou acesso automatizado mesmo com cookies. Os cookies podem ter expirado ou estar inválidos. Atualize a variável YTDLP_COOKIES no Railway com cookies frescos exportados do navegador. Veja: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp';
    }
  }
  
  if (errorLower.includes('age-restricted') || errorLower.includes('age verification') || errorLower.includes('confirm your age')) {
    return 'Este vídeo requer confirmação de idade. Configure cookies do navegador na variável YTDLP_COOKIES. Veja: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp';
  }
  
  if (errorLower.includes('playlist') && errorLower.includes('not allowed')) {
    return 'Playlists não são suportadas. Use uma URL de vídeo individual.';
  }
  
  if (errorLower.includes('unavailable') || errorLower.includes('removed')) {
    return 'Vídeo não disponível ou foi removido.';
  }
  
  if (errorLower.includes('network') || errorLower.includes('connection') || errorLower.includes('timeout')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }
  
  if (errorLower.includes('geoblocked') || errorLower.includes('blocked in your country')) {
    return 'Este vídeo não está disponível na sua região.';
  }
  
  if (errorLower.includes('403') || errorLower.includes('forbidden') || errorLower.includes('http error 403')) {
    return 'YouTube bloqueou o acesso (403). Isso pode ser temporário. Tente novamente em alguns minutos ou verifique se o vídeo está disponível. Se persistir, atualize: python3 -m pip install --upgrade yt-dlp';
  }
  
  if (errorLower.includes('requested format is not available') || errorLower.includes('format is not available')) {
    return 'Formato de vídeo não disponível para este vídeo. Isso pode ser temporário. Tente novamente em alguns minutos.';
  }
  
  if (errorLower.includes('sign in to download') || errorLower.includes('private video') || errorLower.includes('members-only')) {
    return 'Este vídeo requer login ou é privado. Use um vídeo público.';
  }
  
  if (errorLower.includes('copyright') || errorLower.includes('content id')) {
    return 'Vídeo protegido por direitos autorais. Não é possível baixar.';
  }
  
  // Erro genérico com informação do código de saída
  const lastLines = stderr.split('\n').slice(-5).join(' ').trim();
  if (lastLines) {
    return `Erro ao baixar: ${lastLines.slice(0, 150)}`;
  }
  
  return `Erro ao baixar vídeo (código ${exitCode}). Verifique a URL e tente novamente.`;
}

export async function downloadWithProgress(req, res) {
  try {
    console.log(`[DOWNLOAD] Requisição recebida: ${req.query.url}`);
    
    // Configurar SSE headers ANTES de qualquer operação
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", "*"); // CORS para SSE
    res.flushHeaders();

    const cleanUrl = sanitizeYouTubeUrl(req.query.url);

    if (!cleanUrl) {
      console.error(`[DOWNLOAD] URL inválida: ${req.query.url}`);
      res.write(`data: ${JSON.stringify({
        success: false,
        error: "URL do YouTube inválida. Use formato: https://youtube.com/watch?v=VIDEO_ID ou https://youtu.be/VIDEO_ID",
        state: "error"
      })}\n\n`);
      res.end();
      return;
    }
    
    // Enviar mensagem inicial para garantir conexão SSE está ativa
    console.log(`[DOWNLOAD] Enviando mensagem inicial SSE`);
    res.write(`data: ${JSON.stringify({
      status: "starting",
      state: "starting",
      message: "Iniciando download...",
      progress: 0
    })}\n\n`);

  // Criar diretório
  const uploadsDir = "/tmp/uploads";
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const videoId = uuidv4();
  // Usar placeholder genérico - yt-dlp adicionará extensão correta
  const outputTemplate = path.join(uploadsDir, `${videoId}.%(ext)s`);
  const outputPath = path.join(uploadsDir, `${videoId}.mp4`); // Fallback para compatibilidade

  console.log(`[DOWNLOAD] Iniciando: ${cleanUrl} -> ${outputPath}`);

  // Detectar comando yt-dlp disponível ANTES de iniciar o processo
  await detectYtDlpCommand();
  
  // Verificar se yt-dlp foi encontrado (se não, o cache ainda terá executable: 'yt-dlp')
  if (!ytDlpCommandCache || (ytDlpCommandCache.executable === 'yt-dlp' && !ytDlpCommandCache.useModule)) {
    // Testar se 'yt-dlp' direto funciona (pode ser que esteja no PATH)
    const testAvailable = await new Promise((resolve) => {
      const testProc = spawn('yt-dlp', ['--version'], { stdio: 'pipe' });
      testProc.on('close', (code) => resolve(code === 0));
      testProc.on('error', () => {
        // Não tentar módulo Python - apenas binário
        resolve(false);
      });
      setTimeout(() => {
        if (!testProc.killed) testProc.kill();
        resolve(false);
      }, 2000);
    });
    
    if (!testAvailable) {
      res.write(`data: ${JSON.stringify({
        success: false,
        error: "yt-dlp não está disponível no servidor. Contate o suporte.",
        state: "error"
      })}\n\n`);
      res.end();
      return;
    }
    
    // Se funcionou, atualizar cache
    ytDlpCommandCache = { executable: 'yt-dlp', useModule: false };
  }
  
  // Limpar cache do yt-dlp periodicamente para evitar dados desatualizados
  // (isso é feito antes de cada download importante)
  try {
    const cmd = ytDlpCommandCache || { executable: 'python3', useModule: true };
    const clearCacheProc = spawn(
      cmd.useModule ? cmd.executable : 'python3',
      cmd.useModule ? ['-m', 'yt_dlp', '--rm-cache-dir'] : ['--rm-cache-dir'],
      { stdio: 'ignore' }
    );
    clearCacheProc.on('close', () => {
      console.log('[DOWNLOAD] Cache do yt-dlp limpo');
    });
    clearCacheProc.on('error', () => {
      // Ignorar erro de limpeza de cache
    });
    setTimeout(() => {
      if (!clearCacheProc.killed) clearCacheProc.kill();
    }, 2000);
  } catch (cacheError) {
    // Ignorar erros ao limpar cache
    console.warn('[DOWNLOAD] Erro ao limpar cache:', cacheError.message);
  }
  
  /**
   * Lista todos os formatos disponíveis para um vídeo do YouTube (OTIMIZADO - timeout curto)
   * Retorna array de formatos ordenados por qualidade (melhor primeiro)
   */
  async function listAvailableFormats(videoUrl, strategy) {
    return new Promise((resolve) => {
      const cookiesPath = createCookiesFile();
      const userAgent = getUserAgent();
      const finalUserAgent = process.env.YTDLP_USER_AGENT || strategy.userAgent || userAgent;
      
      const listArgs = [
        '--list-formats',
        '--no-playlist',
        '--no-warnings',
        ...(cookiesPath ? ['--cookies', cookiesPath] : []),
        '--user-agent', finalUserAgent,
        '--referer', 'https://www.youtube.com/',
        '--extractor-args', strategy.extractorArgs,
        '--no-check-certificate',
        '--socket-timeout', '10', // Timeout curto para agilidade
        videoUrl
      ];
      
      const { executable, args } = buildYtDlpArgs(listArgs);
      const ytdlp = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      // Timeout de 15 segundos (rápido)
      const timeout = setTimeout(() => {
        ytdlp.kill();
        console.warn(`[DOWNLOAD] ⚠️ Timeout ao listar formatos com ${strategy.name}`);
        resolve([]);
      }, 15000);
      
      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ytdlp.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          resolve([]); // Retornar array vazio em caso de erro
          return;
        }
        
        // Parsear formatos do stdout (OTIMIZADO - apenas formatos mais comuns)
        const formats = [];
        const lines = stdout.split('\n');
        
        for (const line of lines) {
          const match = line.match(/^\s*(\d+)\s+(\w+)\s+([\dx]+)?\s*(\d+)?\s*\|/);
          if (match) {
            const formatId = match[1];
            const ext = match[2];
            const resolution = match[3] || 'unknown';
            const fps = match[4] || '0';
            
            // Extrair codec
            const codecMatch = line.match(/avc1|vp9|av01|h264|h265/i);
            const codec = codecMatch ? codecMatch[0].toLowerCase() : 'unknown';
            
            // Calcular prioridade (OTIMIZADO - priorizar formatos comuns)
            let priority = 0;
            if (resolution !== 'unknown') {
              const [width, height] = resolution.split('x').map(Number);
              if (width && height) {
                priority += width * height;
              }
            }
            // Priorizar formatos mais comuns primeiro
            if (codec.includes('avc1') || codec.includes('h264')) priority += 20000; // Muito preferir H.264
            if (ext === 'mp4') priority += 10000; // Muito preferir MP4
            // Priorizar resoluções comuns: 1080p > 720p > 480p > 360p
            if (resolution.includes('1920x1080') || resolution.includes('1080x1920')) priority += 5000;
            if (resolution.includes('1280x720') || resolution.includes('720x1280')) priority += 3000;
            if (resolution.includes('854x480') || resolution.includes('480x854')) priority += 1000;
            
            formats.push({
              id: formatId,
              ext,
              resolution,
              fps: parseInt(fps) || 0,
              codec,
              priority,
              strategy
            });
          }
        }
        
        // Ordenar por prioridade (maior primeiro)
        formats.sort((a, b) => b.priority - a.priority);
        
        // Limitar aos top 20 formatos (mais rápidos)
        const topFormats = formats.slice(0, 20);
        
        if (topFormats.length > 0) {
          console.log(`[DOWNLOAD] ✅ ${topFormats.length} melhores formatos encontrados: ${topFormats.slice(0, 3).map(f => `${f.id} (${f.resolution})`).join(', ')}...`);
        }
        
        resolve(topFormats);
      });
      
      ytdlp.on('error', (error) => {
        clearTimeout(timeout);
        resolve([]);
      });
    });
  }
  
  /**
   * Tenta fazer download usando um formato específico (OTIMIZADO - timeout curto, retries reduzidos)
   */
  async function tryDownloadWithFormat(videoUrl, outputTemplate, formatId, strategy) {
    return new Promise((resolve, reject) => {
      const cookiesPath = createCookiesFile();
      const userAgent = getUserAgent();
      const finalUserAgent = process.env.YTDLP_USER_AGENT || strategy.userAgent || userAgent;
      
      const downloadArgs = [
        '-f', formatId,
        '--merge-output-format', 'mp4',
        '--no-playlist',
        '--no-warnings',
        '--newline',
        ...(cookiesPath ? ['--cookies', cookiesPath] : []),
        '--user-agent', finalUserAgent,
        '--referer', 'https://www.youtube.com/',
        '--extractor-args', strategy.extractorArgs,
        '--no-check-certificate',
        '--retries', '1', // Reduzido para agilidade
        '--fragment-retries', '1', // Reduzido
        '--socket-timeout', '15', // Timeout curto
        '--file-access-retries', '1', // Reduzido
        '-o', outputTemplate,
        videoUrl
      ];
      
      const { executable, args } = buildYtDlpArgs(downloadArgs);
      const ytdlp = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let stderr = '';
      let stdout = '';
      let hasResolved = false;
      let downloadStarted = false;
      
      // Timeout de 30 segundos por formato (rápido)
      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          ytdlp.kill();
          reject({ timeout: true, formatId, strategy: strategy.name });
        }
      }, 30000);
      
      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
        const progressMatch = data.toString().match(/\[download\]\s+(\d{1,3}\.\d+)%/i);
        if (progressMatch) {
          downloadStarted = true;
          const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
          res.write(`data: ${JSON.stringify({
            progress: percent,
            status: 'downloading',
            state: 'downloading',
            message: `Baixando formato ${formatId}... ${percent.toFixed(1)}%`
          })}\n\n`);
        }
      });
      
      ytdlp.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      ytdlp.on('close', (code) => {
        clearTimeout(timeout);
        if (hasResolved) return;
        hasResolved = true;
        
        if (code === 0 || downloadStarted) {
          // Procurar arquivo baixado
          const possibleExtensions = ['mp4', 'webm', 'mkv', 'm4a'];
          const uploadsDir = path.dirname(outputTemplate.replace('%(ext)s', 'mp4'));
          const videoId = path.basename(outputTemplate, '.%(ext)s');
          
          for (const ext of possibleExtensions) {
            const testPath = path.join(uploadsDir, `${videoId}.${ext}`);
            if (fs.existsSync(testPath)) {
              const stats = fs.statSync(testPath);
              if (stats.size > 0) {
                resolve({ success: true, filePath: testPath, formatId, strategy: strategy.name });
                return;
              }
            }
          }
        }
        
        reject({ code, stderr: stderr.slice(-200), formatId, strategy: strategy.name });
      });
      
      ytdlp.on('error', (error) => {
        clearTimeout(timeout);
        if (hasResolved) return;
        hasResolved = true;
        reject({ error: error.message, formatId, strategy: strategy.name });
      });
    });
  }
  
  // ESTRATÉGIA ÚNICA: APENAS ANDROID CLIENT
  // Removidas todas as outras estratégias conforme solicitado
  const strategy = {
    name: 'Android Client',
    extractorArgs: 'youtube:player_client=android',
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    additionalArgs: []
  };
  
  console.log('[DOWNLOAD] ✅ Usando APENAS Android Client (estratégia única)');
  
  // Tentar cada estratégia sequencialmente
  let strategyIndex = 0;
  let lastError = null;
  
  const tryDownloadWithStrategy = async (strategy) => {
    return new Promise((resolve, reject) => {
      console.log(`[DOWNLOAD] Tentando estratégia: ${strategy.name}`);
      
      // Criar arquivo de cookies se disponível (solução para erro 403)
      let cookiesPath = createCookiesFile();
      const userAgentFromEnv = getUserAgent();
      
      // Priorizar User-Agent da variável de ambiente, senão usar da estratégia
      const finalUserAgent = process.env.YTDLP_USER_AGENT || strategy.userAgent;
      
      // Validar cookies apenas se a estratégia requer cookies ou se cookies estão disponíveis
      if (strategy.requiresCookies || cookiesPath) {
        if (cookiesPath) {
          // Validar que o arquivo existe e não está vazio
          try {
            if (!fs.existsSync(cookiesPath)) {
              console.warn('[DOWNLOAD] ⚠️ Arquivo de cookies não existe, re-criando...');
              // Tentar recriar
              const newCookiesPath = createCookiesFile();
              if (newCookiesPath && fs.existsSync(newCookiesPath)) {
                cookiesPath = newCookiesPath;
              } else {
                console.warn('[DOWNLOAD] ⚠️ Falha ao recriar arquivo de cookies');
                cookiesPath = null;
              }
            }
            
            if (cookiesPath && fs.existsSync(cookiesPath)) {
              const stats = fs.statSync(cookiesPath);
              if (stats.size === 0) {
                console.warn('[DOWNLOAD] ⚠️ Arquivo de cookies está vazio');
                cookiesPath = null;
              } else {
                console.log('[DOWNLOAD] ✅ Usando cookies de variável de ambiente (YTDLP_COOKIES)');
                console.log('[DOWNLOAD] ✅ Tamanho do arquivo de cookies:', stats.size, 'bytes');
              }
            }
          } catch (e) {
            console.warn('[DOWNLOAD] ⚠️ Erro ao validar arquivo de cookies:', e.message);
            cookiesPath = null;
          }
        } else {
          if (strategy.requiresCookies) {
            console.warn(`[DOWNLOAD] ⚠️ Estratégia ${strategy.name} requer cookies, mas nenhum foi configurado`);
            console.warn('[DOWNLOAD] ⚠️ Configure YTDLP_COOKIES no Railway para melhor compatibilidade');
          } else {
            console.log('[DOWNLOAD] ℹ️ Nenhum cookie configurado - tentando sem cookies');
          }
        }
      } else {
        console.log('[DOWNLOAD] ℹ️ Estratégia não requer cookies - tentando sem cookies');
      }
      
      console.log('[DOWNLOAD] User-Agent:', finalUserAgent.substring(0, 50) + '...');
      
      // Preparar argumentos do yt-dlp com a estratégia atual
      // Formato MÁXIMA flexibilidade: aceitar QUALQUER formato disponível
      // Priorizar: melhor vídeo+áudio > melhor formato único > qualquer formato disponível
      const extractorArgsCombined = strategy.extractorArgs;
      
      // Formato flexível que aceita qualquer formato disponível
      // Ordem: melhor vídeo+áudio > melhor formato mp4 > melhor formato webm > melhor formato qualquer
      const formatSelector = "bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best[height<=1080]/best";
      
      const downloadArgs = [
        "-f", formatSelector, // Formato flexível que aceita qualquer formato disponível
        "--merge-output-format", "mp4", // Se precisar mergear, usar mp4
        "--no-playlist",
        "--no-warnings",
        "--newline",
        // Cookies e User-Agent (solução para erro 403 e restrição de idade)
        ...(cookiesPath ? ["--cookies", cookiesPath] : []),
        "--user-agent", finalUserAgent,
        "--referer", "https://www.youtube.com/",
        // Usar cliente específico da estratégia
        "--extractor-args", extractorArgsCombined,
        // Flags para contornar detecção de bot e restrição de idade
        "--no-check-certificate", // Ignorar verificação de certificado (pode ajudar com alguns bloqueios)
        // Opções de robustez
        "--retries", "3",
        "--fragment-retries", "3",
        "--file-access-retries", "3",
        "--sleep-requests", "1",
        "-4", // Forçar IPv4
        "-o", outputTemplate, // yt-dlp adicionará extensão correta automaticamente
        cleanUrl
      ];
      
      const { executable, args } = buildYtDlpArgs(downloadArgs);
      
      const ytdlp = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let lastProgress = 0;
      let stderr = "";
      let stdout = "";
      let hasResolved = false;
      
      // Capturar stderr (yt-dlp envia progresso aqui)
      ytdlp.stderr.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        
        // Procurar progresso
        const progressMatch = text.match(/\[download\]\s+(\d{1,3}\.\d+)%/i);
        if (progressMatch) {
          const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
          if (percent > lastProgress) {
            lastProgress = percent;
            res.write(`data: ${JSON.stringify({
              progress: percent,
              status: "downloading",
              state: "downloading",
              message: `Baixando (${strategy.name})... ${percent.toFixed(1)}%`
            })}\n\n`);
          }
        }
      });
      
      // Capturar stdout também (alguns logs vão aqui)
      ytdlp.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      // Processo finalizado
      ytdlp.on("close", async (code) => {
        if (hasResolved) return;
        
        // NÃO limpar arquivo de cookies aqui - será reutilizado nas próximas tentativas
        // Apenas limpar no final se todas as estratégias falharem ou se download for bem-sucedido
        
        console.log(`[DOWNLOAD] ${strategy.name} finalizou com código: ${code}`);
        
        // Log detalhado do erro para debug
        if (code !== 0) {
          console.error(`[DOWNLOAD] Erro ${strategy.name} - stderr:`, stderr.slice(-500));
          console.error(`[DOWNLOAD] Erro ${strategy.name} - stdout:`, stdout.slice(-500));
        }
        
        // Se sucesso, encontrar arquivo baixado (pode ser .mp4, .webm, .mkv, etc)
        if (code === 0) {
          // Procurar arquivo baixado com qualquer extensão
          const possibleExtensions = ['mp4', 'webm', 'mkv', 'm4a'];
          let downloadedFile = null;
          
          for (const ext of possibleExtensions) {
            const testPath = path.join(uploadsDir, `${videoId}.${ext}`);
            if (fs.existsSync(testPath)) {
              const stats = fs.statSync(testPath);
              if (stats.size > 0) {
                downloadedFile = testPath;
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
            hasResolved = true;
            console.log(`[DOWNLOAD] ✅ Sucesso com estratégia: ${strategy.name} - Arquivo: ${downloadedFile}`);
            resolve({ success: true, strategy: strategy.name, filePath: downloadedFile, stderr, stdout });
            return;
          }
        }
        
        // Verificar se é erro de formato não disponível - tentar com formato mais flexível
        const isFormatError = stderr.includes('Requested format is not available') || 
                             stderr.includes('format is not available') ||
                             stderr.includes('format not available');
        
        if (isFormatError && !hasResolved) {
          console.warn(`[DOWNLOAD] ⚠️ Formato não disponível com estratégia ${strategy.name}, tentando formato mais flexível...`);
          
          // Tentar novamente com formato ainda mais flexível (qualquer formato)
          const flexibleFormatArgs = [
            "-f", "best", // Apenas melhor formato disponível, sem restrições
            "--merge-output-format", "mp4",
            "--no-playlist",
            "--no-warnings",
            "--newline",
            ...(cookiesPath ? ["--cookies", cookiesPath] : []),
            "--user-agent", finalUserAgent,
            "--referer", "https://www.youtube.com/",
            "--extractor-args", extractorArgsCombined,
            "--no-check-certificate",
            "--retries", "3",
            "--fragment-retries", "3",
            "--file-access-retries", "3",
            "--sleep-requests", "1",
            "-4",
            "-o", outputTemplate,
            cleanUrl
          ];
          
          const { executable: exec2, args: args2 } = buildYtDlpArgs(flexibleFormatArgs);
          const ytdlp2 = spawn(exec2, args2, { stdio: ['ignore', 'pipe', 'pipe'] });
          
          let stderr2 = "";
          let stdout2 = "";
          let hasResolved2 = false;
          
          ytdlp2.stderr.on("data", (data) => {
            stderr2 += data.toString();
            const progressMatch = data.toString().match(/\[download\]\s+(\d{1,3}\.\d+)%/i);
            if (progressMatch) {
              const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
              res.write(`data: ${JSON.stringify({
                progress: percent,
                status: "downloading",
                state: "downloading",
                message: `Baixando (${strategy.name} - formato flexível)... ${percent.toFixed(1)}%`
              })}\n\n`);
            }
          });
          
          ytdlp2.stdout.on("data", (data) => {
            stdout2 += data.toString();
          });
          
          ytdlp2.on("close", async (code2) => {
            if (hasResolved2) return;
            hasResolved2 = true;
            
            if (code2 === 0) {
              const possibleExtensions = ['mp4', 'webm', 'mkv', 'm4a'];
              let downloadedFile = null;
              
              for (const ext of possibleExtensions) {
                const testPath = path.join(uploadsDir, `${videoId}.${ext}`);
                if (fs.existsSync(testPath)) {
                  const stats = fs.statSync(testPath);
                  if (stats.size > 0) {
                    downloadedFile = testPath;
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
                hasResolved = true;
                console.log(`[DOWNLOAD] ✅ Sucesso com estratégia: ${strategy.name} (formato flexível) - Arquivo: ${downloadedFile}`);
                resolve({ success: true, strategy: strategy.name, filePath: downloadedFile, stderr: stderr2, stdout: stdout2 });
                return;
              }
            }
            
            // Se ainda falhou, rejeitar para tentar próxima estratégia
            hasResolved = true;
            lastError = { code: code2, stderr: stderr2, stdout: stdout2, strategy: strategy.name };
            reject(lastError);
          });
          
          ytdlp2.on("error", (error2) => {
            if (hasResolved2) return;
            hasResolved2 = true;
            hasResolved = true;
            lastError = { error: error2.message, strategy: strategy.name };
            reject(lastError);
          });
          
          return; // Não rejeitar ainda, aguardar segunda tentativa
        }
        
        // Se erro, rejeitar para tentar próxima estratégia
        hasResolved = true;
        lastError = { code, stderr, stdout, strategy: strategy.name };
        reject(lastError);
      });
      
      // Erro ao executar
      ytdlp.on("error", (error) => {
        if (hasResolved) return;
        hasResolved = true;
        
        // NÃO limpar arquivo de cookies aqui - será reutilizado nas próximas tentativas
        
        lastError = { error: error.message, strategy: strategy.name };
        reject(lastError);
      });
    });
  };
  
  // Tentar download com Android Client (única estratégia)
  let downloadResult = null;
  let formats = []; // Declarar formats no escopo correto
  
  try {
    downloadResult = await tryDownloadWithStrategy(strategy);
    console.log(`[DOWNLOAD] ✅ Download bem-sucedido com Android Client`);
  } catch (error) {
    console.warn(`[DOWNLOAD] ❌ Android Client falhou:`, error.code || error.error);
    lastError = error;
  }
  
  // Se Android Client falhou, tentar listar e testar formatos disponíveis com Android Client
  if (!downloadResult) {
    console.log('[DOWNLOAD] 🔄 Android Client falhou. Listando formatos disponíveis...');
    
    // Listar formatos com Android Client
    formats = await listAvailableFormats(cleanUrl, strategy).catch(() => []);
    
    if (formats.length > 0) {
      // Testar apenas os TOP 5 formatos (mais rápidos)
      const topFormats = formats.slice(0, 5);
      
      console.log(`[DOWNLOAD] 📋 Testando ${topFormats.length} melhores formatos com Android Client...`);
      
      // Testar formatos sequencialmente
      for (const format of topFormats) {
        try {
          res.write(`data: ${JSON.stringify({
            progress: 0,
            status: 'testing',
            state: 'testing',
            message: `Testando formato ${format.id} (${format.resolution})...`
          })}\n\n`);
          
          const result = await tryDownloadWithFormat(cleanUrl, outputTemplate, format.id, strategy);
          
          if (result.success) {
            console.log(`[DOWNLOAD] ✅ SUCESSO com formato ${format.id} usando Android Client!`);
            downloadResult = {
              success: true,
              strategy: `Android Client (formato ${format.id})`,
              filePath: result.filePath
            };
            break; // Parar se encontrou um que funciona
          }
        } catch (error) {
          console.warn(`[DOWNLOAD] ⚠️ Formato ${format.id} falhou:`, error.code || error.error);
          lastError = error;
          // Continuar para próximo formato
        }
      }
    }
    
    // Se ainda falhou e é erro 403, tentar estratégia alternativa sem cookies primeiro
    if (!downloadResult && lastError?.stderr && (lastError.stderr.includes('403') || lastError.stderr.includes('Forbidden'))) {
      console.log('[DOWNLOAD] 🔄 Erro 403 detectado. Tentando estratégia alternativa...');
      
      res.write(`data: ${JSON.stringify({
        progress: 0,
        status: 'retrying',
        state: 'retrying',
        message: 'Tentando estratégia alternativa para contornar bloqueio 403...'
      })}\n\n`);
      
      // Tentar com formato mais simples e sem alguns headers que podem causar bloqueio
      try {
        const cookiesPath = createCookiesFile();
        const userAgent = getUserAgent();
        
        const simpleFormatArgs = [
          "-f", "18", // Formato 18 é mais compatível (360p mp4)
          "--no-playlist",
          "--no-warnings",
          "--newline",
          ...(cookiesPath ? ["--cookies", cookiesPath] : []),
          "--user-agent", userAgent,
          "--referer", "https://www.youtube.com/",
          "--extractor-args", "youtube:player_client=android",
          "--no-check-certificate",
          "--retries", "2",
          "--fragment-retries", "2",
          "--socket-timeout", "20",
          "-4",
          "-o", outputTemplate,
          cleanUrl
        ];
        
        const { executable, args } = buildYtDlpArgs(simpleFormatArgs);
        const ytdlp = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        
        let stderr = "";
        let stdout = "";
        let hasResolved = false;
        
        const timeout = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            ytdlp.kill();
          }
        }, 60000);
        
        ytdlp.stderr.on("data", (data) => {
          stderr += data.toString();
          const progressMatch = data.toString().match(/\[download\]\s+(\d{1,3}\.\d+)%/i);
          if (progressMatch) {
            const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
            res.write(`data: ${JSON.stringify({
              progress: percent,
              status: "downloading",
              state: "downloading",
              message: `Baixando (estratégia alternativa)... ${percent.toFixed(1)}%`
            })}\n\n`);
          }
        });
        
        ytdlp.stdout.on("data", (data) => {
          stdout += data.toString();
        });
        
        ytdlp.on("close", (code) => {
          clearTimeout(timeout);
          if (hasResolved) return;
          hasResolved = true;
          
          if (code === 0) {
            const possibleExtensions = ['mp4', 'webm', 'mkv', 'm4a'];
            const uploadsDir = path.dirname(outputTemplate.replace('%(ext)s', 'mp4'));
            const videoId = path.basename(outputTemplate, '.%(ext)s');
            
            for (const ext of possibleExtensions) {
              const testPath = path.join(uploadsDir, `${videoId}.${ext}`);
              if (fs.existsSync(testPath)) {
                const stats = fs.statSync(testPath);
                if (stats.size > 0) {
                  downloadResult = {
                    success: true,
                    strategy: 'Android Client (estratégia alternativa)',
                    filePath: testPath
                  };
                  console.log(`[DOWNLOAD] ✅ SUCESSO com estratégia alternativa!`);
                  break;
                }
              }
            }
          }
          
          if (!downloadResult) {
            lastError = { code, stderr, stdout, strategy: 'estratégia alternativa' };
          }
        });
        
        ytdlp.on("error", (error) => {
          clearTimeout(timeout);
          if (hasResolved) return;
          hasResolved = true;
          lastError = { error: error.message, strategy: 'estratégia alternativa' };
        });
        
        // Aguardar resultado
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (hasResolved) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 65000);
        });
      } catch (altError) {
        console.warn(`[DOWNLOAD] ⚠️ Estratégia alternativa falhou:`, altError.message);
        lastError = altError;
      }
    }
    
    // Se ainda não funcionou após testar todos os formatos
    if (!downloadResult) {
      // Limpar arquivo de cookies apenas no final se todas as estratégias falharam
      if (cookiesPathCache && fs.existsSync(cookiesPathCache)) {
        try {
          fs.unlinkSync(cookiesPathCache);
          console.log('[DOWNLOAD] Arquivo de cookies removido após falha de todas as estratégias');
        } catch (unlinkError) {
          console.warn('[DOWNLOAD] Erro ao remover cookies:', unlinkError.message);
        }
        cookiesPathCache = null;
        cookiesContentCache = null;
      }
      
      const errorMessage = parseYtDlpError(lastError?.stderr || lastError?.stdout || '', lastError?.code || 1);
      console.error(`[DOWNLOAD] ❌ Todos os formatos testados falharam. Último erro: ${errorMessage}`);
      if (formats && formats.length > 0) {
        console.error(`[DOWNLOAD] ❌ Total de formatos disponíveis: ${formats.length}, formatos testados: ${Math.min(formats.length, 5)}`);
      } else {
        console.error(`[DOWNLOAD] ❌ Nenhum formato disponível foi encontrado`);
      }
      
      res.write(`data: ${JSON.stringify({
        success: false,
        error: `Nenhum formato disponível funcionou. ${errorMessage}`,
        state: "error"
      })}\n\n`);
      res.end();
      return;
    }
  }
  
  // Limpar arquivo de cookies após sucesso
  if (cookiesPathCache && fs.existsSync(cookiesPathCache)) {
    try {
      fs.unlinkSync(cookiesPathCache);
      console.log('[DOWNLOAD] Arquivo de cookies removido após download bem-sucedido');
    } catch (unlinkError) {
      console.warn('[DOWNLOAD] Erro ao remover cookies:', unlinkError.message);
    }
    cookiesPathCache = null;
    cookiesContentCache = null;
  }
  
  // Download foi bem-sucedido, processar resultado
  console.log(`[DOWNLOAD] Vídeo baixado com sucesso usando estratégia: ${downloadResult.strategy}`);
  
  // Usar arquivo baixado encontrado pelo worker, ou fallback para outputPath
  const finalOutputPath = downloadResult.filePath || outputPath;

  // Verificar se arquivo foi criado com sucesso
  if (!fs.existsSync(finalOutputPath)) {
    const errorMessage = "Arquivo não foi criado após download. Tente novamente.";
    console.error(`[DOWNLOAD] ${errorMessage}`);
    
    res.write(`data: ${JSON.stringify({
      success: false,
      error: errorMessage,
      state: "error"
    })}\n\n`);
    res.end();
    return;
  }

  // Verificar tamanho do arquivo
  let fileSize = 0;
  try {
    const stats = fs.statSync(finalOutputPath);
    fileSize = stats.size;
    
    if (fileSize === 0) {
      const errorMessage = "Arquivo baixado está vazio. O vídeo pode estar corrompido.";
      console.error(`[DOWNLOAD] ${errorMessage}`);
      
      if (fs.existsSync(finalOutputPath)) {
        try {
          fs.unlinkSync(finalOutputPath);
        } catch (unlinkError) {
          console.error(`[DOWNLOAD] Erro ao remover arquivo vazio: ${unlinkError.message}`);
        }
      }
      
      res.write(`data: ${JSON.stringify({
        success: false,
        error: errorMessage,
        state: "error"
      })}\n\n`);
      res.end();
      return;
    }
    
    console.log(`[DOWNLOAD] Arquivo criado: ${finalOutputPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  } catch (statError) {
    const errorMessage = `Erro ao verificar arquivo: ${statError.message}`;
    console.error(`[DOWNLOAD] ${errorMessage}`);
    
    res.write(`data: ${JSON.stringify({
      success: false,
      error: errorMessage,
      state: "error"
    })}\n\n`);
    res.end();
    return;
  }

  // Obter duração
  console.log(`[DOWNLOAD] Obtendo duração...`);
  const duration = await getVideoDuration(finalOutputPath);

  // Salvar no store
  const videoData = {
    id: videoId,
    path: finalOutputPath,
    duration: duration,
    fileSize: fileSize,
    youtubeUrl: cleanUrl,
    downloadedAt: new Date()
  };
  videoStore.set(videoId, videoData);

  // Inicializar estado do vídeo (para o trim controller)
  initVideoState(videoId);
  updateVideoState(videoId, {
    state: VIDEO_STATES.READY,
    progress: 100,
    metadata: videoData
  });

  console.log(`[DOWNLOAD] Download concluído: ${videoId} (${duration}s, ${(fileSize / 1024 / 1024).toFixed(2)} MB) usando estratégia: ${downloadResult.strategy}`);

  // Evento de conclusão (enviar como mensagem padrão)
  res.write(`data: ${JSON.stringify({
    success: true,
    completed: true,
    ready: true,
    state: "ready",
    videoId: videoId,
    duration: duration,
    videoDuration: duration,
    playableUrl: `/api/youtube/play/${videoId}`,
    progress: 100
  })}\n\n`);

  res.end();
  
  } catch (error) {
    console.error(`[DOWNLOAD] Erro fatal: ${error.message}`, error);
    try {
      if (!res.headersSent) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive"
        });
      }
      res.write(`data: ${JSON.stringify({
        success: false,
        error: `Erro ao iniciar download: ${error.message}`,
        state: "error"
      })}\n\n`);
      res.end();
    } catch (e) {
      // Se já fechou, não há o que fazer
    }
  }
}

export function getVideoState(req, res) {
  try {
    const video = videoStore.get(req.params.videoId);

    if (!video) {
      return res.json({ 
        success: false, 
        ready: false,
        state: "not_found"
      });
    }

    // Verificar se arquivo ainda existe
    if (!fs.existsSync(video.path)) {
      videoStore.delete(req.params.videoId);
      return res.json({
        success: false,
        ready: false,
        state: "file_not_found",
        error: "Arquivo de vídeo não encontrado no disco"
      });
    }

    return res.json({
      success: true,
      ready: true,
      state: "ready",
      duration: video.duration || 0,
      videoDuration: video.duration || 0,
      playableUrl: `/api/youtube/play/${video.id}`
    });
  } catch (error) {
    console.error('[STATE] Erro:', error);
    return res.status(500).json({
      success: false,
      ready: false,
      state: "error",
      error: error.message
    });
  }
}

/**
 * Download de vídeo do YouTube SEM ÁUDIO (apenas vídeo)
 * Usado para vídeos de retenção
 * @param {string} youtubeUrl - URL do YouTube
 * @param {string} outputPath - Caminho de saída
 * @returns {Promise<string>} - Caminho do arquivo baixado
 */
export async function downloadYouTubeVideoNoAudio(youtubeUrl, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`[DOWNLOAD-NO-AUDIO] Iniciando download sem áudio: ${youtubeUrl}`);
      
      // Detectar comando yt-dlp
      await detectYtDlpCommand();
      
      // Criar arquivo de cookies se disponível
      const cookiesPath = createCookiesFile();
      const finalUserAgent = getUserAgent();
      
      // Formato: APENAS vídeo, SEM áudio
      // bestvideo[height<=1080] - melhor vídeo até 1080p, sem áudio
      const formatSelector = "bestvideo[height<=1080]/bestvideo/best[height<=1080]";
      
      const downloadArgs = [
        "-f", formatSelector, // Apenas vídeo, sem áudio
        "--no-playlist",
        "--no-warnings",
        "--newline",
        // Cookies e User-Agent
        ...(cookiesPath ? ["--cookies", cookiesPath] : []),
        "--user-agent", finalUserAgent,
        "--referer", "https://www.youtube.com/",
        // Usar Android Client (mais confiável)
        "--extractor-args", "youtube:player_client=android",
        "--no-check-certificate",
        "--retries", "3",
        "--fragment-retries", "3",
        "--file-access-retries", "3",
        "--sleep-requests", "1",
        "-4",
        "-o", outputPath,
        youtubeUrl
      ];
      
      const { executable, args } = buildYtDlpArgs(downloadArgs);
      
      console.log(`[DOWNLOAD-NO-AUDIO] Comando: ${executable} ${args.join(' ')}`);
      
      const ytdlp = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      
      let stderr = "";
      let stdout = "";
      
      ytdlp.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      ytdlp.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      ytdlp.on("close", (code) => {
        if (code === 0) {
          // Verificar se arquivo foi criado
          if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            if (stats.size > 0) {
              console.log(`[DOWNLOAD-NO-AUDIO] ✅ Download concluído: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
              resolve(outputPath);
            } else {
              reject(new Error('Arquivo baixado está vazio'));
            }
          } else {
            reject(new Error('Arquivo não foi criado após download'));
          }
        } else {
          const errorMsg = parseYtDlpError(stderr, code);
          console.error(`[DOWNLOAD-NO-AUDIO] ❌ Erro: ${errorMsg}`);
          reject(new Error(errorMsg));
        }
      });
      
      ytdlp.on("error", (error) => {
        console.error(`[DOWNLOAD-NO-AUDIO] ❌ Erro ao executar: ${error.message}`);
        reject(error);
      });
    } catch (error) {
      console.error(`[DOWNLOAD-NO-AUDIO] ❌ Erro fatal: ${error.message}`);
      reject(error);
    }
  });
}
