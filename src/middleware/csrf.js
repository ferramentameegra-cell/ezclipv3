/**
 * MIDDLEWARE CSRF PROTECTION
 * Proteção contra Cross-Site Request Forgery
 * Implementação que não quebra o frontend
 */

import { csrfConfig } from '../config/security.js';

/**
 * Gerar token CSRF
 */
import crypto from 'crypto';

export function generateCSRFToken() {
  // Gerar token aleatório seguro
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Middleware CSRF - versão que não quebra o frontend
 * Aplica apenas em rotas que modificam dados (POST, PUT, DELETE)
 * Ignora rotas públicas e GET
 */
export const csrfProtection = (req, res, next) => {
  // Métodos seguros (GET, HEAD, OPTIONS) não precisam de CSRF
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Verificar se a rota deve ser ignorada
  const shouldSkip = csrfConfig.skipPaths.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(req.path);
    }
    return req.path === pattern;
  });
  
  if (shouldSkip) {
    return next();
  }
  
  // Para webhooks do Stripe, não aplicar CSRF (usa assinatura própria)
  if (req.path === '/api/stripe/webhook') {
    return next();
  }
  
  // Verificar origem da requisição
  const origin = req.get('Origin') || req.get('Referer');
  const host = req.get('Host');
  
  // Se não houver origem, pode ser requisição direta (permitir com cuidado)
  if (!origin) {
    // Em produção, ser mais restritivo
    if (process.env.NODE_ENV === 'production') {
      console.warn('[CSRF] Requisição sem Origin em produção:', req.path);
    }
    // Permitir mas logar
    return next();
  }
  
  // Verificar se a origem é confiável
  const originHost = new URL(origin).hostname;
  const requestHost = host?.split(':')[0]; // Remover porta
  
  // Permitir mesma origem
  if (originHost === requestHost) {
    return next();
  }
  
  // Permitir origens configuradas em CORS
  const allowedOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : [];
  
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    return next();
  }
  
  // Em desenvolvimento, ser mais permissivo
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  // Em produção, bloquear se origem não confiável
  console.warn('[CSRF] Origem não confiável bloqueada:', {
    origin,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  return res.status(403).json({
    error: 'Requisição bloqueada por segurança',
    code: 'CSRF_BLOCKED'
  });
};

/**
 * Middleware para fornecer token CSRF ao frontend
 * GET /api/csrf-token
 */
export const getCSRFToken = (req, res) => {
  // Gerar token
  const token = generateCSRFToken();
  
  // Armazenar em cookie HttpOnly
  res.cookie('csrf-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000 // 1 hora
  });
  
  // Retornar token no header também (para SPAs)
  res.setHeader('X-CSRF-Token', token);
  
  res.json({
    csrfToken: token
  });
};

export default csrfProtection;
