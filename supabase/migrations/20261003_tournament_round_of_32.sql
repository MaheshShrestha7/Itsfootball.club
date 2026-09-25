-- Knockout brackets with 17-32 entrants open with a Round of 32
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_tournament_stage_check;
ALTER TABLE matches ADD CONSTRAINT matches_tournament_stage_check
    CHECK (tournament_stage IN ('group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final', 'third_place'));
