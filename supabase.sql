-- UChat starter schema. Run this in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'UChat user' check (char_length(display_name) between 1 and 40),
  avatar_url text,
  updated_at timestamptz not null default now()
);
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Direct chat' check (char_length(name) between 1 and 80),
  is_group boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  image_url text,
  created_at timestamptz not null default now(),
  read_by uuid[] not null default '{}',
  constraint messages_have_content check (char_length(body) > 0 or image_url is not null)
);
create index if not exists room_members_user_id_idx on public.room_members(user_id);
create index if not exists messages_room_created_idx on public.messages(room_id,created_at);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.messages enable row level security;

-- SECURITY DEFINER avoids recursive RLS evaluation when membership policies
-- need to check the same room_members table.
create or replace function public.is_room_member(target_room uuid, target_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members rm
    where rm.room_id = target_room and rm.user_id = target_user
  );
$$;
revoke all on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;

drop policy if exists "profiles readable by signed in users" on public.profiles;
create policy "profiles readable by signed in users" on public.profiles for select to authenticated using (true);
drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "members can read rooms" on public.rooms;
create policy "members can read rooms" on public.rooms for select to authenticated using (public.is_room_member(id));
drop policy if exists "authenticated users create groups" on public.rooms;
create policy "authenticated users create groups" on public.rooms for insert to authenticated with check (created_by=(select auth.uid()) and is_group=true);
drop policy if exists "group creator can update room" on public.rooms;
create policy "group creator can update room" on public.rooms for update to authenticated using (created_by=(select auth.uid())) with check (created_by=(select auth.uid()));

drop policy if exists "members can read membership" on public.room_members;
create policy "members can read membership" on public.room_members for select to authenticated using (public.is_room_member(room_members.room_id));
drop policy if exists "users can add themselves to a room" on public.room_members;
create policy "users can add themselves to a room" on public.room_members for insert to authenticated with check (user_id=(select auth.uid()) or exists(select 1 from public.rooms r where r.id=room_id and r.created_by=(select auth.uid()) and r.is_group=true));

drop policy if exists "room members read messages" on public.messages;
create policy "room members read messages" on public.messages for select to authenticated using (public.is_room_member(messages.room_id));
drop policy if exists "room members send messages as themselves" on public.messages;
create policy "room members send messages as themselves" on public.messages for insert to authenticated with check (sender_id=(select auth.uid()) and public.is_room_member(messages.room_id));
drop policy if exists "room members update read receipts" on public.messages;
create policy "room members update read receipts" on public.messages for update to authenticated using (public.is_room_member(messages.room_id)) with check (public.is_room_member(messages.room_id));

-- Safely find or create a private room between the signed-in user and another user.
create or replace function public.get_or_create_direct_room(other_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid := auth.uid(); existing_room uuid; new_room uuid;
begin
  if current_user_id is null then raise exception 'You must be signed in'; end if;
  if other_user is null or other_user = current_user_id then raise exception 'Choose another user'; end if;
  if not exists(select 1 from public.profiles p where p.id=other_user) then raise exception 'User not found'; end if;
  select r.id into existing_room from public.rooms r
  where r.is_group=false
    and exists(select 1 from public.room_members a where a.room_id=r.id and a.user_id=current_user_id)
    and exists(select 1 from public.room_members b where b.room_id=r.id and b.user_id=other_user)
    and (select count(*) from public.room_members c where c.room_id=r.id)=2
  limit 1;
  if existing_room is not null then return existing_room; end if;
  insert into public.rooms(name,is_group,created_by) values('Direct chat',false,current_user_id) returning id into new_room;
  insert into public.room_members(room_id,user_id) values(new_room,current_user_id),(new_room,other_user);
  return new_room;
end; $$;
revoke all on function public.get_or_create_direct_room(uuid) from public;
grant execute on function public.get_or_create_direct_room(uuid) to authenticated;

-- Storage bucket is public so shared image URLs render in this simple starter.
-- Do not use public buckets for confidential images. Tighten this for a production app.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-images','chat-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "signed-in users upload their own images" on storage.objects;
create policy "signed-in users upload their own images" on storage.objects for insert to authenticated with check (bucket_id='chat-images' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "signed-in users can read chat images" on storage.objects;
create policy "signed-in users can read chat images" on storage.objects for select to authenticated using (bucket_id='chat-images');

-- Enable realtime change events for the message table.
alter table public.messages replica identity full;
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when undefined_object then null; end $$;

-- Private WebRTC signaling channel: only members of the room can broadcast/read signals.
drop policy if exists "room members can receive call signals" on realtime.messages;
create policy "room members can receive call signals" on realtime.messages for select to authenticated
using (left(realtime.topic(),10)='call-room-' and public.is_room_member(substring(realtime.topic() from 11)::uuid));
drop policy if exists "room members can send call signals" on realtime.messages;
create policy "room members can send call signals" on realtime.messages for insert to authenticated
with check (left(realtime.topic(),10)='call-room-' and public.is_room_member(substring(realtime.topic() from 11)::uuid));

-- UChat feature migration: run this after the original schema has been created.
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_unique_idx on public.profiles(lower(username)) where username is not null;
create table if not exists public.statuses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 280),
 created_at timestamptz not null default now()
);
alter table public.statuses enable row level security;
drop policy if exists "signed-in users can read statuses" on public.statuses;
create policy "signed-in users can read statuses" on public.statuses for select to authenticated using (true);
drop policy if exists "users can post own statuses" on public.statuses;
create policy "users can post own statuses" on public.statuses for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "users can delete own statuses" on public.statuses;
create policy "users can delete own statuses" on public.statuses for delete to authenticated using (user_id=(select auth.uid()));
