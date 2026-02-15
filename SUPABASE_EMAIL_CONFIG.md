# Configurar emails por usuário no Supabase

## Problema

O limite do Supabase é **global** (não por usuário): **2 emails por hora para toda a plataforma**.  
Se 2 pessoas pedirem "Esqueci minha senha" em 1 hora, todos os outros usuários ficam bloqueados até a próxima hora.

## Solução: Custom SMTP

É a **única forma** de permitir que vários usuários alterem a senha ao mesmo tempo. Com Custom SMTP, o limite passa a ser do seu provedor (muito maior e, em geral, por usuário/destinatário).

1. Acesse **Supabase Dashboard** → seu projeto
2. Vá em **Project Settings** → **Auth** → **SMTP Settings**
3. Ative **Custom SMTP**
4. Configure um provedor (gratuito ou pago):
   - **Brevo** (Sendinblue): 300 emails/dia grátis
   - **Resend**: 100 emails/dia grátis
   - **AWS SES**: ~62.000/mês grátis (12 meses)
   - **Mailgun**, **SendGrid**, etc.

5. Preencha:
   - Host, Port, User, Password (do provedor)
   - Sender email (ex: noreply@seudominio.com)
   - Sender name (ex: EZ Clips AI)

Depois disso, o limite de emails será o do seu provedor SMTP, não mais o do Supabase.
