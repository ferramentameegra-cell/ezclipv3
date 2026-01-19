/**
 * MIDDLEWARE DE AUTENTICAÇÃO
 * Protege rotas que exigem login obrigatório
 */

import { verifyToken, extractToken } from '../services/authService.js';
import { getUserById } from '../models/users.js';

/**
 * Middleware de autenticação obrigatória
 * Todas as rotas protegidas por este middleware exigem login
 * Suporta token via header Authorization ou cookie HttpOnly
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Extrair token do header ou cookie (prioriza header)
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'Token de autenticação não fornecido',
        code: 'NO_TOKEN'
      });
    }

    // Verificar token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Token inválido ou expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Buscar usuário
    const user = getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }

    // Adicionar usuário ao request
    req.user = user;
    req.userId = user.id;

    next();
  } catch (error) {
    console.error('[AUTH] Erro no middleware de autenticação:', error);
    return res.status(500).json({
      error: 'Erro ao verificar autenticação',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware opcional - adiciona usuário se token estiver presente
 * Usado em rotas que funcionam com ou sem autenticação
 * Suporta token via header Authorization ou cookie HttpOnly
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = getUserById(decoded.id);
        if (user) {
          req.user = user;
          req.userId = user.id;
        }
      } catch (error) {
        // Token inválido, mas continuar sem autenticação
        console.warn('[AUTH] Token inválido em rota opcional:', error.message);
      }
    }

    next();
  } catch (error) {
    // Erro na autenticação opcional, continuar sem usuário
    next();
  }
};
