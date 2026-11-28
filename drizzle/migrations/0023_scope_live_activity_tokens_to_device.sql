ALTER TABLE public.live_activity_start_tokens ADD COLUMN device_id TEXT;
ALTER TABLE public.live_activity_update_tokens ADD COLUMN device_id TEXT;
CREATE INDEX live_activity_start_tokens_device_idx ON public.live_activity_start_tokens (user_id, device_id);
CREATE INDEX live_activity_update_tokens_device_idx ON public.live_activity_update_tokens (user_id, device_id);
COMMENT ON COLUMN public.live_activity_start_tokens.device_id IS 'Identifiant local aléatoire de l’appareil iOS; permet de réattribuer le jeton lors d’un changement de compte.';
COMMENT ON COLUMN public.live_activity_update_tokens.device_id IS 'Identifiant local aléatoire de l’appareil iOS; limite la fermeture et la déconnexion aux activités de cet appareil.';