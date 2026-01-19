/**
 * SERVIÇO DE AUTENTICAÇÃO JWT
 * Gerencia tokens JWT para autenticação
 */

import jwt from 'jsonwebtoken';
import { jwtConfig } from '../config/security.js';

// Usar JWT_SECRET do env ou do config (que já tem fallback seguro)
const JWT_SECRET = process.env.JWT_SECRET || (typeof jwtConfig.secret === 'function' ? jwtConfig.secret() : jwtConfig.secret);
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || jwtConfig.expiresIn || '7d';

/**
 * Gerar token JWT para usuário
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verificar e decodificar token JWT
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
}

/**
 * Extrair token do header Authorization
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  // Formato: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Extrair token do cookie HttpOnly
 */
export function extractTokenFromCookie(req) {
  if (!req || !req.cookies) {
    return null;
  }

  const cookieName = jwtConfig.cookieName || 'auth_token';
  return req.cookies[cookieName] || null;
}

/**
 * Extrair token de qualquer fonte (header ou cookie)
 * Prioriza header, depois cookie
 */
export function extractToken(req) {
  // Tentar header primeiro (compatibilidade com frontend existente)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const tokenFromHeader = extractTokenFromHeader(authHeader);
  
  if (tokenFromHeader) {
    return tokenFromHeader;
  }

  // Se não encontrou no header, tentar cookie
  return extractTokenFromCookie(req);
}
