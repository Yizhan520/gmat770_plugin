alter table if exists public.mistake_cards
  add column if not exists review_count integer not null default 0;

update public.mistake_cards
set review_count = 1
where review_count = 0
  and status in ('learning', 'mastered');

create index if not exists idx_mistake_cards_review_count on public.mistake_cards(review_count);

create or replace function public.increment_card_review_count(target_card_id uuid)
returns table (review_count integer, updated_at timestamptz)
language sql
as $$
  update public.mistake_cards
  set review_count = coalesce(review_count, case when status = 'needs_review' then 0 else 1 end) + 1,
      updated_at = timezone('utc', now())
  where id = target_card_id
  returning mistake_cards.review_count, mistake_cards.updated_at;
$$;
