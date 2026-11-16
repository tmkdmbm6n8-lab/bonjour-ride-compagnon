CREATE TABLE public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'android' CHECK (platform IN ('android','ios','web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON public.push_tokens (user_id);
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads and writes device tokens.