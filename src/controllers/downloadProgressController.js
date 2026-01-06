/**
 * CONTROLLER DE DOWNLOAD COM PROGRESSO SSE
 * Compatível com frontend (trim + clips)
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const videoStore = new Map();

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

function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "json",
      filePath
    ]);

    let out = "";

    ffprobe.stdout.on("data", d => out += d.toString());

    ffprobe.on("close", () => {
      try {
        const json = JSON.parse(out);
        const duration = Math.floor(Number(json.format.duration || 0));
        resolve(duration > 0 ? duration : 0);
      } catch {
        resolve(0);
      }
    });

    ffprobe.on("error", () => resolve(0));
  });
}

export function downloadWithProgress(req, res) {
  const cleanUrl = sanitizeYouTubeUrl(req.query.url);

  if (!cleanUrl) {
    return res.status(400).json({ success: false, error: "URL inválida" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const uploadsDir = "/tmp/uploads";
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const videoId = uuidv4();
  const outputPath = path.join(uploadsDir, `${videoId}.mp4`);

  const ytdlp = spawn("yt-dlp", [
    "-f", "best[ext=mp4]/mp4",
    "--merge-output-format", "mp4",
    "--no-playlist",
    "-o", outputPath,
    cleanUrl
  ]);

  let lastProgress = 0;
  let stderr = "";

  ytdlp.stderr.on("data", (data) => {
    const text = data.toString();
    stderr += text;

    const match = text.match(/(\d{1,3}\.\d+)%/);
    if (match) {
      const p = parseFloat(match[1]);
      if (p > lastProgress) {
        lastProgress = p;
        res.write(`data: ${JSON.stringify({
          progress: p,
          state: "downloading"
        })}\n\n`);
      }
    }
  });

  ytdlp.on("close", async (code) => {
    if (code !== 0 || !fs.existsSync(outputPath)) {
      res.write(`event: error\ndata: ${JSON.stringify({
        success: false,
        error: "Falha ao baixar vídeo"
      })}\n\n`);
      return res.end();
    }

    const duration = await getVideoDuration(outputPath);

    videoStore.set(videoId, {
      id: videoId,
      path: outputPath,
      duration
    });

    // 🔥 EVENTO FINAL — ISSO DESTRAVA O TRIM 🔥
    res.write(
      `event: completed\ndata: ${JSON.stringify({
        success: true,
        completed: true,
        ready: true,
        state: "ready",
        videoId,
        duration,
        videoDuration: duration,
        playableUrl: `/api/youtube/play/${videoId}`,
        progress: 100
      })}\n\n`
    );

    res.end();
  });

  ytdlp.on("error", () => {
    res.write(`event: error\ndata: ${JSON.stringify({
      success: false,
      error: "yt-dlp não disponível"
    })}\n\n`);
    res.end();
  });
}

export function getVideoState(req, res) {
  const video = videoStore.get(req.params.videoId);

  if (!video) {
    return res.json({ success: false, ready: false });
  }

  return res.json({
    success: true,
    ready: true,
    duration: video.duration,
    videoDuration: video.duration,
    playableUrl: `/api/youtube/play/${video.id}`
  });
}
