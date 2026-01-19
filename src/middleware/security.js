/**
 * MIDDLEWARE DE SEGURANÇA
 * Hardening completo sem alterar funcionalidades
 */

import helmet from 'helmet';
import { helmetConfig } from '../config/security.js';

/**
 * Configurar Helmet com headers de segurança
 * Configuração permissiva para não quebrar funcionalidades
 */
export const securityHeaders = helmet({
  // Content Security Policy - permissivo para não quebrar frontend
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Necessário para alguns scripts
      imgSrc: ["'self'", "data:", "https:", "http:"], // Permitir imagens externas
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"], // Permitir conexões (SSE, WebSocket)
      mediaSrc: ["'self'", "data:", "https:", "http:"], // Para vídeos
      frameSrc: ["'self'", "https://www.youtube.com", "https://buy.stripe.com"], // YouTube e Stripe
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null // Apenas em produção
    }
  },
  // Cross-Origin policies - permissivas para não quebrar funcionalidades
  crossOriginEmbedderPolicy: false, // Necessário para alguns recursos
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Para vídeos e downloads
  crossOriginOpenerPolicy: false, // Para popups do Stripe
  
  // Headers de segurança
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true
  },
  
  // Prevenir clickjacking
  frameguard: {
    action: 'sameorigin' // Permitir frames do mesmo origin
  },
  
  // Prevenir MIME type sniffing
  noSniff: true,
  
  // Prevenir XSS
  xssFilter: true,
  
  // Desabilitar X-Powered-By
  hidePoweredBy: true,
  
  // Referrer Policy
  referrerPolicy: {
    policy: "strict-origin-when-cross-origin"
  },
  
  // Permissions Policy
  permissionsPolicy: {
    features: {
      geolocation: ["'none'"],
      microphone: ["'none'"],
      camera: ["'none'"]
    }
  }
});

/**
 * Middleware de sanitização XSS
 * Remove scripts e tags perigosas de inputs
 */
export const xssProtection = (req, res, next) => {
  // Sanitizar apenas body e query params
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

/**
 * Sanitizar objeto recursivamente
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeObject(obj[key]);
    }
  }
  return sanitized;
}

/**
 * Sanitizar string removendo tags HTML perigosas
 */
function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Remover tags HTML perigosas
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '') // Remover event handlers
    .trim();
}

/**
 * Middleware de validação de Content-Type
 */
export const validateContentType = (req, res, next) => {
  // Permitir GET, HEAD, OPTIONS sem Content-Type
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Para POST/PUT/DELETE, verificar Content-Type
  const contentType = req.get('Content-Type');
  
  // Permitir JSON, form-data, e multipart (para uploads)
  if (contentType && (
    contentType.includes('application/json') ||
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  )) {
    return next();
  }
  
  // Se não tiver Content-Type mas for JSON, permitir (alguns clientes não enviam)
  if (!contentType && req.body && typeof req.body === 'object') {
    return next();
  }
  
  // Caso contrário, retornar erro
  return res.status(415).json({
    error: 'Content-Type não suportado',
    code: 'UNSUPPORTED_MEDIA_TYPE'
  });
};

export default {
  securityHeaders,
  xssProtection,
  validateContentType
};
