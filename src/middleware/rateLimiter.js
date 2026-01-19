import { redisStore } from '../services/redisService.js';
import { rateLimitConfig } from '../config/security.js';

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
      // Se Redis não estiver disponível, permitir requisição (fail open)
      if (!redisStore || typeof redisStore.increment !== 'function') {
        console.warn('[RATE_LIMITER] Redis não disponível, permitindo requisição');
        return next();
      }

      const key = `rate_limit:${req.ip}:${req.path}`;
      
      // Timeout para evitar travamento
      const incrementPromise = redisStore.increment(key, Math.ceil(windowMs / 1000));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1000)
      );
      
      const count = await Promise.race([incrementPromise, timeoutPromise]);

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
      console.error('[RATE_LIMITER] Erro:', error.message);
      // Em caso de erro, SEMPRE permitir requisição (fail open)
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

      // Se Redis não estiver disponível, permitir requisição (fail open)
      if (!redisStore || typeof redisStore.increment !== 'function') {
        console.warn('[USER_RATE_LIMITER] Redis não disponível, permitindo requisição');
        return next();
      }

      const key = `rate_limit:user:${req.user.id}:${req.path}`;
      
      // Timeout para evitar travamento
      const incrementPromise = redisStore.increment(key, Math.ceil(windowMs / 1000));
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 1000)
      );
      
      const count = await Promise.race([incrementPromise, timeoutPromise]);

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
      console.error('[USER_RATE_LIMITER] Erro:', error.message);
      // Em caso de erro, SEMPRE permitir requisição (fail open)
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

/**
 * Rate Limiter agressivo para login (prevenir brute force)
 * Usa configuração centralizada de security.js
 */
export const loginLimiter = createRateLimiter({
  windowMs: rateLimitConfig.login.windowMs,
  max: rateLimitConfig.login.max,
  message: rateLimitConfig.login.message
});

/**
 * Rate Limiter para usuários autenticados
 * Usa configuração centralizada de security.js
 */
export const authenticatedLimiter = createUserRateLimiter({
  windowMs: rateLimitConfig.authenticated.windowMs,
  max: rateLimitConfig.authenticated.max,
  message: rateLimitConfig.authenticated.message
});
