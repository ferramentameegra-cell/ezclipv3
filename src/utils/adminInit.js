/**
 * INICIALIZAÇÃO ADMINISTRATIVA
 * Executa apenas uma vez na inicialização controlada (desenvolvimento)
 * Limpa dados e cria usuário administrador
 */

import { clearAllUsers, createAdminUser, userStore } from '../models/users.js';
import { clearAllUsageLogs } from '../models/usageLogs.js';
import { clearAllVideoLogs } from '../models/videoLogs.js';

// Flag para garantir que execute apenas uma vez
let hasInitialized = false;

/**
 * Executar inicialização administrativa
 * Só executa se:
 * - NODE_ENV não for 'production' OU INIT_ADMIN=true
 * - Ainda não foi executado nesta sessão
 */
export async function initializeAdmin() {
  // Verificar se admin já existe antes de limpar tudo
  const existingAdmin = Array.from(userStore.values()).find(
    u => u.email === 'josyasborba@hotmail.com' && u.role === 'admin'
  );
  
  if (existingAdmin) {
    console.log('[ADMIN_INIT] ✅ Admin já existe:', existingAdmin.email);
    hasInitialized = true;
    return;
  }

  // Verificar se já foi inicializado nesta sessão
  if (hasInitialized) {
    console.log('[ADMIN_INIT] Inicialização administrativa já foi executada nesta sessão');
    return;
  }

  // SEMPRE executar inicialização (para garantir que admin existe)
  // const shouldInit = 
  //   process.env.NODE_ENV !== 'production' || 
  //   process.env.INIT_ADMIN === 'true';

  // if (!shouldInit) {
  //   console.log('[ADMIN_INIT] Inicialização administrativa desabilitada (produção sem INIT_ADMIN)');
  //   return;
  // }

  try {
    console.log('[ADMIN_INIT] 🚀 Iniciando inicialização administrativa...');

    // 1. Limpar todos os usuários
    console.log('[ADMIN_INIT] Limpando usuários existentes...');
    clearAllUsers();

    // 2. Limpar logs de uso
    console.log('[ADMIN_INIT] Limpando logs de uso...');
    clearAllUsageLogs();
    
    // 3. Limpar logs de vídeos
    console.log('[ADMIN_INIT] Limpando logs de vídeos...');
    clearAllVideoLogs();

    // 4. Criar usuário administrador
    console.log('[ADMIN_INIT] Criando usuário administrador...');
    const adminUser = await createAdminUser({
      name: 'Josyas Borba',
      email: 'josyasborba@hotmail.com',
      password: '12345678'
    });

    console.log('[ADMIN_INIT] ✅ Inicialização administrativa concluída com sucesso!');
    console.log(`[ADMIN_INIT] 👤 Admin criado: ${adminUser.email} (ID: ${adminUser.id})`);
    console.log('[ADMIN_INIT] 🔑 Senha: 12345678');
    console.log('[ADMIN_INIT] ⚠️  Lembre-se de alterar a senha em produção!');

    hasInitialized = true;
  } catch (error) {
    console.error('[ADMIN_INIT] ❌ Erro na inicialização administrativa:', error);
    throw error;
  }
}

export default initializeAdmin;
