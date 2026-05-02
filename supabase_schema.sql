-- ============================================================
-- مسابقة الخبير - كأس العالم 2026
-- Run this in Supabase SQL Editor
-- ============================================================

-- Participants
create table if not exists participants (
  id          serial primary key,
  name        text unique not null,
  prev_pts    int not null default 0,
  created_at  timestamptz default now()
);

-- Matches (group stage + knockout)
create table if not exists matches (
  id          serial primary key,
  match_num   int unique not null,
  stage       text not null,  -- 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  group_name  text,           -- A..L for group stage
  team1       text not null,
  team2       text not null,
  kickoff_utc timestamptz not null,  -- stored as UTC, shown as Kuwait time (+3)
  score1      int,            -- null until played
  score2      int,            -- null until played
  scorer      text,           -- actual scorers
  is_locked   boolean default false
);

-- Predictions
create table if not exists predictions (
  id            serial primary key,
  participant_id int references participants(id) on delete cascade,
  match_id       int references matches(id) on delete cascade,
  pred_score1    int not null,
  pred_score2    int not null,
  pred_scorer    text,
  pts_result     int default 0,
  pts_scorer     int default 0,
  total_pts      int default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(participant_id, match_id)
);

-- Leaderboard view
create or replace view leaderboard as
select
  p.id,
  p.name,
  p.prev_pts,
  coalesce(sum(pr.total_pts), 0)                    as site_pts,
  p.prev_pts + coalesce(sum(pr.total_pts), 0)        as total_pts,
  rank() over (order by (p.prev_pts + coalesce(sum(pr.total_pts),0)) desc) as rank
from participants p
left join predictions pr on pr.participant_id = p.id
group by p.id, p.name, p.prev_pts
order by total_pts desc;

-- Enable RLS
alter table participants  enable row level security;
alter table matches       enable row level security;
alter table predictions   enable row level security;

-- Public read for participants and matches
create policy "public read participants" on participants for select using (true);
create policy "public read matches"      on matches      for select using (true);
create policy "public read predictions"  on predictions  for select using (true);

-- Insert own prediction (anyone can insert for any participant — name-based auth)
create policy "insert prediction" on predictions for insert with check (true);
create policy "update prediction" on predictions for update using (true);

-- Indexes
create index if not exists idx_predictions_match       on predictions(match_id);
create index if not exists idx_predictions_participant on predictions(participant_id);
create index if not exists idx_matches_kickoff         on matches(kickoff_utc);
