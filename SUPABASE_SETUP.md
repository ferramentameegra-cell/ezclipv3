# Configuração do Supabase Auth

Este projeto usa **Supabase Auth** para autenticação completa, incluindo:
- Cadastro de usuários
- Login seguro
- Verificação de email obrigatória
- Controle de créditos (1 crédito = 1 vídeo)

## 📋 Pré-requisitos

1. Conta no Supabase: https://supabase.com
2. Projeto criado no Supabase
3. Credenciais do projeto:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (pública - frontend)
   - `SUPABASE_SERVICE_ROLE_KEY` (privada - backend)

## 🔧 Configuração

### 1. Variáveis de Ambiente (Backend)

Adicione as seguintes variáveis no Railway (ou seu ambiente de produção):

```bash
SUPABASE_URL=https://wrsefdlvqprxjelxkvee.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5MjExNjIsImV4cCI6MjA4NDQ5NzE2Mn0.gY7SYyAh0g6fjGbaFw9VT_h35Slq6NZysCf9gcd4CQI
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyc2VmZGx2cXByeGplbHhrdmVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODkyMTE2MiwiZXhwIjoyMDg0NDk3MTYyfQ.0_9aOOKD7dJYRJDPTnpOhWbf41ggbS1r37zChwJCpZk
```

### 2. Criar Tabela e Trigger no Supabase

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **SQL Editor**
4. Execute o script `supabase-trigger.sql`:

```sql
-- Criar tabela users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  creditos INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ler apenas seus próprios dados
CREATE POLICY "Users can read own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Política: Usuários podem atualizar apenas seus próprios dados
CREATE POLICY "Users can update own data"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Função para criar registro na tabela users quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, nome, email, creditos)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    1 -- Todo usuário inicia com 1 crédito
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que executa a função quando um novo usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### 3. Configurar Email de Confirmação (Opcional)

No Supabase Dashboard:
1. Vá em **Authentication** > **Email Templates**
2. Configure o template de confirmação de email
3. Configure o **Site URL** em **Authentication** > **URL Configuration**

## ✅ Verificação

Após configurar:

1. **Teste de Cadastro:**
   - Crie uma conta via frontend
   - Verifique se recebeu email de confirmação
   - Confirme o email
   - Verifique se um registro foi criado na tabela `users` com `creditos = 1`

2. **Teste de Login:**
   - Faça login com email e senha
   - Verifique se a sessão é mantida
   - Verifique se os créditos são exibidos corretamente

3. **Teste de Geração:**
   - Gere um vídeo
   - Verifique se 1 crédito foi decrementado após geração bem-sucedida

## 🔒 Segurança

- ✅ Senhas **NUNCA** são salvas no banco (gerenciadas pelo Supabase)
- ✅ Frontend usa apenas `SUPABASE_ANON_KEY` (pública)
- ✅ Backend usa `SUPABASE_SERVICE_ROLE_KEY` (privada - nunca expor)
- ✅ Email de confirmação é **obrigatório**
- ✅ Créditos são controlados apenas no backend
- ✅ Frontend **NUNCA** decrementa créditos diretamente

## 📝 Regras de Créditos

- **1 crédito = 1 vídeo gerado**
- Todo usuário inicia com **1 crédito**
- Créditos são decrementados **apenas após geração bem-sucedida**
- Se `creditos = -1`: créditos ilimitados (admin)
- Se `creditos = 0`: bloqueado (não pode gerar vídeos)

## 🐛 Troubleshooting

### Erro: "Email não confirmado"
- Verifique se o email de confirmação foi enviado
- Verifique a pasta de spam
- Use a função "Reenviar email de confirmação" no frontend

### Erro: "Trigger não executou"
- Verifique se o trigger foi criado corretamente
- Verifique os logs do Supabase
- Crie manualmente o registro na tabela `users` se necessário

### Erro: "Token inválido"
- Verifique se as variáveis de ambiente estão configuradas corretamente
- Verifique se o token não expirou
- Faça logout e login novamente

## 📚 Documentação

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
