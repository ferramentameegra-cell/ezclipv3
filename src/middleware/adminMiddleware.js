/**
 * MIDDLEWARE DE AUTORIZAÇÃO ADMINISTRATIVA
 * Centraliza verificação de permissões de administrador
 */

import { isAdmin } from '../models/users.js';

/**
 * Middleware para verificar se o usuário é administrador
 * Deve ser usado APÓS requireAuth
 */
export const requireAdmin = (req, res, next) => {
  try {
    if (!req.user || !req.userId) {
      return res.status(401).json({
        error: 'Autenticação obrigatória',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!isAdmin(req.userId)) {
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem acessar este recurso.',
        code: 'FORBIDDEN'
      });
    }

    next();
  } catch (error) {
    console.error('[ADMIN_MIDDLEWARE] Erro ao verificar permissões:', error);
    return res.status(500).json({
      error: 'Erro ao verificar permissões',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Helper para verificar se usuário é admin (para uso em controllers)
 */
export function checkIsAdmin(userId) {
  return isAdmin(userId);
}

/**
 * Middleware opcional - adiciona flag isAdmin ao request
 * Não bloqueia acesso, apenas adiciona informação
 */
export const optionalAdminCheck = (req, res, next) => {
  if (req.user && req.userId) {
    req.isAdmin = isAdmin(req.userId);
  } else {
    req.isAdmin = false;
  }
  next();
};

export default requireAdmin;
