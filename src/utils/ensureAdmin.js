/**
 * GARANTIR QUE ADMIN EXISTE
 * Executa sempre que o servidor inicia para garantir que admin existe
 */

import { userStore } from '../models/users.js';
import { createAdminUser } from '../models/users.js';

export async function ensureAdminExists() {
  try {
    // Verificar se admin já existe
    const existingAdmin = Array.from(userStore.values()).find(
      u => u.email === 'josyasborba@hotmail.com' && u.role === 'admin'
    );
    
    if (existingAdmin) {
      console.log('[ENSURE_ADMIN] ✅ Admin já existe:', existingAdmin.email);
      return existingAdmin;
    }

    // Criar admin se não existir
    console.log('[ENSURE_ADMIN] 🔧 Criando admin...');
    const adminUser = await createAdminUser({
      name: 'Josyas Borba',
      email: 'josyasborba@hotmail.com',
      password: '12345678'
    });

    console.log('[ENSURE_ADMIN] ✅ Admin criado com sucesso!');
    console.log(`[ENSURE_ADMIN] 👤 Email: ${adminUser.email}`);
    console.log(`[ENSURE_ADMIN] 🔑 Senha: 12345678`);
    console.log(`[ENSURE_ADMIN] 🆔 ID: ${adminUser.id}`);
    
    return adminUser;
  } catch (error) {
    console.error('[ENSURE_ADMIN] ❌ Erro ao garantir admin:', error);
    throw error;
  }
}
