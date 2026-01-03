import { spawn } from "child_process";

export function downloadWithProgress(req, res) {
  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: "Missing YouTube URL" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ytdlp = spawn("yt-dlp", [
    "-f",
    "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/mp4",
    "--merge-output-format",
    "mp4",
    "--newline",
    url
  ]);

  ytdlp.stdout.on("data", (data) => {
    const text = data.toString();
    const match = text.match(/(\d{1,3}\.\d)%/);

    if (match) {
      res.write(
        `data: ${JSON.stringify({ progress: Number(match[1]) })}\n\n`
      );
    }
  });

  ytdlp.stderr.on("data", (data) => {
    console.error("[yt-dlp]", data.toString());
  });

  ytdlp.on("close", (code) => {
    if (code === 0) {
      res.write(`data: ${JSON.stringify({ status: "finished" })}\n\n`);
    } else {
      res.write(
        `data: ${JSON.stringify({ status: "error", code })}\n\n`
      );
    }
    res.end();
  });
}
