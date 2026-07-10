-- Supabase Dashboard > SQL Editor에서 전체 내용을 한 번 실행하세요.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) > 0),
  category text not null default '기타',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  start_time time,
  end_time time,
  group_name text not null default 'today'
    check (group_name in ('yesterday', 'today')),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 같은 이름의 테이블이 이미 만들어져 있으면 CREATE TABLE IF NOT EXISTS는
-- 빠진 컬럼을 추가하지 않습니다. 기존 todos 테이블에도 필요한 컬럼을 보완합니다.
alter table public.todos add column if not exists title text;
alter table public.todos add column if not exists category text default '기타';
alter table public.todos add column if not exists priority text default 'medium';
alter table public.todos add column if not exists start_time time;
alter table public.todos add column if not exists end_time time;
alter table public.todos add column if not exists group_name text default 'today';
alter table public.todos add column if not exists done boolean default false;
alter table public.todos add column if not exists created_at timestamptz default now();
alter table public.todos add column if not exists updated_at timestamptz default now();

update public.todos set title = '제목 없는 할 일' where title is null;
update public.todos set category = '기타' where category is null;
update public.todos set priority = 'medium' where priority is null;
update public.todos set group_name = 'today' where group_name is null;
update public.todos set done = false where done is null;
update public.todos set created_at = now() where created_at is null;
update public.todos set updated_at = now() where updated_at is null;

alter table public.todos alter column title set not null;
alter table public.todos alter column category set default '기타';
alter table public.todos alter column category set not null;
alter table public.todos alter column priority set default 'medium';
alter table public.todos alter column priority set not null;
alter table public.todos alter column group_name set default 'today';
alter table public.todos alter column group_name set not null;
alter table public.todos alter column done set default false;
alter table public.todos alter column done set not null;
alter table public.todos alter column created_at set default now();
alter table public.todos alter column created_at set not null;
alter table public.todos alter column updated_at set default now();
alter table public.todos alter column updated_at set not null;

alter table public.todos drop constraint if exists todos_title_not_blank;
alter table public.todos add constraint todos_title_not_blank
  check (char_length(trim(title)) > 0);
alter table public.todos drop constraint if exists todos_priority_check;
alter table public.todos add constraint todos_priority_check
  check (priority in ('low', 'medium', 'high'));
alter table public.todos drop constraint if exists todos_group_name_check;
alter table public.todos add constraint todos_group_name_check
  check (group_name in ('yesterday', 'today'));

alter table public.todos enable row level security;

-- 현재 앱은 로그인 기능이 없으므로 anon 사용자에게 CRUD를 허용합니다.
-- 실제 서비스에 로그인 기능을 추가하면 user_id 기반 정책으로 교체하세요.
drop policy if exists "anon can read todos" on public.todos;
create policy "anon can read todos"
on public.todos for select
to anon
using (true);

drop policy if exists "anon can create todos" on public.todos;
create policy "anon can create todos"
on public.todos for insert
to anon
with check (true);

drop policy if exists "anon can update todos" on public.todos;
create policy "anon can update todos"
on public.todos for update
to anon
using (true)
with check (true);

drop policy if exists "anon can delete todos" on public.todos;
create policy "anon can delete todos"
on public.todos for delete
to anon
using (true);

create or replace function public.set_todos_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row execute function public.set_todos_updated_at();
