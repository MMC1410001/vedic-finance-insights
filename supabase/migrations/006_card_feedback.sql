-- Card feedback table for thumbs up/down on financial kundali insight cards
CREATE TABLE IF NOT EXISTS public.card_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, card_id)
);

-- Enable RLS
ALTER TABLE public.card_feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.card_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback"
  ON public.card_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete own feedback"
  ON public.card_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON public.card_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_card_feedback_user_id ON public.card_feedback(user_id);
