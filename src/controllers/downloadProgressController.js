/**
 * CONTROLLER DE DOWNLOAD COM PROGRESSO SSE
 * Corrigido para usar yt-dlp CLI, validar arquivo e obter duração via ffprobe
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Store de vídeos em memória (compartilhado com outros controllers se necessário)
export const videoStore = new Map();

function sanitizeYouTubeUrl(url) {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (!v) return null;
    return `https://www.youtube.com/watch?v=${v}`;
  } catch {
    // Tentar padrão youtu.be
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") {
        return url;
      }
    } catch {
      return null;
    }
    return null;
  }
}

/**
 * Obter duração do vídeo usando ffprobe
 * RETORNA 0 se falhar (não deve bloquear)
 */
async function getVideoDuration(filePath) {
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
            const info = JSON.parse(stdout);
            const duration = parseFloat(info.format?.duration || 0);
            if (duration > 0) {
              console.log(`[FFPROBE] Duração obtida: ${Math.floor(duration)}s`);
              resolve(Math.floor(duration));
              return;
            }
          } catch (parseError) {
            console.error(`[FFPROBE] Erro ao parsear JSON: ${parseError.message}`);
          }
        } else {
          console.error(`[FFPROBE] Erro (code ${code}): ${stderr.slice(0, 200)}`);
        }
        // Se falhar, retornar 0 (não bloquear)
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

export function downloadWithProgress(req, res) {
  const cleanUrl = sanitizeYouTubeUrl(req.query.url);

  if (!cleanUrl) {
    res.status(400).json({ 
      error: "URL do YouTube inválida",
      status: "error",
      state: "error"
    });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Desabilitar buffering no nginx/proxy
  res.flushHeaders();

  // Criar diretório de uploads
  const uploadsDir = "/tmp/uploads";
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Gerar ID único e caminho do arquivo
  const videoId = uuidv4();
  const outputPath = path.join(uploadsDir, `${videoId}.mp4`);

  console.log(`[DOWNLOAD] Iniciando download: ${cleanUrl} -> ${outputPath}`);

  // Comando yt-dlp SEGURO e COMPATÍVEL
  // Formato: melhor vídeo mp4 + melhor áudio m4a, merge para mp4
  // Se não disponível, usar qualquer formato mp4 disponível
  const ytdlp = spawn("yt-dlp", [
    "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/mp4",
    "--merge-output-format", "mp4",
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "-o", outputPath,
    cleanUrl
  ]);

  let lastProgress = 0;
  let errorOutput = "";

  // yt-dlp envia progresso no STDERR
  ytdlp.stderr.on("data", (data) => {
    const text = data.toString();
    errorOutput += text;

    // Exemplo: [download]  12.3% of 45.67MiB at 2.34MiB/s ETA 00:15
    const progressMatch = text.match(/\[download\]\s+(\d{1,3}\.\d+)%/);
    
    if (progressMatch) {
      const percent = Math.min(100, Math.max(0, parseFloat(progressMatch[1])));
      if (percent > lastProgress) {
        lastProgress = percent;
        res.write(
          `data: ${JSON.stringify({
            status: "downloading",
            progress: percent,
            message: `Baixando... ${percent.toFixed(1)}%`
          })}\n\n`
        );
      }
    }
  });

  ytdlp.on("close", async (code) => {
    if (code !== 0) {
      const errorMsg = errorOutput.slice(-500) || "yt-dlp falhou sem mensagem";
      console.error(`[DOWNLOAD] yt-dlp falhou (code ${code}): ${errorMsg}`);
      
      // Limpar arquivo parcial se existir
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (unlinkError) {
          console.error(`[DOWNLOAD] Erro ao remover arquivo parcial: ${unlinkError.message}`);
        }
      }

      res.write(
        `data: ${JSON.stringify({
          status: "error",
          state: "error",
          error: `Erro ao baixar vídeo: ${errorMsg.slice(0, 200)}`,
          progress: 0
        })}\n\n`
      );
      res.end();
      return;
    }

    // Validar arquivo foi criado
    if (!fs.existsSync(outputPath)) {
      console.error(`[DOWNLOAD] Arquivo não foi criado: ${outputPath}`);
      res.write(
        `data: ${JSON.stringify({
          status: "error",
          state: "error",
          error: "Arquivo não foi criado após download",
          progress: 0
        })}\n\n`
      );
      res.end();
      return;
    }

    // Validar tamanho do arquivo
    let fileSize = 0;
    try {
      const stats = fs.statSync(outputPath);
      fileSize = stats.size;
      
      if (fileSize === 0) {
        console.error(`[DOWNLOAD] Arquivo está vazio: ${outputPath}`);
        fs.unlinkSync(outputPath);
        res.write(
          `data: ${JSON.stringify({
            status: "error",
            state: "error",
            error: "Arquivo baixado está vazio",
            progress: 0
          })}\n\n`
        );
        res.end();
        return;
      }
    } catch (statError) {
      console.error(`[DOWNLOAD] Erro ao verificar arquivo: ${statError.message}`);
      res.write(
        `data: ${JSON.stringify({
          status: "error",
          state: "error",
          error: `Erro ao validar arquivo: ${statError.message}`,
          progress: 0
        })}\n\n`
      );
      res.end();
      return;
    }

    console.log(`[DOWNLOAD] Arquivo baixado: ${outputPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // Obter duração com ffprobe (OBRIGATÓRIO)
    console.log(`[DOWNLOAD] Obtendo duração com ffprobe...`);
    const duration = await getVideoDuration(outputPath);

    if (duration === 0) {
      console.warn(`[DOWNLOAD] ⚠️  Duração não pôde ser obtida. Trim pode não funcionar corretamente.`);
    }

    // Salvar informações do vídeo no store
    const videoInfo = {
      id: videoId,
      youtubeUrl: cleanUrl,
      path: outputPath,
      duration: duration,
      fileSize: fileSize,
      downloadedAt: new Date(),
      state: "ready"
    };

    videoStore.set(videoId, videoInfo);

    // Extrair video ID do YouTube da URL
    let youtubeVideoId = null;
    try {
      const urlObj = new URL(cleanUrl);
      youtubeVideoId = urlObj.searchParams.get("v") || urlObj.pathname.slice(1);
    } catch {
      // Ignorar erro de parsing
    }

    console.log(`[DOWNLOAD] Download concluído: ${videoId} (${duration}s)`);

    // Enviar mensagem de conclusão no formato esperado pelo frontend
    res.write(
      `data: ${JSON.stringify({
        completed: true,
        videoId: videoId,
        ready: true,
        state: "ready",
        playableUrl: `/api/youtube/play/${videoId}`,
        duration: duration,
        progress: 100,
        message: "Download concluído"
      })}\n\n`
    );

    res.end();
  });

  ytdlp.on("error", (err) => {
    console.error("[DOWNLOAD] Erro ao executar yt-dlp:", err);
    res.write(
      `data: ${JSON.stringify({
        status: "error",
        state: "error",
        error: `yt-dlp não encontrado: ${err.message}`,
        progress: 0
      })}\n\n`
    );
    res.end();
  });
}

/**
 * GET /api/download/state/:videoId
 * Retorna estado do vídeo baixado
 */
export function getVideoState(req, res) {
  try {
    const { videoId } = req.params;
    const video = videoStore.get(videoId);

    if (!video) {
      return res.json({
        success: false,
        ready: false,
        state: "not_found",
        error: "Vídeo não encontrado"
      });
    }

    // Verificar se arquivo ainda existe
    const fileExists = fs.existsSync(video.path);
    
    if (!fileExists) {
      videoStore.delete(videoId);
      return res.json({
        success: false,
        ready: false,
        state: "error",
        error: "Arquivo não encontrado no disco"
      });
    }

    return res.json({
      success: true,
      ready: video.state === "ready",
      state: video.state || "ready",
      duration: video.duration || 0,
      videoId: videoId,
      playableUrl: `/api/youtube/play/${videoId}`
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
