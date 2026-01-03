import { spawn } from "child_process";

function sanitizeYouTubeUrl(url) {
  try {
    const u = new URL(url);
    const v = u.searchParams.get("v");
    if (!v) return null;
    return `https://www.youtube.com/watch?v=${v}`;
  } catch {
    return null;
  }
}

export function downloadWithProgress(req, res) {
  const cleanUrl = sanitizeYouTubeUrl(req.query.url);

  if (!cleanUrl) {
    res.status(400).json({ error: "Invalid YouTube URL" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const outputPath = `/tmp/${Date.now()}.mp4`;

  const ytdlp = spawn("yt-dlp", [
    "-f",
    "bv*[ext=mp4]+ba[ext=m4a]/mp4",
    "--merge-output-format",
    "mp4",
    "-o",
    outputPath,
    "--newline",
    "--no-playlist",
    cleanUrl
  ]);

  // 🔥 yt-dlp envia progresso no STDERR
  ytdlp.stderr.on("data", (data) => {
    const text = data.toString();

    // Exemplo: [download]  12.3% of ...
    const match = text.match(/(\d{1,3}\.\d+)%/);

    if (match) {
      res.write(
        `data: ${JSON.stringify({
          status: "downloading",
          progress: Number(match[1])
        })}\n\n`
      );
    }
  });

  ytdlp.on("close", (code) => {
    if (code === 0) {
      res.write(
        `data: ${JSON.stringify({
          status: "finished",
          path: outputPath
        })}\n\n`
      );
    } else {
      res.write(
        `data: ${JSON.stringify({
          status: "error",
          message: "yt-dlp failed"
        })}\n\n`
      );
    }

    res.end();
  });

  ytdlp.on("error", (err) => {
    console.error("yt-dlp spawn error:", err);
    res.write(
      `data: ${JSON.stringify({
        status: "error",
        message: err.message
      })}\n\n`
    );
    res.end();
  });
}
