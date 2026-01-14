import { redisStore } from '../services/redisService.js';

/**
 * Rate Limiter por IP
 */
export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutos
    max = 100, // máximo de requisições
    message = 'Muitas requisições. Tente novamente mais tarde.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      const key = `rate_limit:${req.ip}:${req.path}`;
      const count = await redisStore.increment(key, Math.ceil(windowMs / 1000));

      // Adicionar headers de rate limit
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());

      if (count > max) {
        return res.status(429).json({
          error: message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('[RATE_LIMITER] Erro:', error);
      // Em caso de erro, permitir requisição (fail open)
      next();
    }
  };
}

/**
 * Rate Limiter por usuário autenticado
 */
export function createUserRateLimiter(options = {}) {
  const {
    windowMs = 60 * 60 * 1000, // 1 hora
    max = 50, // máximo de requisições por hora
    message = 'Limite de uso atingido. Tente novamente mais tarde.'
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return next(); // Se não autenticado, não aplicar limite
      }

      const key = `rate_limit:user:${req.user.id}:${req.path}`;
      const count = await redisStore.increment(key, Math.ceil(windowMs / 1000));

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

      if (count > max) {
        return res.status(429).json({
          error: message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('[USER_RATE_LIMITER] Erro:', error);
      next();
    }
  };
}

/**
 * Rate Limiter para operações pesadas (download, processamento)
 */
export const heavyOperationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 operações pesadas por hora
  message: 'Limite de processamentos atingido. Aguarde antes de processar mais vídeos.'
});

/**
 * Rate Limiter para API geral
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // 200 requisições por 15 minutos
  message: 'Muitas requisições. Tente novamente em alguns minutos.'
});
