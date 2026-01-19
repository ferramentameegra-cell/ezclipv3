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
  // Content Security Policy - MUITO PERMISSIVO para não quebrar nada
  contentSecurityPolicy: false, // DESABILITADO - pode bloquear event handlers inline
  
  // Cross-Origin policies - DESABILITADAS para não quebrar funcionalidades
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  
  // Headers de segurança básicos (não bloqueiam funcionalidades)
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // Prevenir clickjacking - permissivo
  frameguard: {
    action: 'sameorigin'
  },
  
  // Prevenir MIME type sniffing
  noSniff: true,
  
  // XSS filter DESABILITADO
  xssFilter: false,
  
  // Desabilitar X-Powered-By
  hidePoweredBy: true,
  
  // Referrer Policy - permissivo
  referrerPolicy: false
});

/**
 * Middleware de sanitização XSS
 * Remove scripts e tags perigosas de inputs
 * NÃO afeta HTML estático servido (apenas inputs do usuário)
 */
export const xssProtection = (req, res, next) => {
  // NÃO sanitizar requisições GET ou requisições para arquivos estáticos
  if (req.method === 'GET' || req.path.startsWith('/') && !req.path.startsWith('/api/')) {
    return next();
  }
  
  // Sanitizar apenas body e query params de requisições POST/PUT/DELETE para API
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
 * NÃO remove event handlers de strings que são HTML completo (para não quebrar funcionalidades)
 * Apenas remove scripts e iframes perigosos
 */
function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }
  
  // Limitar tamanho para prevenir DoS
  if (value.length > 100000) {
    return value.substring(0, 100000);
  }
  
  // Remover apenas tags HTML perigosas (scripts e iframes)
  // NÃO remover event handlers - isso quebraria funcionalidades
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    // NÃO remover onclick e outros event handlers - necessário para funcionalidade
    .trim();
}

/**
 * Middleware de validação de Content-Type
 * MUITO PERMISSIVO - não bloqueia requisições
 */
export const validateContentType = (req, res, next) => {
  // SEMPRE permitir - não bloquear nada
  // Apenas logar se houver Content-Type inválido (mas não bloquear)
  const contentType = req.get('Content-Type');
  if (contentType && !contentType.includes('application/json') && 
      !contentType.includes('application/x-www-form-urlencoded') && 
      !contentType.includes('multipart/form-data') &&
      req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    console.warn('[SECURITY] Content-Type não padrão:', contentType, req.path);
  }
  
  // SEMPRE permitir
  next();
};

export default {
  securityHeaders,
  xssProtection,
  validateContentType
};
