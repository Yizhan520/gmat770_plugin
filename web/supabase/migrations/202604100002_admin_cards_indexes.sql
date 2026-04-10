create index if not exists idx_mistake_cards_updated_at_desc
on public.mistake_cards(updated_at desc);

create index if not exists idx_mistake_cards_source_kind
on public.mistake_cards(source_kind);
