import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ==============================
// 🌱 ENV
// ==============================
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================
// 📁 DIRETÓRIOS (RAILWAY SAFE)
// ==============================
// ⚠️ Tudo que grava arquivo usa /tmp
const BASE_TMP_DIR = "/tmp/uploads";
const SERIES_DIR = path.join(BASE_TMP_DIR, "series");

try {
  if (!fs.existsSync(BASE_TMP_DIR)) {
    fs.mkdirSync(BASE_TMP_DIR, { recursive: true });
  }

  if (!fs.existsSync(SERIES_DIR)) {
    fs.mkdirSync(SERIES_DIR, { recursive: true });
  }
} catch (error) {
  console.warn("[STARTUP] Falha ao criar diretórios:", error.message);
}

// ==============================
// 🚀 APP
// ==============================
const app = express();

// ==============================
// 🌐 MIDDLEWARES
// ==============================
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

app.use(
  express.json({
    limit: process.env.MAX_JSON_SIZE || "50mb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_URL_SIZE || "50mb",
  })
);

// ==============================
// 📦 ARQUIVOS ESTÁTICOS
// ==============================
app.use(
  express.static("public", {
    maxAge:
      process.env.NODE_ENV === "production"
        ? process.env.STATIC_MAX_AGE || "1d"
        : "0",
    etag: true,
    lastModified: true,
  })
);

// Forçar refresh em dev
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    if (req.path.match(/\.(css|js|html)$/)) {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }
    next();
  });
}

// ==============================
// 📥 ROTAS (IMPORTS)
// ==============================
import videoRoutes from "./src/routes/video.js";
import youtubeRoutes from "./src/routes/youtube.js"; // ⚠️ PRECISA export default
import downloadRoutes from "./src/routes/download.js";
import trimRoutes from "./src/routes/trim.js";
import clipsRoutes from "./src/routes/clips.js";
import nicheRoutes from "./src/routes/niches.js";
import retentionRoutes from "./src/routes/retention.js";
import generateRoutes from "./src/routes/generate.js";
import authRoutes from "./src/routes/auth.js";

// Controllers diretos
import { playVideo } from "./src/controllers/downloadController.js";
import { playTrimmedVideo } from "./src/controllers/trimController.js";
import { downloadClip } from "./src/controllers/clipsController.js";

// ==============================
// ⚙️ WORKERS
// ==============================
if (process.env.ENABLE_WORKERS !== "false") {
  import("./src/workers/videoDownloadWorker.js").catch((err) => {
    console.warn("[STARTUP] Download worker não iniciado:", err.message);
  });

  import("./src/workers/videoProcessWorker.js").catch((err) => {
    console.warn("[STARTUP] Process worker não iniciado:", err.message);
  });
}

// ==============================
// 🧹 LIMPEZA AUTOMÁTICA
// ==============================
if (process.env.ENABLE_CLEANUP !== "false") {
  import("./src/services/fileCleanup.js")
    .then(({ cleanupOldFiles }) => {
      const intervalHours = parseInt(
        process.env.CLEANUP_INTERVAL_HOURS || "6",
        10
      );

      const intervalMs = intervalHours * 60 * 60 * 1000;

      cleanupOldFiles(24).catch(console.error);

      setInterval(() => {
        cleanupOldFiles(24).catch(console.error);
      }, intervalMs);

      console.log(
        `[STARTUP] Limpeza automática configurada (${intervalHours}h)`
      );
    })
    .catch((err) => {
      console.warn(
        "[STARTUP] Limpeza automática não configurada:",
        err.message
      );
    });
}

// ==============================
// 🔗 REGISTRO DE ROTAS
// ==============================
app.use("/api/video", videoRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/download", downloadRoutes);
app.use("/api/trim", trimRoutes);
app.use("/api/clips", clipsRoutes);
app.use("/api/niches", nicheRoutes);
app.use("/api/retention", retentionRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/auth", authRoutes);

// Playback / downloads
app.get("/api/play/:videoId", playVideo);
app.get("/api/play-trimmed/:videoId", playTrimmedVideo);
app.get("/api/download-clip/:videoId/:filename", downloadClip);

// ==============================
// ❤️ HEALTH
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "EZ Clips AI V2 - Retention Engine online 🚀",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/ready", (req, res) => {
  res.status(200).json({
    status: "ready",
    timestamp: new Date().toISOString(),
  });
});

// ==============================
// ❌ 404
// ==============================
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
  });
});

// ==============================
// 🧯 ERROR HANDLER
// ==============================
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    status: "error",
  });
});

// ==============================
// 🚀 SERVER
// ==============================
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 EZ Clips AI V2 running on port ${PORT}`);
  console.log(`📡 Health check at http://${HOST}:${PORT}/health`);
});

// ==============================
// 🛑 GRACEFUL SHUTDOWN
// ==============================
const shutdown = () => {
  console.log("Shutdown signal received");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
