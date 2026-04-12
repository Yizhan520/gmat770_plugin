create index if not exists idx_mistake_cards_section_updated_at_desc
on public.mistake_cards(section, updated_at desc, id desc);

create index if not exists idx_mistake_cards_section_reasoning_updated_at_desc
on public.mistake_cards(section, reasoning_type, updated_at desc, id desc);

create index if not exists idx_mistake_cards_section_review_count_updated_at_desc
on public.mistake_cards(section, review_count, updated_at desc, id desc);

create index if not exists idx_mistake_cards_source_kind_updated_at_desc
on public.mistake_cards(source_kind, updated_at desc, id desc);

create index if not exists idx_mistake_cards_quant_module_updated_at_desc
on public.mistake_cards((source_payload->>'module'), updated_at desc, id desc)
where section = 'quant';

create index if not exists idx_mistake_assets_card_sort_order
on public.mistake_assets(card_id, sort_order, id);
