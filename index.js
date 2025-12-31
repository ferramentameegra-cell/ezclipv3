import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Configurar dotenv com valores padrão seguros
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Criar diretórios necessários de forma síncrona (não bloqueia)
try {
  const uploadsDir = path.join(__dirname, 'uploads');
  const seriesDir = path.join(__dirname, 'uploads', 'series');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(seriesDir)) {
    fs.mkdirSync(seriesDir, { recursive: true });
  }
} catch (error) {
  console.warn('Warning: Could not create upload directories:', error.message);
}

const app = express();

// Middleware - Configuração básica e segura
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

app.use(express.json({ 
  limit: process.env.MAX_JSON_SIZE || '50mb',
  strict: true
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_URL_SIZE || '50mb' 
}));

// Servir arquivos estáticos com cache control para desenvolvimento
app.use(express.static("public", {
  maxAge: process.env.NODE_ENV === 'production' ? (process.env.STATIC_MAX_AGE || '1d') : '0',
  etag: true,
  lastModified: true
}));

// Middleware para forçar refresh em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path.match(/\.(css|js|html)$/)) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    next();
  });
}

// Importar rotas (síncrono - não bloqueia startup)
import videoRoutes from "./src/routes/video.js";
import trimRoutes from "./src/routes/trim.js";
import nicheRoutes from "./src/routes/niches.js";
import retentionRoutes from "./src/routes/retention.js";
import generateRoutes from "./src/routes/generate.js";
import authRoutes from "./src/routes/auth.js";

// Importar workers para processamento assíncrono (não bloqueia startup)
if (process.env.ENABLE_WORKERS !== 'false') {
  import('./src/workers/videoDownloadWorker.js').catch(err => {
    console.warn('[STARTUP] Workers de download não iniciados:', err.message);
  });
  import('./src/workers/videoProcessWorker.js').catch(err => {
    console.warn('[STARTUP] Workers de processamento não iniciados:', err.message);
  });
}

// Importar limpeza de arquivos (executa periodicamente)
if (process.env.ENABLE_CLEANUP !== 'false') {
  import('./src/services/fileCleanup.js').then(({ cleanupOldFiles }) => {
    // Limpar arquivos antigos a cada 6 horas
    const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_HOURS || '6', 10) * 60 * 60 * 1000;
    
    // Executar limpeza imediatamente e depois periodicamente
    cleanupOldFiles(24).catch(console.error);
    setInterval(() => {
      cleanupOldFiles(24).catch(console.error);
    }, cleanupInterval);
    
    console.log(`[STARTUP] Limpeza automática de arquivos configurada (intervalo: ${cleanupInterval / 1000 / 60 / 60}h)`);
  }).catch(err => {
    console.warn('[STARTUP] Limpeza automática não configurada:', err.message);
  });
}

// Rotas da API
app.use("/api/video", videoRoutes);
app.use("/api/trim", trimRoutes);
app.use("/api/niches", nicheRoutes);
app.use("/api/retention", retentionRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/auth", authRoutes);

// Rota principal - Health check básico
app.get("/", (req, res) => {
  res.json({ 
    status: "EZ Clips AI V2 - Retention Engine online 🚀",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint (usado pelo Railway)
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ready check endpoint
app.get("/ready", (req, res) => {
  res.status(200).json({ 
    status: "ready",
    timestamp: new Date().toISOString()
  });
});

// 404 handler (deve vir antes do error handler)
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path
  });
});

// Error handling middleware (deve vir DEPOIS de todas as rotas)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    status: 'error'
  });
});

// Obter porta do ambiente ou usar padrão
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Iniciar servidor imediatamente (sem await ou operações assíncronas)
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 EZ Clips AI V2 - Retention Engine running on port ${PORT}`);
  console.log(`📡 Health check available at http://${HOST}:${PORT}/health`);
  console.log(`✅ Server started successfully at ${new Date().toISOString()}`);
});

// Tratamento de erros do servidor
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

