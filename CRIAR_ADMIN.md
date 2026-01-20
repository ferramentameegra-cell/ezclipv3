# Criar Usuário Administrador

Este guia mostra como criar o usuário administrador `josyasborba@hotmail.com` com créditos ilimitados.

## Opção 1: Via Script Node.js (Recomendado)

### No Railway (via Terminal):

1. Acesse o Railway Dashboard
2. Vá em **Deployments** > Selecione seu serviço
3. Clique em **View Logs** ou **Open Terminal**
4. Execute:

```bash
node scripts/create-admin.js
```

### Localmente:

1. Configure as variáveis de ambiente no arquivo `.env`:
```bash
SUPABASE_URL=https://wrsefdlvqprxjelxkvee.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui
SUPABASE_ANON_KEY=sua_chave_aqui
```

2. Execute:
```bash
npm run create-admin
```

## Opção 2: Via SQL no Supabase Dashboard

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Execute o script `scripts/create-admin-sql.sql`

**IMPORTANTE**: Este método assume que o usuário já foi criado via Authentication. Se não foi criado:

1. Vá em **Authentication** > **Users** > **Add User**
2. Preencha:
   - Email: `josyasborba@hotmail.com`
   - Password: `12345678`
   - Auto Confirm User: ✅ (marcar)
3. Clique em **Create User**
4. Depois execute o script SQL

## Opção 3: Via API (Endpoint Admin)

Você pode criar um endpoint temporário no backend para executar isso uma vez. Mas por segurança, é melhor usar as opções acima.

## Verificação

Após criar o usuário, verifique:

1. **No Supabase Dashboard**:
   - Vá em **Table Editor** > `users`
   - Procure por `josyasborba@hotmail.com`
   - Verifique se `creditos = -1`

2. **Teste de Login**:
   - Faça login no frontend com:
     - Email: `josyasborba@hotmail.com`
     - Senha: `12345678`
   - Verifique se os créditos aparecem como "Ilimitados"

## Dados do Administrador

- **Email**: `josyasborba@hotmail.com`
- **Senha**: `12345678`
- **Créditos**: `-1` (Ilimitados)
- **Email Confirmado**: Sim
