/**
 * CONTROLLER DE AUTENTICAÇÃO
 * Gerencia registro, login e recuperação de senha
 */

import { createUser, getUserByEmail, verifyPassword } from '../models/users.js';
import { generateToken } from '../services/authService.js';
import { jwtConfig } from '../config/security.js';
// Logger removido temporariamente
// import { logLoginAttempt, logSecurityError } from '../middleware/logger.js';

// Funções mockadas para não quebrar código
const logLoginAttempt = () => {}; // Não fazer nada
const logSecurityError = () => {}; // Não fazer nada

/**
 * POST /api/auth/register
 * Registrar novo usuário
 */
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validações
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'A senha deve ter no mínimo 6 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }

    // Email validation básica
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Email inválido',
        code: 'INVALID_EMAIL'
      });
    }

    // Criar usuário
    const user = await createUser({ name, email, password });

    // Gerar token
    const token = generateToken(user);

    // Configurar cookie HttpOnly (mais seguro que localStorage)
    res.cookie(jwtConfig.cookieName, token, {
      httpOnly: jwtConfig.httpOnly,
      secure: jwtConfig.secure,
      sameSite: jwtConfig.sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias (mesmo que JWT_EXPIRES_IN)
    });

    // Registrar login bem-sucedido (registro = login automático)
    logLoginAttempt({
      email: user.email,
      success: true,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      userId: user.id
    });

    console.log(`[AUTH] Novo usuário registrado: ${user.email} (ID: ${user.id}) - Plano: ${user.plan_id || 'free'}`);

    res.status(201).json({
      message: 'Conta criada com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan_id: user.plan_id,
        videos_used: user.videos_used || 0,
        videos_limit: user.videos_limit || 1,
        role: user.role || 'user'
      },
      token // Manter token no JSON para compatibilidade com frontend existente
    });
  } catch (error) {
    console.error('[AUTH] Erro ao registrar:', error);
    
    if (error.message === 'Email já cadastrado') {
      return res.status(400).json({
        error: error.message,
        code: 'EMAIL_EXISTS'
      });
    }

    res.status(500).json({
      error: 'Erro ao criar conta',
      code: 'REGISTER_ERROR'
    });
  }
};

/**
 * POST /api/auth/login
 * Login de usuário
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('[AUTH] ========================================');
    console.log('[AUTH] 🔐 TENTATIVA DE LOGIN RECEBIDA');
    console.log('[AUTH] Email:', email ? email.substring(0, 5) + '***' : 'VAZIO');
    console.log('[AUTH] IP:', req.ip || req.connection.remoteAddress);
    console.log('[AUTH] User-Agent:', req.get('user-agent') || 'N/A');
    console.log('[AUTH] ========================================');

    // Validações
    if (!email || !password) {
      console.log('[AUTH] ❌ Campos faltando:', { email: !!email, password: !!password });
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    // Buscar usuário
    console.log('[AUTH] 🔍 Buscando usuário no banco...');
    const user = getUserByEmail(email);
    const ipAddress = req.ip;
    const userAgent = req.get('user-agent');

    console.log('[AUTH] Usuário encontrado:', user ? '✅ SIM' : '❌ NÃO');
    if (user) {
      console.log('[AUTH]   ID:', user.id);
      console.log('[AUTH]   Email:', user.email);
      console.log('[AUTH]   Role:', user.role);
      console.log('[AUTH]   Tem password_hash:', !!user.password_hash);
    } else {
      console.log('[AUTH] ❌ Usuário não encontrado para email:', email);
    }

    if (!user) {
      // Registrar tentativa de login falha
      logLoginAttempt({
        email: email,
        success: false,
        ipAddress,
        userAgent
      });

      console.log('[AUTH] ❌ LOGIN FALHOU: Usuário não encontrado');
      console.log('[AUTH] ========================================\n');
      return res.status(401).json({
        error: 'Email ou senha incorretos',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verificar senha
    console.log('[AUTH] 🔐 Verificando senha...');
    const isValidPassword = await verifyPassword(user, password);
    console.log('[AUTH] Senha válida:', isValidPassword ? '✅ SIM' : '❌ NÃO');
    
    if (!isValidPassword) {
      // Registrar tentativa de login falha
      logLoginAttempt({
        email: email,
        success: false,
        ipAddress,
        userAgent,
        userId: user.id
      });

      console.log('[AUTH] ❌ LOGIN FALHOU: Senha incorreta');
      console.log('[AUTH] ========================================\n');
      return res.status(401).json({
        error: 'Email ou senha incorretos',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Gerar token
    const token = generateToken(user);

    // Configurar cookie HttpOnly (mais seguro que localStorage)
    res.cookie(jwtConfig.cookieName, token, {
      httpOnly: jwtConfig.httpOnly,
      secure: jwtConfig.secure,
      sameSite: jwtConfig.sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
    });

    // Registrar login bem-sucedido
    logLoginAttempt({
      email: user.email,
      success: true,
      ipAddress,
      userAgent,
      userId: user.id
    });

    console.log('[AUTH] ✅ LOGIN BEM-SUCEDIDO!');
    console.log('[AUTH]   Usuário:', user.email);
    console.log('[AUTH]   ID:', user.id);
    console.log('[AUTH]   Role:', user.role);
    console.log('[AUTH]   Plano:', user.plan_id);
    console.log('[AUTH] ========================================\n');

    const responseData = {
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan_id: user.plan_id,
        videos_used: user.videos_used || 0,
        videos_limit: user.videos_limit || null,
        role: user.role || 'user'
      },
      token // Manter token no JSON para compatibilidade com frontend existente
    };

    console.log('[AUTH] 📤 Enviando resposta de sucesso ao frontend');
    res.json(responseData);
  } catch (error) {
    console.error('[AUTH] Erro ao fazer login:', error);
    res.status(500).json({
      error: 'Erro ao fazer login',
      code: 'LOGIN_ERROR'
    });
  }
};

/**
 * POST /api/auth/forgot-password
 * Recuperação de senha (mockado)
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email é obrigatório',
        code: 'MISSING_EMAIL'
      });
    }

    // Verificar se email existe
    const user = getUserByEmail(email);
    
    // SEMPRE retornar sucesso (por segurança, não revelar se email existe)
    // Em produção, enviar email de recuperação
    res.json({
      message: 'Se o email existir, você receberá instruções para redefinir sua senha',
      code: 'EMAIL_SENT'
    });
  } catch (error) {
    console.error('[AUTH] Erro ao solicitar recuperação:', error);
    res.status(500).json({
      error: 'Erro ao processar solicitação',
      code: 'FORGOT_PASSWORD_ERROR'
    });
  }
};

/**
 * GET /api/auth/me
 * Obter informações do usuário autenticado
 */
export const getMe = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan_id: user.plan_id,
        videos_used: user.videos_used || 0,
        videos_limit: user.videos_limit || null,
        role: user.role || 'user',
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('[AUTH] Erro ao obter informações do usuário:', error);
    res.status(500).json({
      error: 'Erro ao obter informações do usuário',
      code: 'GET_ME_ERROR'
    });
  }
};
