import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const uploadsDir = "/tmp/uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

export function downloadWithProgress(req, res) {
  const url = req.query.url;
  if (!url) {
    res.write(`data: ${JSON.stringify({ error: "URL ausente" })}\n\n`);
    return res.end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const videoId = uuidv4();
  const outputPath = path.join(uploadsDir, `${videoId}.mp4`);

  const ytdlp = spawn("yt-dlp", [
    "-f",
    "bestvideo+bestaudio/best",
    "--merge-output-format",
    "mp4",
    "--no-playlist",
    "-o",
    outputPath,
    url
  ]);

  let lastProgress = 0;

  ytdlp.stderr.on("data", (data) => {
    const txt = data.toString();
    const match = txt.match(/(\d{1,3}\.\d+)%/);
    if (match) {
      const p = parseFloat(match[1]);
      if (p > lastProgress) {
        lastProgress = p;
        res.write(`data: ${JSON.stringify({ progress: p })}\n\n`);
      }
    }
  });

  ytdlp.on("close", async (code) => {
    if (code !== 0 || !fs.existsSync(outputPath)) {
      res.write(`data: ${JSON.stringify({ error: "yt-dlp failed" })}\n\n`);
      return res.end();
    }

    // tenta ffprobe, se falhar retorna duração fake (frontend desbloqueia)
    let duration = 0;
    try {
      const probe = spawn("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath
      ]);

      let out = "";
      for await (const c of probe.stdout) out += c.toString();
      duration = Math.floor(parseFloat(out));
    } catch {}

    if (!duration || duration <= 0) duration = 600; // fallback

    res.write(`data: ${JSON.stringify({
      completed: true,
      videoId,
      duration,
      playableUrl: `/api/youtube/play/${videoId}`
    })}\n\n`);

    res.end();
  });
}
