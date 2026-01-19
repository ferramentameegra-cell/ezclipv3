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
 * Validação robusta com proteção contra ataques
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token inválido');
  }
  
  // Validar formato básico do JWT (3 partes separadas por ponto)
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token com formato inválido');
  }
  
  // Validar que não está vazio
  if (token.trim().length === 0) {
    throw new Error('Token vazio');
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], // Apenas HS256, não permitir algoritmos fracos
      maxAge: JWT_EXPIRES_IN // Validar expiração
    });
    
    // Validações adicionais
    if (!decoded.id || !decoded.email) {
      throw new Error('Token com payload inválido');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expirado');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Token inválido');
    } else if (error.name === 'NotBeforeError') {
      throw new Error('Token ainda não válido');
    }
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
