-- Pinezki uwag na podglądzie strony: podstrona, element, położenie w elemencie i na stronie, rozmiar ekranu.
alter table public.review_comments add column if not exists path text;
alter table public.review_comments add column if not exists selector text;
alter table public.review_comments add column if not exists x_pct real;
alter table public.review_comments add column if not exists y_pct real;
alter table public.review_comments add column if not exists page_x real;
alter table public.review_comments add column if not exists page_y real;
alter table public.review_comments add column if not exists viewport text;
alter table public.review_comments add column if not exists pin int;
