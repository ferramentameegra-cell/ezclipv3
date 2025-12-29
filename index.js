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

// Servir arquivos estáticos
app.use(express.static("public", {
  maxAge: process.env.STATIC_MAX_AGE || '1d',
  etag: true
}));

// Importar rotas (síncrono - não bloqueia startup)
import videoRoutes from "./src/routes/video.js";
import nicheRoutes from "./src/routes/niches.js";
import retentionRoutes from "./src/routes/retention.js";
import generateRoutes from "./src/routes/generate.js";
import authRoutes from "./src/routes/auth.js";

// Rotas da API
app.use("/api/video", videoRoutes);
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

