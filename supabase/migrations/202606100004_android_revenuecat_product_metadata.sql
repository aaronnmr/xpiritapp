update public.subscription_products
set metadata = metadata || '{"platforms": ["ios", "android"], "android_ready": true, "google_play_product_id": "xpirit_premium_monthly_299"}'::jsonb
where id = 'xpirit_premium_monthly_299';

update public.subscription_products
set metadata = metadata || '{"platforms": ["ios", "android"], "android_ready": true, "google_play_product_id": "xpirit_elite_monthly_799"}'::jsonb
where id = 'xpirit_elite_monthly_799';
