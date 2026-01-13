/**
 * SERVICE YOUTUBE ESTÁVEL - Usa yt-dlp CLI
 * NÃO usa bibliotecas npm, apenas yt-dlp binário do sistema
 * 
 * Melhorias:
 * - Cache de informações de vídeos para evitar requisições repetidas
 * - Múltiplas estratégias com diferentes User-Agents (iOS, Android, Desktop)
 * - Retry logic com diferentes métodos quando ocorrer erro 403
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Cache de informações de vídeos (em memória)
 * Estrutura: { videoId: { metadata, timestamp } }
 * Cache expira após 1 hora
 */
const videoInfoCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora em milissegundos

/**
 * Estratégias de download com diferentes User-Agents e extractors
 */
const downloadStrategies = [
  {
    name: 'ios',
    userAgent: 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
    extractor: 'youtube',
    args: ['--user-agent', 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)']
  },
  {
    name: 'android',
    userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    extractor: 'youtube',
    args: ['--user-agent', 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip']
  },
  {
    name: 'desktop',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    extractor: 'youtube',
    args: ['--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36']
  },
  {
    name: 'default',
    userAgent: null,
    extractor: 'youtube',
    args: []
  }
];

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
 * Verifica se yt-dlp está disponível
 * Tenta diferentes caminhos possíveis
 */
async function checkYtDlpAvailable() {
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
        
        proc.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        proc.stderr.on('data', (data) => {
          output += data.toString();
        });
        
        proc.on('close', (code) => {
          if (code === 0 || output.includes('yt-dlp')) {
            const fullCmd = args.includes('-m') ? `${cmd} -m yt_dlp` : cmd;
            console.log(`[YT-DLP] ✅ Encontrado: ${fullCmd}`);
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        proc.on('error', (error) => {
          resolve(false);
        });
        
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill();
            resolve(false);
          }
        }, 3000);
      } catch (error) {
        resolve(false);
      }
    });

    if (available) {
      // Retornar comando completo para uso posterior
      if (args.includes('-m')) {
        return { available: true, command: `${cmd} -m yt_dlp` };
      } else {
        return { available: true, command: cmd };
      }
    }
  }

  console.error('[YT-DLP] ❌ Não encontrado em nenhum dos caminhos testados');
  return { available: false, command: 'yt-dlp' };
}

/**
 * Obtém metadata do vídeo do cache se disponível
 */
function getCachedVideoInfo(videoId) {
  const cached = videoInfoCache.get(videoId);
  if (cached) {
    const age = Date.now() - cached.timestamp;
    if (age < CACHE_TTL) {
      console.log(`[CACHE] Info encontrada no cache para: ${videoId} (idade: ${Math.floor(age / 1000)}s)`);
      return cached.metadata;
    } else {
      // Cache expirado, remover
      videoInfoCache.delete(videoId);
      console.log(`[CACHE] Cache expirado para: ${videoId}`);
    }
  }
  return null;
}

/**
 * Salva metadata do vídeo no cache
 */
function setCachedVideoInfo(videoId, metadata) {
  videoInfoCache.set(videoId, {
    metadata,
    timestamp: Date.now()
  });
  console.log(`[CACHE] Info salva no cache para: ${videoId}`);
}

/**
 * Tenta obter informações do vídeo usando uma estratégia específica
 */
async function tryGetVideoInfoWithStrategy(url, strategy, ytDlpCommand) {
  return new Promise((resolve, reject) => {
    // Preparar comando e argumentos baseado no tipo de comando
    let executable, args;
    const baseArgs = [
      '--dump-json',
      '--no-warnings',
      '--no-playlist',
      ...strategy.args,
      url
    ];

    if (ytDlpCommand.includes('python') && ytDlpCommand.includes('-m')) {
      // Formato: "python3 -m yt_dlp"
      const parts = ytDlpCommand.split(' ');
      executable = parts[0]; // python3
      args = parts.slice(1).concat(baseArgs); // ['-m', 'yt_dlp'] + baseArgs
    } else {
      // Formato: "yt-dlp" (binário direto)
      executable = ytDlpCommand;
      args = baseArgs;
    }

    console.log(`[YT-DLP] Tentando estratégia "${strategy.name}": ${executable} ${args.join(' ')}`);
    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    let stdout = '';
    let stderr = '';
    let timeoutId = null;

    // Timeout de 30 segundos por tentativa
    timeoutId = setTimeout(() => {
      if (!process.killed) {
        process.kill();
        reject(new Error('Timeout na requisição'));
      }
    }, 30000);

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      clearTimeout(timeoutId);
      
      if (code !== 0) {
        const errorMsg = stderr.slice(0, 500);
        const is403 = code === 1 && (
          stderr.includes('403') || 
          stderr.includes('Forbidden') || 
          stderr.includes('HTTP Error 403') ||
          stderr.includes('Sign in to confirm your age')
        );
        
        if (is403) {
          reject(new Error('403_FORBIDDEN'));
        } else if (stderr.includes('Video unavailable')) {
          reject(new Error('Vídeo não disponível ou privado'));
        } else if (stderr.includes('Private video')) {
          reject(new Error('Vídeo privado'));
        } else {
          reject(new Error(`yt-dlp falhou: ${errorMsg}`));
        }
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve(info);
      } catch (parseError) {
        console.error(`[YT-DLP] Erro ao parsear JSON: ${parseError.message}`);
        reject(new Error('Resposta inválida do yt-dlp'));
      }
    });

    process.on('error', (error) => {
      clearTimeout(timeoutId);
      console.error(`[YT-DLP] Erro ao executar: ${error.message}`);
      reject(new Error('yt-dlp não encontrado no sistema'));
    });
  });
}

/**
 * Obtém metadata do vídeo usando yt-dlp CLI com JSON output
 * Implementa cache e múltiplas estratégias para evitar erro 403
 */
// Variável global para cache do comando yt-dlp
let ytDlpCommand = 'yt-dlp';

export async function getYouTubeVideoInfo(url) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-DLP] Obtendo info para: ${videoId}`);

  // Verificar cache primeiro
  const cached = getCachedVideoInfo(videoId);
  if (cached) {
    return cached;
  }

  // Verificar disponibilidade e cachear comando
  const checkResult = await checkYtDlpAvailable();
  if (!checkResult.available) {
    throw new Error('yt-dlp não está disponível no sistema. Verifique a instalação.');
  }
  ytDlpCommand = checkResult.command;

  // Tentar cada estratégia até uma funcionar
  let lastError = null;
  for (const strategy of downloadStrategies) {
    try {
      console.log(`[YT-DLP] Tentando estratégia: ${strategy.name}`);
      const info = await tryGetVideoInfoWithStrategy(url, strategy, ytDlpCommand);
      
      // Sucesso! Processar e cachear
      const metadata = {
        videoId: info.id || videoId,
        title: info.title || 'Sem título',
        duration: Math.floor(info.duration || 0),
        thumbnail: info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        author: info.uploader || info.channel || 'Desconhecido',
        viewCount: info.view_count || 0,
        description: info.description || ''
      };

      console.log(`[YT-DLP] ✅ Info obtida com estratégia "${strategy.name}": ${metadata.title} (${metadata.duration}s)`);
      
      // Salvar no cache
      setCachedVideoInfo(videoId, metadata);
      
      return metadata;
    } catch (error) {
      lastError = error;
      
      // Se não for erro 403, não tentar outras estratégias
      if (error.message !== '403_FORBIDDEN' && !error.message.includes('403')) {
        console.error(`[YT-DLP] Erro não recuperável com estratégia "${strategy.name}": ${error.message}`);
        throw error;
      }
      
      console.warn(`[YT-DLP] ⚠️ Estratégia "${strategy.name}" falhou (403), tentando próxima...`);
      
      // Aguardar um pouco antes de tentar próxima estratégia
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Todas as estratégias falharam
  console.error(`[YT-DLP] ❌ Todas as estratégias falharam para: ${videoId}`);
  throw new Error('YouTube bloqueou o acesso (403). Isso pode ser temporário. Tente novamente em alguns minutos ou verifique se o vídeo está disponível. Se persistir, atualize: python3 -m pip install --upgrade yt-dlp');
}

/**
 * Tenta fazer download usando uma estratégia específica
 */
async function tryDownloadWithStrategy(url, outputPath, strategy, ytDlpCommand) {
  return new Promise((resolve, reject) => {
    // Preparar comando e argumentos baseado no tipo de comando
    let executable, args;
    const baseArgs = [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--no-warnings',
      ...strategy.args,
      '-o', outputPath,
      url
    ];

    if (ytDlpCommand.includes('python') && ytDlpCommand.includes('-m')) {
      // Formato: "python3 -m yt_dlp"
      const parts = ytDlpCommand.split(' ');
      executable = parts[0]; // python3
      args = parts.slice(1).concat(baseArgs); // ['-m', 'yt_dlp'] + baseArgs
    } else {
      // Formato: "yt-dlp" (binário direto)
      executable = ytDlpCommand;
      args = baseArgs;
    }

    console.log(`[YT-DLP] Executando download com estratégia "${strategy.name}": ${executable} ${args.join(' ')}`);
    const process = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      // Log progresso básico
      if (data.toString().includes('[download]')) {
        console.log(`[YT-DLP] ${data.toString().trim()}`);
      }
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      // yt-dlp envia progresso no stderr também
      if (data.toString().includes('[download]')) {
        console.log(`[YT-DLP] ${data.toString().trim()}`);
      }
    });

    process.on('close', (code) => {
      if (code !== 0) {
        const errorMsg = stderr.slice(-500);
        const is403 = code === 1 && (
          stderr.includes('403') || 
          stderr.includes('Forbidden') || 
          stderr.includes('HTTP Error 403') ||
          stderr.includes('Sign in to confirm your age')
        );
        
        if (is403) {
          reject(new Error('403_FORBIDDEN'));
        } else {
          reject(new Error(`Download falhou: ${errorMsg.slice(-300)}`));
        }
        return;
      }

      // Validar arquivo foi criado
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

      console.log(`[YT-DLP] ✅ Download concluído com estratégia "${strategy.name}": ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      resolve(outputPath);
    });

    process.on('error', (error) => {
      console.error(`[YT-DLP] Erro ao executar: ${error.message}`);
      reject(new Error('yt-dlp não encontrado no sistema'));
    });
  });
}

/**
 * Download de vídeo usando yt-dlp CLI
 * Retorna caminho do arquivo baixado
 * Implementa múltiplas estratégias para evitar erro 403
 */
export async function downloadYouTubeVideo(url, outputPath) {
  const videoId = validateYouTubeUrl(url);
  console.log(`[YT-DLP] Download: ${videoId} -> ${outputPath}`);

  // Verificar disponibilidade e cachear comando se necessário
  const checkResult = await checkYtDlpAvailable();
  if (!checkResult.available) {
    throw new Error('yt-dlp não está disponível no sistema. Verifique a instalação.');
  }
  if (checkResult.command) {
    ytDlpCommand = checkResult.command;
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

  // Tentar cada estratégia até uma funcionar
  let lastError = null;
  for (const strategy of downloadStrategies) {
    try {
      console.log(`[YT-DLP] Tentando download com estratégia: ${strategy.name}`);
      const result = await tryDownloadWithStrategy(url, outputPath, strategy, ytDlpCommand);
      return result;
    } catch (error) {
      lastError = error;
      
      // Se não for erro 403, não tentar outras estratégias
      if (error.message !== '403_FORBIDDEN' && !error.message.includes('403')) {
        console.error(`[YT-DLP] Erro não recuperável com estratégia "${strategy.name}": ${error.message}`);
        throw error;
      }
      
      console.warn(`[YT-DLP] ⚠️ Estratégia "${strategy.name}" falhou (403), tentando próxima...`);
      
      // Limpar arquivo parcial se existir
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (unlinkError) {
          // Ignorar erro ao remover
        }
      }
      
      // Aguardar um pouco antes de tentar próxima estratégia
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Todas as estratégias falharam
  console.error(`[YT-DLP] ❌ Todas as estratégias de download falharam para: ${videoId}`);
  throw new Error('YouTube bloqueou o acesso (403). Isso pode ser temporário. Tente novamente em alguns minutos ou verifique se o vídeo está disponível. Se persistir, atualize: python3 -m pip install --upgrade yt-dlp');
}

