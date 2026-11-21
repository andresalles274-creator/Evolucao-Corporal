# Auditoria de segurança e desempenho — 21/11/2026

## Escopo
Projeto Supabase Evolução Corporal (ref gfwdfskjoiyfrbqntkou). Diagnóstico de leitura realizado. Este documento não aplica mudanças ao banco em produção.

## Achados confirmados
- Todas as 29 tabelas do esquema public listadas pela API têm RLS habilitada; isso não garante que cada política esteja correta.
- O analisador do Supabase apontou funções SECURITY DEFINER executáveis pelos papéis anon/authenticated. Nem toda exposição é uma falha: funções de cadastro e funções destinadas ao aplicativo podem exigir EXECUTE.
- public.handle_new_user() retorna trigger, mas possui EXECUTE para anon e authenticated. A invocação direta não é a finalidade dessa função; verificar dependências antes de revogar.
- public.record_completed_training_session() também é uma função trigger e tem EXECUTE para anon/authenticated; revisar a revogação de execução direta.
- public.rls_auto_enable() retorna event_trigger e tem EXECUTE para anon/authenticated; revisar a revogação de execução direta.
- public.prepare_student_registration(registration_email, intake_payload) aceita anon intencionalmente para cadastro. O código valida entrada, limita a cinco tentativas por e-mail por hora e elimina rascunhos antigos. O limite por e-mail não equivale a limite global por IP; testar abuso e custo antes de alterar.
- public.archive_student() verifica is_coach() e impede autoarquivamento e arquivamento de outro coach. O alerta genérico não prova bypass.
- 17 chaves estrangeiras sem índice de apoio, e 38 alertas de avaliação repetida de auth.* em políticas RLS; otimização depende de análise de consultas e testes.

## Próximos passos seguros
1. Confirmar quais triggers dependem das três funções de trigger/event_trigger e testar revogação de EXECUTE em ambiente isolado.
2. Revisar funções SECURITY DEFINER uma a uma, com atenção a permissões, search_path, parâmetros e chamadas do frontend.
3. Inventariar índices existentes e medir planos de execução antes de criar novos índices.
4. Revisar políticas RLS com testes para aluno A, aluno B, coach e usuário anônimo.
5. Criar migrações pequenas, reversíveis, revisar e validar antes de aplicar ao projeto ativo.

## Critérios de aceite
- Cadastro e login não sofrem regressão.
- Aluno não acessa dados de outro aluno.
- Coach autorizado mantém operações legítimas.
- Sem aumento perceptível de latência.
- Nenhuma alteração direta na branch main sem revisão.

## Referências
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys
- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
