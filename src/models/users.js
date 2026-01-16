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
 */
export function getTotalCredits(userId) {
  const user = userStore.get(userId);
  if (!user) return 0;

  return user.free_trial_credits + user.credits_balance;
}

/**
 * Verificar se usuário tem créditos suficientes
 */
export function hasEnoughCredits(userId, requiredCredits = 1) {
  return getTotalCredits(userId) >= requiredCredits;
}
