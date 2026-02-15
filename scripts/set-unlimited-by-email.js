/**
 * Define plano Unlimited (créditos ilimitados) para um usuário pelo email.
 *
 * Uso: node scripts/set-unlimited-by-email.js [email]
 * Exemplo: node scripts/set-unlimited-by-email.js adgravataimidia@gmail.com
 *
 * Requer: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env ou ambiente.
 * Se preferir, no Supabase Dashboard: Table Editor → users → localize o id do
 * usuário (auth.users) e na linha da tabela public.users defina creditos = -1.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2] || 'adgravataimidia@gmail.com';
const supabaseUrl = process.env.SUPABASE_URL || 'https://wrsefdlvqprxjelxkvee.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseServiceKey || supabaseServiceKey.length < 20) {
  console.error('Erro: SUPABASE_SERVICE_ROLE_KEY não configurada. Defina no .env ou ambiente.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setUnlimitedByEmail(userEmail) {
  console.log('Buscando usuário com email:', userEmail);

  // Listar usuários do Auth e encontrar pelo email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error('Erro ao listar usuários:', listError.message);
    process.exit(1);
  }

  const authUser = users?.find((u) => u.email?.toLowerCase() === userEmail.toLowerCase());
  if (!authUser) {
    console.error('Usuário não encontrado com email:', userEmail);
    process.exit(1);
  }

  const userId = authUser.id;
  console.log('Usuário encontrado. ID:', userId);

  // Atualizar tabela public.users: plano unlimited (creditos + subscription)
  const updates = {
    creditos: -1,
    plan_name: 'unlimited',
    videos_allowed: -1,
    videos_used: 0,
    subscription_status: 'active'
  };

  const { data: row, error: updateError } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (updateError) {
    // Se a linha não existir, inserir
    if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
      const { error: insertError } = await supabase.from('users').upsert(
        { id: userId, ...updates },
        { onConflict: 'id' }
      );
      if (insertError) {
        console.error('Erro ao inserir/atualizar usuário:', insertError.message);
        process.exit(1);
      }
      console.log('Registro criado com plano Unlimited.');
    } else {
      console.error('Erro ao atualizar:', updateError.message);
      process.exit(1);
    }
  } else {
    console.log('Plano Unlimited aplicado para', userEmail, '- videos ilimitados');
  }
}

setUnlimitedByEmail(email).then(() => {
  console.log('Concluído.');
});
