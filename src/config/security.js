/**
 * CONFIGURAÇÕES DE SEGURANÇA
 * Centraliza todas as configurações relacionadas à segurança
 */

// JWT Configuration
export const jwtConfig = {
  secret: process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET deve ser definido em produção');
    }
    return 'ezclips-secret-key-change-in-production';
  })(),
  expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.JWT_COOKIE_NAME || 'auth_token',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS apenas em produção
  sameSite: 'strict' // Proteção CSRF
};

// CSRF Configuration
export const csrfConfig = {
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  },
  // Rotas que NÃO devem ter CSRF (GET, downloads, etc)
  skipPaths: [
    /^\/health$/,
    /^\/api\/youtube\/play\//,
    /^\/api\/generate\/download\//,
    /^\/api\/captions\/download\//,
    /^\/api\/retention\/video\//
  ]
};

// Rate Limiting Configuration
export const rateLimitConfig = {
  // Rate limit agressivo para login (prevenir brute force)
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 tentativas por IP
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false
  },
  // Rate limit moderado para API geral
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // 200 requisições por 15 minutos
    message: 'Muitas requisições. Tente novamente em alguns minutos.',
    standardHeaders: true,
    legacyHeaders: false
  },
  // Rate limit por usuário autenticado
  authenticated: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 1000, // 1000 requisições por hora
    message: 'Limite de requisições atingido. Tente novamente mais tarde.',
    standardHeaders: true,
    legacyHeaders: false
  }
};

// CORS Configuration
export const corsConfig = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : (process.env.NODE_ENV === 'production' ? false : '*'), // Em produção, deve ser configurado
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
};

// Security Headers (Helmet)
export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Necessário para alguns recursos
  crossOriginResourcePolicy: { policy: "cross-origin" } // Para vídeos e downloads
};

export default {
  jwt: jwtConfig,
  csrf: csrfConfig,
  rateLimit: rateLimitConfig,
  cors: corsConfig,
  helmet: helmetConfig
};
