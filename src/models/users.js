/**
 * MODELO DE USUÁRIO
 * Armazenamento em memória (Map) - pode ser migrado para banco de dados posteriormente
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Store de usuários (simula banco de dados)
export const userStore = new Map();

// Valores padrão
const FREE_PLAN_ID = 'free'; // Plano free por padrão

/**
 * Criar novo usuário
 */
export async function createUser({ name, email, password }) {
  // Verificar se email já existe
  const existingUser = Array.from(userStore.values()).find(u => u.email === email);
  if (existingUser) {
    throw new Error('Email já cadastrado');
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(password, 10);

  // Criar usuário com plano free por padrão
  const user = {
    id: uuidv4(),
    name,
    email,
    password_hash: passwordHash,
    plan_id: FREE_PLAN_ID, // Plano free por padrão
    videos_used: 0,
    videos_limit: 1, // Plano free = 1 vídeo
    role: 'user', // 'user' ou 'admin'
    created_at: new Date(),
    updated_at: new Date()
  };

  userStore.set(user.id, user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan_id: user.plan_id,
    videos_used: user.videos_used,
    videos_limit: user.videos_limit,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

/**
 * Buscar usuário por ID
 */
export function getUserById(userId) {
  const user = userStore.get(userId);
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan_id: user.plan_id || null,
    videos_used: user.videos_used ?? 0,
    videos_limit: user.videos_limit ?? null,
    role: user.role || 'user',
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

/**
 * Buscar usuário por email
 */
export function getUserByEmail(email) {
  const user = Array.from(userStore.values()).find(u => u.email === email);
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password_hash: user.password_hash,
    plan_id: user.plan_id || null,
    videos_used: user.videos_used ?? 0,
    videos_limit: user.videos_limit ?? null,
    role: user.role || 'user',
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

/**
 * Verificar senha
 */
export async function verifyPassword(user, password) {
  if (!user || !user.password_hash) {
    return false;
  }
  return await bcrypt.compare(password, user.password_hash);
}

/**
 * Atualizar usuário
 */
export function updateUser(userId, updates) {
  const user = userStore.get(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  const updatedUser = {
    ...user,
    ...updates,
    updated_at: new Date()
  };

  userStore.set(userId, updatedUser);

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    plan_id: updatedUser.plan_id || null,
    videos_used: updatedUser.videos_used ?? 0,
    videos_limit: updatedUser.videos_limit ?? null,
    role: updatedUser.role || 'user',
    created_at: updatedUser.created_at,
    updated_at: updatedUser.updated_at
  };
}

/**
 * Incrementar contador de vídeos processados
 */
export function incrementVideosUsed(userId) {
  const user = userStore.get(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  return updateUser(userId, {
    videos_used: (user.videos_used ?? 0) + 1
  });
}

/**
 * Verificar se usuário pode processar mais vídeos
 * Admin e plano unlimited sempre podem
 */
export function canProcessVideo(userId) {
  const user = userStore.get(userId);
  if (!user) return false;

  // Admin sempre pode processar
  if (user.role === 'admin') {
    return true;
  }

  // Plano unlimited (videos_limit === null)
  if (user.videos_limit === null) {
    return true;
  }

  // Verificar se ainda tem vídeos disponíveis
  const videosUsed = user.videos_used ?? 0;
  const videosLimit = user.videos_limit ?? 0;

  return videosUsed < videosLimit;
}

/**
 * Obter informações de vídeos do usuário
 */
export function getUserVideoInfo(userId) {
  const user = userStore.get(userId);
  if (!user) {
    return {
      videos_used: 0,
      videos_limit: null,
      videos_remaining: null,
      is_unlimited: false
    };
  }

  // Admin sempre ilimitado
  if (user.role === 'admin') {
    return {
      videos_used: user.videos_used ?? 0,
      videos_limit: null,
      videos_remaining: null,
      is_unlimited: true
    };
  }

  const videosUsed = user.videos_used ?? 0;
  const videosLimit = user.videos_limit;

  // Plano unlimited
  if (videosLimit === null) {
    return {
      videos_used: videosUsed,
      videos_limit: null,
      videos_remaining: null,
      is_unlimited: true
    };
  }

  // Plano com limite
  const videosRemaining = Math.max(0, videosLimit - videosUsed);

  return {
    videos_used: videosUsed,
    videos_limit: videosLimit,
    videos_remaining: videosRemaining,
    is_unlimited: false
  };
}

/**
 * Verificar se usuário é administrador
 */
export function isAdmin(userId) {
  const user = userStore.get(userId);
  return user && user.role === 'admin';
}

/**
 * Limpar todos os usuários (apenas para inicialização)
 */
export function clearAllUsers() {
  userStore.clear();
  console.log('[USERS] Todos os usuários foram removidos');
}

/**
 * Criar usuário administrador
 */
export async function createAdminUser({ name, email, password }) {
  // Hash da senha
  const passwordHash = await bcrypt.hash(password, 10);

  // Criar usuário admin
  const adminUser = {
    id: uuidv4(),
    name,
    email,
    password_hash: passwordHash,
    plan_id: 'unlimited', // Admin tem plano unlimited
    videos_used: 0,
    videos_limit: null, // null = ilimitado
    role: 'admin',
    created_at: new Date(),
    updated_at: new Date()
  };

  userStore.set(adminUser.id, adminUser);

  console.log(`[USERS] Usuário administrador criado: ${email} (ID: ${adminUser.id})`);

  return {
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
    created_at: adminUser.created_at
  };
}
