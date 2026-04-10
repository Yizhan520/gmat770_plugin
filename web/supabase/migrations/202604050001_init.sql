create extension if not exists pgcrypto;

create table if not exists public.mistake_cards (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('logic', 'reading', 'sentence_correction', 'quant', 'data_insights', 'other')),
  reasoning_type text not null default '',
  title text not null default '',
  prompt_text text not null default '',
  options_text text not null default '',
  my_answer text not null default '',
  correct_answer text not null default '',
  time_spent text not null default '',
  analysis_text text not null default '',
  logic_chain_text text not null default '',
  personal_summary_text text not null default '',
  extra_notes_text text not null default '',
  source_kind text not null,
  source_row_key text not null,
  source_payload jsonb,
  status text not null default 'needs_review' check (status in ('needs_review', 'learning', 'mastered')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_kind, source_row_key)
);

create table if not exists public.mistake_assets (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.mistake_cards(id) on delete cascade,
  asset_kind text not null default 'attachment' check (asset_kind in ('attachment', 'question_screenshot', 'analysis_screenshot')),
  anchor_column integer,
  sort_order integer not null default 0,
  storage_path text not null,
  width integer,
  height integer,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null,
  original_name text not null,
  file_sha256 text not null,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (source_kind, file_sha256)
);

create index if not exists idx_mistake_cards_section on public.mistake_cards(section);
create index if not exists idx_mistake_cards_status on public.mistake_cards(status);
create index if not exists idx_mistake_assets_card on public.mistake_assets(card_id);
create index if not exists idx_import_jobs_created_at on public.import_jobs(created_at desc);

insert into storage.buckets (id, name, public)
values ('mistake-assets', 'mistake-assets', true)
on conflict (id) do update set public = excluded.public;
