alter table public.rider_scheduled_requests add column if not exists payment_method text check (payment_method in ('cash','card','wallet'));
notify pgrst, 'reload schema';
