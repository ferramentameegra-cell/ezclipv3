/**
 * SCRIPT PARA CRIAR USUÁRIO ADMINISTRADOR
 * Executa via Supabase Admin API
 * 
 * Uso: node scripts/create-admin.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://wrsefdlvqprxjelxkvee.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseServiceKey || supabaseServiceKey.trim() === '') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada!');
  console.error('Configure a variável de ambiente antes de executar este script.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const adminEmail = 'josyasborba@hotmail.com';
const adminPassword = '12345678';
const adminName = 'Josyas Borba';

async function createAdminUser() {
  try {
    console.log(`[ADMIN] Criando usuário administrador: ${adminEmail}...`);

    // 1. Criar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: {
        nome: adminName
      }
    });

    if (authError) {
      // Se o usuário já existe, buscar o ID
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('[ADMIN] Usuário já existe no Auth. Buscando ID...');
        
        const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          throw new Error(`Erro ao listar usuários: ${listError.message}`);
        }

        const existingUser = existingUsers.users.find(u => u.email === adminEmail);
        if (!existingUser) {
          throw new Error('Usuário não encontrado no Auth');
        }

        console.log(`[ADMIN] Usuário encontrado: ${existingUser.id}`);
        
        // Atualizar usuário para confirmar email
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingUser.id,
          {
            email_confirm: true,
            user_metadata: {
              nome: adminName
            }
          }
        );

        if (updateError) {
          console.warn(`[ADMIN] Aviso ao atualizar usuário: ${updateError.message}`);
        }

        // 2. Criar/Atualizar registro na tabela users
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: existingUser.id,
            nome: adminName,
            email: adminEmail,
            creditos: -1, // Ilimitado
            role: 'admin' // Adicionar campo role se existir
          }, {
            onConflict: 'id'
          })
          .select()
          .single();

        if (userError) {
          // Se a tabela não tiver campo role, tentar sem ele
          const { data: userData2, error: userError2 } = await supabaseAdmin
            .from('users')
            .upsert({
              id: existingUser.id,
              nome: adminName,
              email: adminEmail,
              creditos: -1
            }, {
              onConflict: 'id'
            })
            .select()
            .single();

          if (userError2) {
            throw new Error(`Erro ao criar/atualizar registro na tabela users: ${userError2.message}`);
          }

          console.log('[ADMIN] ✅ Registro na tabela users atualizado (sem role):', userData2);
        } else {
          console.log('[ADMIN] ✅ Registro na tabela users atualizado:', userData);
        }

        console.log('\n✅ USUÁRIO ADMINISTRADOR CONFIGURADO COM SUCESSO!');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Senha: ${adminPassword}`);
        console.log(`   ID: ${existingUser.id}`);
        console.log(`   Créditos: Ilimitados (-1)`);
        console.log(`   Email confirmado: Sim`);
        return;
      }
      throw authError;
    }

    if (!authData || !authData.user) {
      throw new Error('Usuário não foi criado - dados não retornados');
    }

    console.log(`[ADMIN] ✅ Usuário criado no Auth: ${authData.user.id}`);

    // 2. Criar registro na tabela users com créditos ilimitados
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authData.user.id,
        nome: adminName,
        email: adminEmail,
        creditos: -1, // Ilimitado
        role: 'admin' // Adicionar campo role se existir
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (userError) {
      // Se a tabela não tiver campo role, tentar sem ele
      const { data: userData2, error: userError2 } = await supabaseAdmin
        .from('users')
        .upsert({
          id: authData.user.id,
          nome: adminName,
          email: adminEmail,
          creditos: -1
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (userError2) {
        throw new Error(`Erro ao criar registro na tabela users: ${userError2.message}`);
      }

      console.log('[ADMIN] ✅ Registro na tabela users criado (sem role):', userData2);
    } else {
      console.log('[ADMIN] ✅ Registro na tabela users criado:', userData);
    }

    console.log('\n✅ USUÁRIO ADMINISTRADOR CRIADO COM SUCESSO!');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Senha: ${adminPassword}`);
    console.log(`   ID: ${authData.user.id}`);
    console.log(`   Créditos: Ilimitados (-1)`);
    console.log(`   Email confirmado: Sim`);

  } catch (error) {
    console.error('\n❌ ERRO ao criar usuário administrador:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Executar
createAdminUser();
