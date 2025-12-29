import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Polyfill para File API no Node.js 18 (se necessário)
// Node.js 20+ já tem suporte nativo
if (typeof globalThis.File === 'undefined') {
  try {
    const { File } = await import('undici');
    globalThis.File = File;
  } catch (e) {
    console.warn('File API não disponível. Certifique-se de usar Node.js 20+');
  }
}

import videoRoutes from "./src/routes/video.js";
import nicheRoutes from "./src/routes/niches.js";
import retentionRoutes from "./src/routes/retention.js";
import generateRoutes from "./src/routes/generate.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static("public"));

// Rotas da API
app.use("/api/video", videoRoutes);
app.use("/api/niches", nicheRoutes);
app.use("/api/retention", retentionRoutes);
app.use("/api/generate", generateRoutes);

// Rota principal
app.get("/", (req, res) => {
  res.json({ status: "EZ Clips AI V2 - Retention Engine online 🚀" });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 EZ Clips AI V2 - Retention Engine running on port ${PORT}`);
});

