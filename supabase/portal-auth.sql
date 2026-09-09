-- ICBANQ OPS pilot login profile table.
-- Run this once in Supabase > SQL Editor.

create table if not exists public.portal_profiles (
  email text primary key,
  name text not null,
  korean_name text,
  sales_name text not null,
  team text not null,
  role text not null check (role in ('SALES', 'VIPS')),
  access_role text not null check (access_role in ('admin', 'manager', 'sales')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_profiles enable row level security;

revoke all on table public.portal_profiles from anon;
grant select on table public.portal_profiles to authenticated;

drop policy if exists "Employees can read their own portal profile" on public.portal_profiles;
create policy "Employees can read their own portal profile"
on public.portal_profiles
for select
to authenticated
using (
  active = true
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- ICBANQ email rule: lower-case English name + @icbanq.com.
-- Add the same addresses as invited users in Supabase Authentication.
insert into public.portal_profiles
  (email, name, korean_name, sales_name, team, role, access_role, active)
values
  ('sally@icbanq.com', 'Sally', null, 'Sally', 'VIPS팀', 'VIPS', 'admin', true),
  ('vincent@icbanq.com', 'Vincent', null, 'Vincent', 'VIPS팀', 'VIPS', 'admin', true),
  ('gavin@icbanq.com', 'Gavin', null, 'Gavin', 'VIPS팀', 'VIPS', 'admin', true),
  ('tommy@icbanq.com', 'Tommy', null, 'Tommy', 'Sales본부', 'SALES', 'manager', true),
  ('william@icbanq.com', 'William', null, 'William', 'Sales본부', 'SALES', 'manager', true),
  ('abel@icbanq.com', 'Abel', '유재원', 'Abel', 'B2D', 'SALES', 'sales', true),
  ('ace@icbanq.com', 'Ace', '김문수', 'Ace', 'B2M', 'SALES', 'sales', true),
  ('chris@icbanq.com', 'Chris', '김희찬', 'Chris', 'S2', 'SALES', 'sales', true),
  ('dan@icbanq.com', 'Dan', '강형원', 'Dan', 'B2M', 'SALES', 'sales', true),
  ('donnie@icbanq.com', 'Donnie', '정현도', 'Donnie', 'B2M', 'SALES', 'sales', true),
  ('eric@icbanq.com', 'Eric', '박성현', 'Eric', 'B2D', 'SALES', 'sales', true),
  ('harvey@icbanq.com', 'Harvey', '배석진', 'Harvey', 'B2D', 'SALES', 'sales', true),
  ('heath@icbanq.com', 'Heath', '정희헌', 'Heath', 'B2M', 'SALES', 'sales', true),
  ('jacob@icbanq.com', 'Jacob', '이성민', 'Jacob', 'B2M', 'SALES', 'sales', true),
  ('jenny@icbanq.com', 'Jenny', '박유빈', 'Jenny', 'S2', 'SALES', 'sales', true),
  ('joel@icbanq.com', 'Joel', '강우진', 'Joel', 'B2M', 'SALES', 'sales', true),
  ('junny@icbanq.com', 'Junny', '이주은', 'Junny', 'S2', 'SALES', 'sales', true),
  ('kelvin@icbanq.com', 'Kelvin', '김학원', 'Kelvin', 'B2SU', 'SALES', 'sales', true),
  ('lauren@icbanq.com', 'Lauren', '박승아', 'Lauren', 'B2D', 'SALES', 'manager', true),
  ('leo@icbanq.com', 'Leo', '김유빈', 'Leo', 'S2', 'SALES', 'sales', true),
  ('max@icbanq.com', 'Max', '조명재', 'Max', 'B2M', 'SALES', 'sales', true),
  ('mona@icbanq.com', 'Mona', '이소연', 'Mona', 'B2M', 'SALES', 'sales', true),
  ('morgan@icbanq.com', 'Morgan', '박영진', 'Morgan', 'B2D', 'SALES', 'sales', true),
  ('oscar@icbanq.com', 'Oscar', '유은상', 'Oscar', 'B2SU', 'SALES', 'manager', true),
  ('owen@icbanq.com', 'Owen', '신영욱', 'Owen', 'S3', 'SALES', 'sales', true),
  ('riley@icbanq.com', 'Riley', '박영근', 'Riley', 'B2D', 'SALES', 'sales', true),
  ('robin@icbanq.com', 'Robin', '김의빈', 'Robin', 'S3', 'SALES', 'manager', true),
  ('roger@icbanq.com', 'Roger', '함승영', 'Roger', 'B2M', 'SALES', 'sales', true),
  ('sean@icbanq.com', 'Sean', '황광석', 'Sean', 'B2M', 'SALES', 'sales', true),
  ('sonny@icbanq.com', 'Sonny', '박재은', 'Sonny', 'S2', 'SALES', 'manager', true),
  ('stacey@icbanq.com', 'Stacey', '박소현', 'Stacey', 'S3', 'SALES', 'sales', true),
  ('sunny@icbanq.com', 'Sunny', '김수진', 'Sunny', 'S3', 'SALES', 'sales', true),
  ('swan@icbanq.com', 'Swan', '조선화', 'Swan', 'B2D', 'SALES', 'sales', true),
  ('teo@icbanq.com', 'Teo', '유정민', 'Teo', 'S2', 'SALES', 'sales', true),
  ('terry@icbanq.com', 'Terry', '금우정', 'Terry', 'B2M', 'SALES', 'sales', true),
  ('victor@icbanq.com', 'Victor', '김화영', 'Victor', 'B2M', 'SALES', 'sales', true),
  ('winnie@icbanq.com', 'Winnie', '이시현', 'Winnie', 'B2SU', 'SALES', 'sales', true),
  ('yena@icbanq.com', 'Yena', '이채연', 'Yena', 'S3', 'SALES', 'sales', true),
  ('zeff@icbanq.com', 'Zeff', '임지수', 'Zeff', 'B2M', 'SALES', 'manager', true),
  ('zeke@icbanq.com', 'Zeke', '김상우', 'Zeke', 'B2D', 'SALES', 'sales', true)
on conflict (email) do update set
  name = excluded.name,
  korean_name = excluded.korean_name,
  sales_name = excluded.sales_name,
  team = excluded.team,
  role = excluded.role,
  access_role = excluded.access_role,
  active = excluded.active,
  updated_at = now();
