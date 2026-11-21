# Continuação de otimização — 21/11/2026

## Aplicado no Supabase ativo
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diet_plans_user_id_fk ON public.diet_plans(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_exercise_library_created_by_fk ON public.exercise_library(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_checkins_training_day_id_fk ON public.training_checkins(training_day_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_training_plans_created_by_fk ON public.training_plans(created_by);
```

Verificação via pg_index: todos indisvalid=true e indisready=true. Advisor unindexed_foreign_keys caiu de 14 para 10.

## Revisão de RLS (leitura, sem mudanças)
- profiles: três políticas usam auth.uid() diretamente e is_coach(); precisam de avaliação funcional antes de reescrita.
- daily_checkins: políticas separadas para aluno e coach; sobreposição pode ser intencional.
- progress_photos: políticas ALL, políticas por operação e student_account_access_gate; sobreposição exige atenção à semântica permissiva OR, especialmente para restrição de acesso de alunos suspensos. NÃO remover ou reescrever sem testes.
- student_intakes: SELECT para aluno ou coach.

## Pendências
10 chaves estrangeiras sem índices; 38 avisos de auth_rls_initplan; 9 avisos multiple_permissive_policies; testes de login, cadastro e permissões de aluno/coach ainda pendentes.

## Rollback dos índices
```sql
DROP INDEX CONCURRENTLY IF EXISTS public.idx_diet_plans_user_id_fk;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_exercise_library_created_by_fk;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_training_checkins_training_day_id_fk;
DROP INDEX CONCURRENTLY IF EXISTS public.idx_training_plans_created_by_fk;
```
