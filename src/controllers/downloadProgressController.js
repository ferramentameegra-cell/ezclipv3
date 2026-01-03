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

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const outputPath = `/tmp/${Date.now()}.mp4`;

  const ytdlp = spawn("yt-dlp", [
    "-f",
    "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/mp4",
    "--merge-output-format",
    "mp4",
    "-o",
    outputPath,
    "--newline",
    cleanUrl
  ]);

  ytdlp.stdout.on("data", (data) => {
    const match = data.toString().match(/(\d{1,3}\.\d)%/);
    if (match) {
      res.write(`data: ${JSON.stringify({ progress: Number(match[1]) })}\n\n`);
    }
  });

  ytdlp.stderr.on("data", (data) => {
    console.error("[yt-dlp]", data.toString());
  });

  ytdlp.on("close", (code) => {
    if (code === 0) {
      res.write(
        `data: ${JSON.stringify({ status: "finished", path: outputPath })}\n\n`
      );
    } else {
      res.write(`data: ${JSON.stringify({ status: "error" })}\n\n`);
    }
    res.end();
  });
}
