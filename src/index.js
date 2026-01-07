import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import youtubeRoutes from "./routes/youtube.js";
import authRoutes from "./routes/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// =====================
// MIDDLEWARES
// =====================
app.use(cors());
app.use(express.json());

// =====================
// API
// =====================
app.use("/api/youtube", youtubeRoutes);
app.use("/api/auth", authRoutes);

// =====================
// FRONTEND ESTÁTICO
// =====================
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));

// ⚠️ ESSENCIAL: rota raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// =====================
// HEALTH
// =====================
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// =====================
// START
// =====================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 EZ Clips rodando na porta ${PORT}`);
});
