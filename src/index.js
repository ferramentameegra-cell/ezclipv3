import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";

// Inicializar Redis primeiro (opcional)
import { initRedis } from "./services/redisService.js";
// MIDDLEWARES DE SEGURANÇA
import { apiLimiter, loginLimiter, authenticatedLimiter, heavyOperationLimiter } from "./middleware/rateLimiter.js";
import loggerMiddleware from "./middleware/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { securityHeaders, xssProtection, validateContentType } from "./middleware/security.js";
import { csrfProtection, getCSRFToken } from "./middleware/csrf.js";
import { corsConfig } from "./config/security.js";

import youtubeRoutes from "./routes/youtube.js";
import authRoutes from "./routes/auth.js";
import downloadRoutes from "./routes/download.js";
import trimRoutes from "./routes/trim.js";
import generateRoutes from "./routes/generate.js";
import nichesRoutes from "./routes/niches.js";
import retentionRoutes from "./routes/retention.js";
import captionsRoutes from "./routes/captions.js";
import thumbnailsRoutes from "./routes/thumbnails.js";
import termsRoutes from "./routes/terms.js";
import creditsRoutes from "./routes/credits.js";
import stripeRoutes from "./routes/stripe.js";
// videoRoutes removido - duplicado com downloadRoutes
import { requireAuth } from "./middleware/authMiddleware.js";

// Configurar ffmpeg antes de importar workers
import { configureFfmpeg } from "./utils/ffmpegDetector.js";

// Inicialização administrativa (apenas em dev ou com INIT_ADMIN=true)
import { initializeAdmin } from "./utils/adminInit.js";
// Garantir que admin sempre existe
import { ensureAdminExists } from "./utils/ensureAdmin.js";

// Importar videoStore e configurar no videoProcessor
import { videoStore } from "./controllers/downloadProgressController.js";
import { setVideoStore } from "./services/videoProcessor.js";
import { STORAGE_CONFIG } from "./config/storage.config.js";

// Configurar videoStore no videoProcessor ANTES de importar o worker
setVideoStore(videoStore);
console.log('[INIT] ✅ VideoStore configurado no videoProcessor');

// ===============================
// TESTE 1: Validar Configuração de Caminhos
// ===============================
console.log('[STARTUP] ========================================');
console.log('[STARTUP] Configuração de armazenamento:');
console.log('[STARTUP]   UPLOADS_DIR:', STORAGE_CONFIG.UPLOADS_DIR);
console.log('[STARTUP]   SERIES_DIR:', STORAGE_CONFIG.SERIES_DIR);
console.log('[STARTUP]   RETENTION_DIR:', STORAGE_CONFIG.RETENTION_DIR);
console.log('[STARTUP]   CAPTIONS_DIR:', STORAGE_CONFIG.CAPTIONS_DIR);
console.log('[STARTUP] Ambiente:', process.env.NODE_ENV || 'development');
console.log('[STARTUP] ========================================');

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
// MIDDLEWARES DE SEGURANÇA (HARDENING)
// =====================

// 1. Security Headers (Helmet) - PRIMEIRO
app.use(securityHeaders);

// 2. CORS - Configurado adequadamente
app.use(cors(corsConfig));

// 3. Cookie parser
app.use(cookieParser());

// 4. Body parser com limite
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 5. Validação de Content-Type (permissiva, não bloqueia)
app.use(validateContentType);

// 6. Proteção XSS (sanitização - apenas para API POST/PUT/DELETE, não afeta HTML estático)
app.use(xssProtection);

// 7. Logger (assíncrono, não bloqueia)
app.use(loggerMiddleware);

// 8. Rate Limiting (fail-open, não bloqueia se Redis falhar)
// Rate limit REMOVIDO para login - sem restrições de tentativas
// app.use('/api/auth/login', loginLimiter);
// app.use('/api/auth/register', loginLimiter);

// Rate limit para operações pesadas
app.use('/api/download/youtube', heavyOperationLimiter);
// REMOVIDO de /api/generate para permitir geração de clipes sem restrições
// app.use('/api/generate', heavyOperationLimiter);
app.use('/api/captions/generate', heavyOperationLimiter);

// Rate limit geral para API (mais permissivo)
app.use('/api/', apiLimiter);

// 9. CSRF Protection (apenas em rotas que modificam dados)
app.use(csrfProtection);

// =====================
// API
// =====================

// Rota para obter token CSRF (pública)
app.get("/api/csrf-token", getCSRFToken);

app.use("/api/youtube", youtubeRoutes); // Público (download de vídeos)
app.use("/api/auth", authRoutes); // Público (login/registro)
app.use("/api/credits", creditsRoutes); // Requer auth (verificar saldo/comprar)
app.use("/api/stripe", stripeRoutes); // Webhooks e verificação de pagamentos
app.use("/api/download", downloadRoutes); // Público (upload/download de vídeos)
app.use("/api/trim", trimRoutes); // Público (cálculo de trim)
app.use("/api/generate", generateRoutes); // Requer auth (geração de clipes)
app.use("/api/niches", nichesRoutes); // Público (lista de nichos)
app.use("/api/retention", retentionRoutes); // Público (lista de retenção)
app.use("/api/captions", captionsRoutes); // Público (geração de legendas)
app.use("/api/terms", termsRoutes); // Público (termos)
app.use("/api/thumbnails", thumbnailsRoutes); // Público (gerador de thumbnails 9x16)

// =====================
// FRONTEND ESTÁTICO
// =====================
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));

// Rota para confirmação de email/assinatura
app.get("/auth/confirm", (req, res) => {
  res.sendFile(path.join(publicDir, "auth-confirm.html"));
});

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
// TRATAMENTO DE ERROS (deve ser o último middleware)
// =====================
// Handler para rotas não encontradas (404)
app.use(notFoundHandler);

// Handler de erros global
app.use(errorHandler);

// =====================
// INICIALIZAÇÃO
// =====================
async function initializeServer() {
  try {
    // Inicialização administrativa (limpa dados e cria admin)
    // Só executa se NODE_ENV !== 'production' OU INIT_ADMIN=true
    await initializeAdmin();
    
    // GARANTIR que admin sempre existe (mesmo se initializeAdmin não executou)
    await ensureAdminExists();
    
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
  
  // Verificar Stripe
  try {
    const { stripe } = await import('./services/stripeService.js');
    if (stripe) {
      console.log('[INIT] ✅ Stripe configurado e pronto para processar pagamentos');
    } else {
      console.warn('[INIT] ⚠️ Stripe não configurado - configure STRIPE_SECRET_KEY');
    }
  } catch (error) {
    console.warn('[INIT] ⚠️ Erro ao verificar Stripe:', error.message);
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
    console.log(`[INIT] 💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configurado' : 'Não configurado'}`);
    console.log(`[INIT] 🔄 Sistema de filas otimizado`);
  });
}

// Inicializar servidor
initializeServer();
