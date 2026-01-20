-- ============================================
-- SCRIPT SQL: Criar/Atualizar Usuário Administrador
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- 
-- IMPORTANTE: Este script assume que o usuário já foi criado
-- via Auth (signup) ou via API. Ele apenas atualiza a tabela users.
-- 
-- Se o usuário ainda não existe, você precisa:
-- 1. Criar via Dashboard > Authentication > Users > Add User
-- 2. Ou usar o script create-admin.js
-- ============================================

-- Primeiro, vamos buscar o ID do usuário pelo email
DO $$
DECLARE
    user_id UUID;
    user_email TEXT := 'josyasborba@hotmail.com';
    user_name TEXT := 'Josyas Borba';
BEGIN
    -- Buscar ID do usuário na tabela auth.users
    SELECT id INTO user_id
    FROM auth.users
    WHERE email = user_email;

    IF user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário com email % não encontrado. Crie o usuário primeiro via Authentication > Users ou use o script create-admin.js', user_email;
    END IF;

    -- Criar ou atualizar registro na tabela users
    INSERT INTO public.users (id, nome, email, creditos, created_at, updated_at)
    VALUES (user_id, user_name, user_email, -1, NOW(), NOW())
    ON CONFLICT (id) 
    DO UPDATE SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        creditos = -1, -- Ilimitado
        updated_at = NOW();

    RAISE NOTICE '✅ Usuário administrador configurado com sucesso!';
    RAISE NOTICE '   ID: %', user_id;
    RAISE NOTICE '   Email: %', user_email;
    RAISE NOTICE '   Créditos: Ilimitados (-1)';
END $$;

-- Verificar se foi criado corretamente
SELECT 
    id,
    nome,
    email,
    creditos,
    CASE 
        WHEN creditos = -1 THEN 'Ilimitados'
        ELSE creditos::TEXT
    END as creditos_display,
    created_at,
    updated_at
FROM public.users
WHERE email = 'josyasborba@hotmail.com';
