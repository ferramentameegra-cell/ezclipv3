/**
 * MODELO DE USUÁRIO
 * Armazenamento em memória (Map) - pode ser migrado para banco de dados posteriormente
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Store de usuários (simula banco de dados)
export const userStore = new Map();

// Valores padrão
const FREE_TRIAL_CREDITS = 5;

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

  // Criar usuário
  const user = {
    id: uuidv4(),
    name,
    email,
    password_hash: passwordHash,
    plan_id: null,
    credits_balance: 0,
    free_trial_credits: FREE_TRIAL_CREDITS,
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
    credits_balance: user.credits_balance,
    free_trial_credits: user.free_trial_credits,
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
    plan_id: user.plan_id,
    credits_balance: user.credits_balance,
    free_trial_credits: user.free_trial_credits,
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
    plan_id: user.plan_id,
    credits_balance: user.credits_balance,
    free_trial_credits: user.free_trial_credits,
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
    plan_id: updatedUser.plan_id,
    credits_balance: updatedUser.credits_balance,
    free_trial_credits: updatedUser.free_trial_credits,
    role: updatedUser.role || 'user',
    created_at: updatedUser.created_at,
    updated_at: updatedUser.updated_at
  };
}

/**
 * Adicionar créditos ao usuário
 */
export function addCredits(userId, credits) {
  const user = userStore.get(userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  return updateUser(userId, {
    credits_balance: user.credits_balance + credits
  });
}

/**
 * Obter saldo total de créditos (free trial + pagos)
 * Admin retorna null (ilimitado)
 */
export function getTotalCredits(userId) {
  const user = userStore.get(userId);
  if (!user) return 0;

  // Admin tem créditos ilimitados
  if (user.role === 'admin') {
    return null; // null = ilimitado
  }

  // Tratar null como 0 para cálculos
  const freeTrial = user.free_trial_credits ?? 0;
  const paid = user.credits_balance ?? 0;

  return freeTrial + paid;
}

/**
 * Verificar se usuário tem créditos suficientes
 * Admin sempre tem créditos ilimitados
 */
export function hasEnoughCredits(userId, requiredCredits = 1) {
  const user = userStore.get(userId);
  if (!user) return false;
  
  // Admin sempre tem créditos ilimitados
  if (user.role === 'admin') {
    return true;
  }
  
  return getTotalCredits(userId) >= requiredCredits;
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
    plan_id: null,
    credits_balance: null, // null = ilimitado
    free_trial_credits: null, // null = não aplicável
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
