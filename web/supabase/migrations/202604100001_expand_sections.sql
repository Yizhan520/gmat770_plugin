alter table public.mistake_cards
drop constraint if exists mistake_cards_section_check;

alter table public.mistake_cards
add constraint mistake_cards_section_check
check (
  section in (
    'logic',
    'reading',
    'sentence_correction',
    'quant',
    'data_insights',
    'other'
  )
);
