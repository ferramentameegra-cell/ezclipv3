/**
 * CONTROLLER DE DOWNLOAD COM PROGRESSO SSE
 * Corrigido com tratamento de erros específicos e mensagens claras
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const videoStore = new Map();

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
          resolve(code === 0 || output.includes('yt-dlp'));
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
      if (args.includes('-m')) {
        ytDlpCommandCache = { executable: cmd, useModule: true };
      } else {
        ytDlpCommandCache = { executable: cmd, useModule: false };
      }
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
  
  if (errorLower.includes('sign in to confirm') || errorLower.includes('age-restricted')) {
    return 'Este vídeo requer confirmação de idade. Não é possível baixar automaticamente.';
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
  const outputPath = path.join(uploadsDir, `${videoId}.mp4`);

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
        // Se falhar, tentar python3 -m yt_dlp
        const testProc2 = spawn('python3', ['-m', 'yt_dlp', '--version'], { stdio: 'pipe' });
        testProc2.on('close', (code) => resolve(code === 0));
        testProc2.on('error', () => resolve(false));
        setTimeout(() => {
          if (!testProc2.killed) testProc2.kill();
          resolve(false);
        }, 2000);
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
  
  // Preparar argumentos do yt-dlp
  const downloadArgs = [
    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/mp4",
    "--merge-output-format", "mp4",
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "-o", outputPath,
    cleanUrl
  ];
  
  const { executable, args } = buildYtDlpArgs(downloadArgs);
  console.log(`[DOWNLOAD] Executando: ${executable} ${args.join(' ')}`);
  
  // Comando yt-dlp com formato seguro
  const ytdlp = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let lastProgress = 0;
  let stderr = "";
  let stdout = "";

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
          message: `Baixando... ${percent.toFixed(1)}%`
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
    console.log(`[DOWNLOAD] yt-dlp finalizou com código: ${code}`);

    // Limpar arquivo parcial em caso de erro
    const cleanupOnError = () => {
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
          console.log(`[DOWNLOAD] Arquivo parcial removido: ${outputPath}`);
        } catch (unlinkError) {
          console.error(`[DOWNLOAD] Erro ao remover arquivo parcial: ${unlinkError.message}`);
        }
      }
    };

    // Verificar código de saída
    if (code !== 0) {
      const errorMessage = parseYtDlpError(stderr, code);
      console.error(`[DOWNLOAD] Erro (code ${code}): ${errorMessage}`);
      console.error(`[DOWNLOAD] stderr: ${stderr.slice(-500)}`);
      
      cleanupOnError();
      
      // Enviar erro como mensagem padrão para garantir que frontend receba
      res.write(`data: ${JSON.stringify({
        success: false,
        error: errorMessage,
        state: "error"
      })}\n\n`);
      res.end();
      return;
    }

    // Verificar se arquivo foi criado
    if (!fs.existsSync(outputPath)) {
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
      const stats = fs.statSync(outputPath);
      fileSize = stats.size;
      
      if (fileSize === 0) {
        const errorMessage = "Arquivo baixado está vazio. O vídeo pode estar corrompido.";
        console.error(`[DOWNLOAD] ${errorMessage}`);
        
        cleanupOnError();
        
        res.write(`data: ${JSON.stringify({
          success: false,
          error: errorMessage,
          state: "error"
        })}\n\n`);
        res.end();
        return;
      }
      
      console.log(`[DOWNLOAD] Arquivo criado: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
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
    const duration = await getVideoDuration(outputPath);

    // Salvar no store
    videoStore.set(videoId, {
      id: videoId,
      path: outputPath,
      duration: duration,
      fileSize: fileSize,
      youtubeUrl: cleanUrl,
      downloadedAt: new Date()
    });

    console.log(`[DOWNLOAD] Download concluído: ${videoId} (${duration}s, ${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

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
  });

  // Erro ao executar yt-dlp
  ytdlp.on("error", (error) => {
    console.error(`[DOWNLOAD] Erro ao executar yt-dlp: ${error.message}`);
    
    let errorMessage = "yt-dlp não está disponível no sistema.";
    if (error.code === 'ENOENT') {
      errorMessage = "yt-dlp não foi encontrado. Verifique a instalação.";
    } else {
      errorMessage = `Erro ao executar yt-dlp: ${error.message}`;
    }
    
    try {
      res.write(`data: ${JSON.stringify({
        success: false,
        error: errorMessage,
        state: "error"
      })}\n\n`);
      res.end();
    } catch (writeError) {
      console.error(`[DOWNLOAD] Erro ao escrever resposta SSE: ${writeError.message}`);
      // Se já fechou a conexão, não podemos fazer nada
    }
  });

  // Timeout de segurança - fechar conexão se demorar muito
  const timeout = setTimeout(() => {
    try {
      // Verificar se conexão ainda está aberta
      if (res.headersSent && !res.closed) {
        console.error(`[DOWNLOAD] Timeout após 30 segundos`);
        res.write(`data: ${JSON.stringify({
          success: false,
          error: "Timeout: Download demorou muito para iniciar. Tente novamente.",
          state: "error"
        })}\n\n`);
        res.end();
      }
    } catch (e) {
      // Ignorar se já fechou
      console.warn(`[DOWNLOAD] Erro ao enviar timeout: ${e.message}`);
    }
  }, 30000); // 30 segundos

  // Limpar timeout quando conexão fechar
  res.on('close', () => {
    console.log(`[DOWNLOAD] Conexão SSE fechada pelo cliente`);
    clearTimeout(timeout);
    if (!ytdlp.killed) {
      ytdlp.kill();
    }
  });
  
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
