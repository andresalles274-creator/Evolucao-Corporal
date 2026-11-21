# Correção de permissões de funções internas — 21/11/2026

## Alteração aplicada ao projeto Supabase ativo
Projeto: gfwdfskjoiyfrbqntkou

Revogado EXECUTE de PUBLIC, anon e authenticated em:
- public.handle_new_user()
- public.record_completed_training_session()
- public.rls_auto_enable()

Comando executado em transação:
```sql
BEGIN;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_completed_training_session() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
COMMIT;
```

## Validação
- has_function_privilege('anon', ..., 'EXECUTE') = false nas três funções.
- has_function_privilege('authenticated', ..., 'EXECUTE') = false nas três funções.
- Avisos de funções SECURITY DEFINER acessíveis por anon: 4 → 1.
- Avisos de funções SECURITY DEFINER acessíveis por authenticated: 13 → 10.
- Nenhum código frontend, login, política RLS ou estrutura de tabela foi alterado.

## Limitações e acompanhamento
- A validação confirma permissões e avisos; não substitui testes reais de cadastro, login e conclusão de treino.
- A função prepare_student_registration permanece acessível a anon porque é usada no cadastro público.
- Não remover acesso das outras funções sem examinar os fluxos do aplicativo e testar permissões por perfil.
- Reversão emergencial das três funções, se necessária: GRANT EXECUTE ON FUNCTION ... TO anon, authenticated; restaurar somente as concessões apropriadas conforme histórico de privilégios.

## Próximo ciclo
Investigar os 17 índices ausentes e os avisos RLS; testar em ambiente isolado antes de otimizar produção.
