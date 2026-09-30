-- Evolucao Corporal - mensalidades
create table if not exists public.student_payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 due_date date not null,
 amount numeric(10,2),
 status text not null default 'pending' check (status in ('pending','paid')),
 paid_at timestamptz,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists student_payments_user_due_idx on public.student_payments(user_id,due_date desc);
alter table public.student_payments enable row level security;
drop policy if exists "student_reads_own_payments" on public.student_payments;
create policy "student_reads_own_payments" on public.student_payments for select using (auth.uid()=user_id);
drop policy if exists "coach_manages_payments" on public.student_payments;
create policy "coach_manages_payments" on public.student_payments for all using (exists(select 1 from public.coach_users c where c.user_id=auth.uid())) with check (exists(select 1 from public.coach_users c where c.user_id=auth.uid()));
