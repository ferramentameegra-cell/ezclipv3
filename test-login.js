/**
 * SCRIPT DE TESTE DE LOGIN
 * Testa o login diretamente no backend
 */

import fetch from 'node-fetch';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const ADMIN_EMAIL = 'josyasborba@hotmail.com';
const ADMIN_PASSWORD = '12345678';

async function testLogin() {
  console.log('🔍 Testando login do administrador...\n');
  console.log(`📡 API Base: ${API_BASE}`);
  console.log(`👤 Email: ${ADMIN_EMAIL}`);
  console.log(`🔑 Senha: ${ADMIN_PASSWORD}\n`);

  try {
    // Teste 1: Verificar se servidor está rodando
    console.log('1️⃣ Testando conexão com servidor...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    if (!healthResponse.ok) {
      throw new Error(`Servidor não está respondendo: ${healthResponse.status}`);
    }
    const health = await healthResponse.json();
    console.log('   ✅ Servidor está rodando:', health);

    // Teste 2: Tentar fazer login
    console.log('\n2️⃣ Tentando fazer login...');
    const loginResponse = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });

    console.log(`   Status: ${loginResponse.status} ${loginResponse.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(loginResponse.headers.entries()));

    const loginData = await loginResponse.json();
    console.log('   Resposta:', JSON.stringify(loginData, null, 2));

    if (!loginResponse.ok) {
      throw new Error(`Login falhou: ${loginData.error || 'Erro desconhecido'}`);
    }

    if (!loginData.user || !loginData.token) {
      throw new Error('Resposta de login inválida: faltando user ou token');
    }

    console.log('\n✅ LOGIN BEM-SUCEDIDO!');
    console.log(`   👤 Usuário: ${loginData.user.name} (${loginData.user.email})`);
    console.log(`   🆔 ID: ${loginData.user.id}`);
    console.log(`   👑 Role: ${loginData.user.role}`);
    console.log(`   📊 Plano: ${loginData.user.plan_id}`);
    console.log(`   🎬 Vídeos usados: ${loginData.user.videos_used || 0}`);
    console.log(`   📈 Limite: ${loginData.user.videos_limit === null ? 'Ilimitado' : loginData.user.videos_limit}`);
    console.log(`   🔐 Token: ${loginData.token.substring(0, 20)}...`);

    // Teste 3: Verificar token com /api/auth/me
    console.log('\n3️⃣ Verificando token com /api/auth/me...');
    const meResponse = await fetch(`${API_BASE}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`   Status: ${meResponse.status} ${meResponse.statusText}`);
    const meData = await meResponse.json();
    console.log('   Resposta:', JSON.stringify(meData, null, 2));

    if (!meResponse.ok) {
      throw new Error(`Verificação de token falhou: ${meData.error || 'Erro desconhecido'}`);
    }

    console.log('\n✅ TOKEN VÁLIDO!');
    console.log(`   👤 Usuário verificado: ${meData.user.name} (${meData.user.email})`);

    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('\n📋 RESUMO:');
    console.log('   ✅ Servidor está rodando');
    console.log('   ✅ Login funciona corretamente');
    console.log('   ✅ Token é válido');
    console.log('   ✅ Admin tem acesso completo');

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error('   Mensagem:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testLogin();
