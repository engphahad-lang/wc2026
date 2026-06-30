import { createClient } from '@supabase/supabase-js'
 
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
 
export function createAdminClient() {
 return createClient(
   process.env.NEXT_PUBLIC_SUPABASE_URL!,
   process.env.SUPABASE_SERVICE_ROLE_KEY!
 )
}
 
export type Participant = { id: number; name: string; prev_pts: number }
export type Match = {
 id: number; match_num: number; stage: string; group_name: string | null
 team1: string; team2: string; kickoff_utc: string
 score1: number | null; score2: number | null; scorer: string | null
 qualifier: string | null
 assist: string | null
 card: string | null
 is_locked: boolean
}
export type Prediction = {
 id: number; participant_id: number; match_id: number
 pred_score1: number; pred_score2: number; pred_scorer: string | null
 pred_qualifier: string | null
 pred_assist: string | null
 pred_card: string | null
 pts_result: number; pts_scorer: number; pts_qualifier: number
 pts_assist: number; pts_card: number; pts_bonus: number
 total_pts: number
}
export type LeaderboardRow = {
 id: number; name: string; prev_pts: number
 site_pts: number; total_pts: number; rank: number
}
 
