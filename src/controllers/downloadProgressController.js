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
  
  if (errorLower.includes('sign in to confirm') || errorLower.includes('sign in to confirm you\'re not a bot') || errorLower.includes('bot')) {
    return 'YouTube detectou acesso automatizado. Configure cookies do navegador na variável YTDLP_COOKIES para contornar. Veja: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp';
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
  
  // ESTRATÉGIAS MÚLTIPLAS PARA CONTORNAR ERRO 403
  // Tentar com diferentes clientes do YouTube em ordem de prioridade
  // Ordem baseada em taxa de sucesso: iOS > Mweb > Android > TV > Web
  const strategies = [
    {
      name: 'iOS Client (Mais confiável)',
      extractorArgs: 'youtube:player_client=ios',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      additionalArgs: []
    },
    {
      name: 'Mweb Client (Mobile Web)',
      extractorArgs: 'youtube:player_client=mweb',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      additionalArgs: []
    },
    {
      name: 'Android Client',
      extractorArgs: 'youtube:player_client=android',
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      additionalArgs: []
    },
    {
      name: 'Android Embedded',
      extractorArgs: 'youtube:player_client=android_embedded',
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      additionalArgs: []
    },
    {
      name: 'TV Embedded',
      extractorArgs: 'youtube:player_client=tv_embedded',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      additionalArgs: []
    },
    {
      name: 'Web Client (Fallback)',
      extractorArgs: 'youtube:player_client=web',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      additionalArgs: []
    }
  ];
  
  // Tentar cada estratégia sequencialmente
  let strategyIndex = 0;
  let lastError = null;
  
  const tryDownloadWithStrategy = async (strategy) => {
    return new Promise((resolve, reject) => {
      console.log(`[DOWNLOAD] Tentando estratégia: ${strategy.name}`);
      
      // Criar arquivo de cookies se disponível (solução para erro 403)
      const cookiesPath = createCookiesFile();
      const userAgentFromEnv = getUserAgent();
      
      // Priorizar User-Agent da variável de ambiente, senão usar da estratégia
      const finalUserAgent = process.env.YTDLP_USER_AGENT || strategy.userAgent;
      
      if (cookiesPath) {
        console.log('[DOWNLOAD] ✅ Usando cookies de variável de ambiente (YTDLP_COOKIES)');
        console.log('[DOWNLOAD] ✅ Caminho do arquivo de cookies:', cookiesPath);
        // Verificar tamanho do arquivo
        try {
          const stats = fs.statSync(cookiesPath);
          console.log('[DOWNLOAD] ✅ Tamanho do arquivo de cookies:', stats.size, 'bytes');
        } catch (e) {
          console.warn('[DOWNLOAD] ⚠️ Erro ao verificar arquivo de cookies:', e.message);
        }
      } else {
        console.warn('[DOWNLOAD] ⚠️ Nenhum cookie configurado (YTDLP_COOKIES não definido)');
        console.warn('[DOWNLOAD] ⚠️ Configure a variável YTDLP_COOKIES no Railway para evitar detecção de bot');
      }
      
      console.log('[DOWNLOAD] User-Agent:', finalUserAgent.substring(0, 50) + '...');
      
      // Preparar argumentos do yt-dlp com a estratégia atual
      // Formato MÁXIMA flexibilidade: usar formato selector que aceita QUALQUER formato
      // Permitir vídeo+áudio mesclados (m3u8) ou separados (webm, mp4)
      // Combinar extractor-args da estratégia com skip=dash para melhor performance
      const extractorArgsCombined = `${strategy.extractorArgs},youtube:skip=dash`;
      
      const downloadArgs = [
        "-f", "bestvideo+bestaudio/best", // Tentar melhor vídeo+áudio, senão melhor formato geral
        "--merge-output-format", "mp4", // Se precisar mergear, usar mp4
        "--no-playlist",
        "--no-warnings",
        "--newline",
        // Cookies e User-Agent (solução para erro 403 e restrição de idade)
        ...(cookiesPath ? ["--cookies", cookiesPath] : []),
        "--user-agent", finalUserAgent,
        "--referer", "https://www.youtube.com/",
        // Usar cliente específico da estratégia + skip=dash
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
  
  // Tentar cada estratégia sequencialmente até uma funcionar
  let downloadResult = null;
  for (const strategy of strategies) {
    try {
      downloadResult = await tryDownloadWithStrategy(strategy);
      console.log(`[DOWNLOAD] ✅ Download bem-sucedido com estratégia: ${strategy.name}`);
      break; // Sucesso, parar tentativas
    } catch (error) {
      console.warn(`[DOWNLOAD] ❌ Estratégia ${strategy.name} falhou:`, error.code || error.error);
      lastError = error;
      
      // Se ainda há estratégias para tentar, continuar
      if (strategies.indexOf(strategy) < strategies.length - 1) {
        console.log(`[DOWNLOAD] Tentando próxima estratégia em 2 segundos...`);
        // Delay maior entre tentativas para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Limpar cache entre tentativas
        try {
          const cmd = ytDlpCommandCache || { executable: 'python3', useModule: true };
          const clearCacheProc = spawn(
            cmd.useModule ? cmd.executable : 'python3',
            cmd.useModule ? ['-m', 'yt_dlp', '--rm-cache-dir'] : ['--rm-cache-dir'],
            { stdio: 'ignore' }
          );
          clearCacheProc.on('close', () => {
            console.log('[DOWNLOAD] Cache limpo entre tentativas');
          });
          setTimeout(() => {
            if (!clearCacheProc.killed) clearCacheProc.kill();
          }, 1000);
        } catch (cacheError) {
          // Ignorar erro de limpeza de cache
        }
        
        continue;
      }
    }
  }
  
  // Se nenhuma estratégia funcionou
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
    
    const errorMessage = parseYtDlpError(lastError?.stderr || '', lastError?.code || 1);
    console.error(`[DOWNLOAD] ❌ Todas as estratégias falharam. Último erro: ${errorMessage}`);
    
    res.write(`data: ${JSON.stringify({
      success: false,
      error: errorMessage,
      state: "error"
    })}\n\n`);
    res.end();
    return;
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
