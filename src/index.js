import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Inicializar Redis primeiro
import { initRedis } from "./services/redisService.js";
import { apiLimiter, heavyOperationLimiter } from "./middleware/rateLimiter.js";

import youtubeRoutes from "./routes/youtube.js";
import authRoutes from "./routes/auth.js";
import downloadRoutes from "./routes/download.js";
import trimRoutes from "./routes/trim.js";
import generateRoutes from "./routes/generate.js";
import nichesRoutes from "./routes/niches.js";
import retentionRoutes from "./routes/retention.js";
import captionsRoutes from "./routes/captions.js";

// Configurar ffmpeg antes de importar workers
import { configureFfmpeg } from "./utils/ffmpegDetector.js";

// Importar videoStore e configurar no videoProcessor
import { videoStore } from "./controllers/downloadProgressController.js";
import { setVideoStore } from "./services/videoProcessor.js";

// Configurar videoStore no videoProcessor ANTES de importar o worker
setVideoStore(videoStore);
console.log('[INIT] ✅ VideoStore configurado no videoProcessor');

// Importar e configurar worker para processar jobs (funciona mesmo sem Redis)
import "./workers/videoProcessWorker.js";
import { configureWorker } from "./workers/videoProcessWorker.js";

// Configurar worker com videoStore
configureWorker(videoStore);
console.log('[INIT] ✅ Worker configurado com videoStore');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// =====================
// MIDDLEWARES
// =====================
app.use(cors());
app.use(express.json({ limit: '100mb' })); // Aumentar limite para vídeos grandes

// Rate limiting global (aplicar antes das rotas)
app.use('/api/', apiLimiter);

// Rate limiting para operações pesadas
app.use('/api/download/youtube', heavyOperationLimiter);
app.use('/api/generate', heavyOperationLimiter);
app.use('/api/captions/generate', heavyOperationLimiter);

// =====================
// API
// =====================
app.use("/api/youtube", youtubeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/download", downloadRoutes);
app.use("/api/trim", trimRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/niches", nichesRoutes);
app.use("/api/retention", retentionRoutes);
app.use("/api/captions", captionsRoutes);

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
// LIMPEZA AUTOMÁTICA DE ARQUIVOS
// =====================
import { cleanupOldFiles } from './services/fileCleanup.js';

// Limpar arquivos antigos a cada 30 minutos
setInterval(async () => {
  try {
    const result = await cleanupOldFiles(1); // Arquivos > 1 hora
    if (result.cleanedCount > 0) {
      console.log(`[CLEANUP] Limpeza automática: ${result.cleanedCount} arquivos removidos, ${(result.totalSizeFreed / 1024 / 1024).toFixed(2)} MB liberados`);
    }
  } catch (error) {
    console.error('[CLEANUP] Erro na limpeza automática:', error.message);
  }
}, 30 * 60 * 1000); // A cada 30 minutos

// Limpar arquivos antigos na inicialização
cleanupOldFiles(24).then(result => {
  if (result.cleanedCount > 0) {
    console.log(`[CLEANUP] Limpeza inicial: ${result.cleanedCount} arquivos removidos`);
  }
});

// =====================
// INICIALIZAÇÃO
// =====================
async function initializeServer() {
  try {
    // Inicializar Redis primeiro
    console.log('[INIT] Inicializando Redis...');
    await initRedis();
    
    // Configurar ffmpeg antes de iniciar o servidor
    console.log('[INIT] Verificando ffmpeg...');
    await configureFfmpeg();
    console.log('[INIT] ✅ ffmpeg configurado com sucesso');
  } catch (error) {
    console.error('[INIT] ⚠️ Aviso: ffmpeg não está configurado corretamente:', error.message);
    console.error('[INIT] Algumas funcionalidades podem não funcionar. Por favor, instale o ffmpeg.');
  }
  
  // Log de recursos disponíveis
  const memUsage = process.memoryUsage();
  const concurrency = parseInt(process.env.VIDEO_PROCESS_CONCURRENCY || '10');
  console.log(`[INIT] Memória disponível: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`[INIT] Concurrency de processamento: ${concurrency}`);
  console.log(`[INIT] Redis: ${process.env.REDIS_URL ? 'Configurado' : 'Não configurado (usando memória)'}`);
  
  // Iniciar servidor mesmo se ffmpeg não estiver configurado
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 EZ Clips rodando na porta ${PORT}`);
    console.log(`[INIT] ✅ Plataforma SaaS pronta para 1000+ usuários simultâneos`);
    console.log(`[INIT] 📊 Rate limiting ativo`);
    console.log(`[INIT] 🔄 Sistema de filas otimizado`);
  });
}

// Inicializar servidor
initializeServer();
