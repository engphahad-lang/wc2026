'use client'
import { useState, useEffect } from 'react'
import { supabase, type Match, type Participant, type Prediction } from '@/lib/supabase'
import { formatKuwaitTime, isLocked } from '@/lib/utils'
import Link from 'next/link'

export default function TodayPage() {
  const [matches, setMatches]           = useState<Match[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [predictions, setPredictions]   = useState<Record<string, Prediction>>({})
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    async function load() {
      // Get today's matches (Kuwait time = UTC+3)
      const now = new Date()
      const kuwaitOffset = 3 * 60 * 60 * 1000
      const kuwaitNow = new Date(now.getTime() + kuwaitOffset)
      const todayStart = new Date(Date.UTC(kuwaitNow.getUTCFullYear(), kuwaitNow.getUTCMonth(), kuwaitNow.getUTCDate()) - kuwaitOffset - 24 * 60 * 60 * 1000)

      const todayEnd   = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

      const [{ data: m }, { data: p }, { data: pr }] = await Promise.all([
        supabase.from('matches').select('*')
          .gte('kickoff_utc', todayStart.toISOString())
          .lt('kickoff_utc', todayEnd.toISOString())
          .order('kickoff_utc'),
        supabase.from('participants').select('*').order('name'),
        supabase.from('predictions').select('*'),
      ])

      setMatches(m || [])
      setParticipants(p || [])

      // Map predictions by participant_id + match_id
      const map: Record<string, Prediction> = {}
      ;(pr || []).forEach(pred => {
        map[`${pred.participant_id}_${pred.match_id}`] = pred
      })
      setPredictions(map)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-navy flex items-center justify-center text-white/40">
      جاري التحميل...
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-pitch">
      <header className="bg-navy border-b border-gold/30 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/60 hover:text-white text-xl">←</Link>
          <h1 className="text-lg font-black text-gold">📅 توقعات اليوم</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {matches.length === 0 ? (
          <div className="text-center py-16 text-white/30">
            <div className="text-4xl mb-3">😴</div>
            <div>لا توجد مباريات اليوم</div>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map(match => {
              const locked = isLocked(match.kickoff_utc)
              return (
                <div key={match.id} className="card space-y-4">
                  {/* Match header */}
                  <div className="flex items-center justify-between">
                    <span className="badge-group">م{match.match_num} · مجموعة {match.group_name}</span>
                    <span className="text-xs text-white/40">{formatKuwaitTime(match.kickoff_utc)}</span>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center gap-2 text-sm font-bold text-center">
                    <span className="flex-1 text-right">{match.team1}</span>
                    {match.score1 !== null ? (
                      <span className="bg-pitch px-4 py-1.5 rounded-lg font-black text-gold text-lg">
                        {match.score1} - {match.score2}
                      </span>
                    ) : (
                      <span className="text-white/30 px-3 text-lg">🆚</span>
                    )}
                    <span className="flex-1">{match.team2}</span>
                  </div>

                  {match.scorer && (
                    <div className="text-xs text-white/40 text-center">⚽ {match.scorer}</div>
                  )}

                  {/* Predictions table */}
                  {!locked ? (
                    <div className="text-center text-xs text-emerald-400 py-2">
                      🔓 التوقعات مخفية حتى إغلاق الباب
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-right py-2 px-2 text-white/50 font-normal text-xs">المشارك</th>
                            <th className="text-center py-2 px-2 text-white/50 font-normal text-xs">التوقع</th>
                            <th className="text-center py-2 px-2 text-white/50 font-normal text-xs">الكابتن</th>
                            <th className="text-center py-2 px-2 text-white/50 font-normal text-xs">النقاط</th>
                          </tr>
                        </thead>
                        <tbody>
                          {participants.map(p => {
                            const pred = predictions[`${p.id}_${match.id}`]
                            return (
                              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                                <td className="py-2 px-2 font-bold text-xs">{p.name}</td>
                                <td className="py-2 px-2 text-center">
                                  {pred ? (
                                    <span className="bg-navy px-2 py-0.5 rounded-lg font-black text-gold text-sm">
                                      {pred.pred_score2}-{pred.pred_score1}
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-xs">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center text-xs text-white/60">
                                  {pred?.pred_scorer || <span className="text-white/20">—</span>}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  {pred && match.score1 !== null ? (
                                    <span className={`font-black text-sm ${pred.total_pts > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
                                      +{pred.total_pts}
                                    </span>
                                  ) : (
                                    <span className="text-white/20 text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
