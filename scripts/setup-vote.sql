ALTER TABLE staff_opinions ADD COLUMN IF NOT EXISTS type text DEFAULT 'general';
ALTER TABLE staff_opinions ADD COLUMN IF NOT EXISTS vote_options jsonb DEFAULT '[]';
ALTER TABLE staff_opinions ADD COLUMN IF NOT EXISTS vote_deadline date;

CREATE TABLE IF NOT EXISTS staff_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opinion_id bigint NOT NULL,
  voter_id text NOT NULL,
  option_idx integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(opinion_id, voter_id)
);
ALTER TABLE staff_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON staff_votes FOR ALL USING (true) WITH CHECK (true);
