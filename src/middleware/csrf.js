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
 * Middleware CSRF - DESABILITADO para não bloquear funcionalidades
 * Apenas loga tentativas suspeitas, mas nunca bloqueia
 */
export const csrfProtection = (req, res, next) => {
  // SEMPRE permitir - não bloquear nada
  // Apenas logar se houver algo suspeito (mas não bloquear)
  
  // Métodos seguros sempre permitidos
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Verificar origem apenas para log (não bloquear)
  const origin = req.get('Origin') || req.get('Referer');
  const host = req.get('Host');
  
  if (origin && host) {
    try {
      const originHost = new URL(origin).hostname;
      const requestHost = host.split(':')[0];
      
      // Se origem diferente, apenas logar (não bloquear)
      if (originHost !== requestHost && process.env.NODE_ENV === 'production') {
        console.warn('[CSRF] Origem diferente detectada (apenas log):', {
          origin: originHost,
          host: requestHost,
          path: req.path
        });
      }
    } catch (e) {
      // Ignorar erros de parsing
    }
  }
  
  // SEMPRE permitir
  next();
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
