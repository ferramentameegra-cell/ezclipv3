/**
 * MIDDLEWARE DE AUTENTICAÇÃO
 * Valida JWT vindo de cookie HttpOnly ou header Authorization
 * Mantém compatibilidade com código existente
 */

import { verifyToken } from '../services/authService.js';
import { getUserById } from '../models/users.js';
import { jwtConfig } from '../config/security.js';

/**
 * Extrair token de cookie HttpOnly ou header Authorization
 * Prioriza cookie por segurança, mas mantém compatibilidade com header
 */
function extractToken(req) {
  // 1. Tentar obter do cookie HttpOnly (mais seguro)
  const cookieToken = req.cookies?.[jwtConfig.cookieName];
  if (cookieToken) {
    return cookieToken;
  }

  // 2. Fallback: header Authorization (compatibilidade)
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }

  return null;
}

/**
 * Middleware de autenticação que valida JWT
 * Injeta usuário em req.user sem vazar informações sensíveis
 */
export const authenticationMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      // Sem token, continuar sem autenticação (não falhar silenciosamente)
      return next();
    }

    // Verificar token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      // Token inválido - falhar silenciosamente sem vazar dados
      return next();
    }

    // Buscar usuário
    const user = getUserById(decoded.id);
    if (!user) {
      // Usuário não encontrado - falhar silenciosamente
      return next();
    }

    // Adicionar usuário ao request (sem dados sensíveis)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      plan_id: user.plan_id,
      credits_balance: user.credits_balance,
      free_trial_credits: user.free_trial_credits,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    req.userId = user.id;

    next();
  } catch (error) {
    // Erro na autenticação - falhar silenciosamente
    // Não logar detalhes para não vazar informações
    next();
  }
};

/**
 * Middleware de autenticação obrigatória
 * Similar ao requireAuth existente, mas usando cookie HttpOnly
 */
export const requireAuthCookie = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }

    const user = getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      plan_id: user.plan_id,
      credits_balance: user.credits_balance,
      free_trial_credits: user.free_trial_credits,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    req.userId = user.id;

    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Erro ao verificar autenticação',
      code: 'AUTH_ERROR'
    });
  }
};

export default authenticationMiddleware;
