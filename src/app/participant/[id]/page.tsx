'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, type Match, type Prediction, type Participant } from '@/lib/supabase'
import { isLocked, getTimeUntilLock, formatKuwaitTime } from '@/lib/utils'
import Link from 'next/link'
import { useParams } from 'next/navigation'

type GroupedMatches = Record<string, Match[]>
type TournamentPred = {
  id: number
  pred_champion: string
  pred_runner_up: string
  pred_top_scorer: string
  pred_best_player: string
}

export default function ParticipantPage() {
  const params = useParams()
  const participantId = Number(params.id)

  const [participant, setParticipant] = useState<Participant | null>(null)
  const [matches, setMatches]         = useState<Match[]>([])
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({})
  const [drafts, setDrafts]           = useState<Record<number, { s1: string; s2: string; scorer: string; qualifier: string }>>({})
  const [saving, setSaving]           = useState<Record<number, boolean>>({})
  const [saved, setSaved]             = useState<Record<number, boolean>>({})
  const [activeGroup, setActiveGroup] = useState<string>('open')
  const [tournamentPred, setTournamentPred] = useState<TournamentPred | null>(null)

  useEffect(() => {
    const t = setInterval(() => {}, 30000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(async () => {
    const [{ data: p }, { data: m }, { data: pr }, { data: tp }] = await Promise.all([
      supabase.from('participants').select('*').eq('id', participantId).single(),
      supabase.from('matches').select('*').order('match_num'),
      supabase.from('predictions').select('*').eq('participant_id', participantId),
      supabase.from('tournament_predictions').select('*').eq('participant_id', participantId).single(),
    ])
    if (p) setParticipant(p)
    if (m) setMatches(m)
    if (pr) {
      const map: Record<number, Prediction> = {}
      pr.forEach(x => { map[x.match_id] = x })
      setPredictions(map)
    }
    if (tp) setTournamentPred(tp)
  }, [participantId])

  useEffect(() => { load() }, [load])

  const groups: GroupedMatches = {}
  const openMatches: Match[] = []
  matches.forEach(m => {
    const g = m.group_name || m.stage
    if (!groups[g]) groups[g] = []
    groups[g].push(m)
    if (!isLocked(m.kickoff_utc) && m.score1 === null) openMatches.push(m)
  })

  async function savePrediction(match: Match) {
    const draft = drafts[match.id]
    if (!draft) return
    const s1 = parseInt(draft.s1)
    const s2 = parseInt(draft.s2)
    if (isNaN(s1) || isNaN(s2)) return

    setSaving(prev => ({ ...prev, [match.id]: true }))

    const existing = predictions[match.id]
    const isKnockout = match.stage !== 'group'
    const payload = {
      participant_id: participantId,
      match_id: match.id,
      pred_score1: s1,
      pred_score2: s2,
      pred_scorer: !isKnockout ? (draft.scorer || null) : null,
      pred_qualifier: isKnockout ? (draft.qualifier || null) : null,
    }

    if (existing) {
      await supabase.from('predictions').update({
        ...payload,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id)
    } else {
      await supabase.from('predictions').insert(payload)
    }

    await load()
    setSaving(prev => ({ ...prev, [match.id]: false }))
    setSaved(prev => ({ ...prev, [match.id]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [match.id]: false })), 2000)
  }

  function updateDraft(matchId: number, field: 'score1' | 'score2' | 'scorer' | 'qualifier', val: string) {
    setDrafts(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        ...(field === 'score1' ? { s1: val } : field === 'score2' ? { s2: val } : field === 'scorer' ? { scorer: val } : { qualifier: val }),
      }
    }))
  }

  function getDraft(match: Match) {
    const d = drafts[match.id]
    const p = predictions[match.id]
    return {
      s1: drafts[match.id] !== undefined ? (d?.s1 ?? '') : (p ? String(p.pred_score1) : ''),
      s2: drafts[match.id] !== undefined ? (d?.s2 ?? '') : (p ? String(p.pred_score2) : ''),
      scorer: drafts[match.id] !== undefined ? (d?.scorer ?? '') : (p?.pred_scorer || ''),
      qualifier: drafts[match.id] !== undefined ? (d?.qualifier ?? '') : (p?.pred_qualifier || ''),
    }
  }

  const stageLabel = (stage: string) => {
    if (stage === 'r32') return 'دور الـ32'
    if (stage === 'r16') return 'دور الـ16'
    if (stage === 'qf') return 'ربع النهائي'
    if (stage === 'sf') return 'نصف النهائي'
    if (stage === 'final') return 'النهائي'
    return stage
  }

  const totalSitePts = Object.values(predictions).reduce((s, p) => s + p.total_pts, 0)
  const groups_list = Object.keys(groups).filter(g => g.length === 1).sort()
  const knockout_stages = ['r32', 'r16', 'qf', 'sf', 'final'].filter(s => groups[s])

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-pitch">
      <header className="bg-navy border-b border-gold/30 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/60 hover:text-white text-xl">←</Link>
          <div className="flex-1">
            <div className="font-black text-gold">{participant?.name}</div>
            <div className="text-xs text-white/40">
              نقاط سابقة: {participant?.prev_pts} | الموقع: {totalSitePts}
              <span className="text-gold font-bold"> | المجموع: {(participant?.prev_pts || 0) + totalSitePts}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">

        {tournamentPred && (
          <div className="card space-y-3 mb-4 border-gold/30">
            <h2 className="text-gold font-bold text-sm">🏆 توقعات البطولة</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-white/40 mb-1">🥇 البطل</div>
                <div className="font-bold text-white">{tournamentPred.pred_champion}</div>
                <div className="text-gold text-xs mt-1">20 نقطة</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-white/40 mb-1">🥈 الوصيف</div>
                <div className="font-bold text-white">{tournamentPred.pred_runner_up}</div>
                <div className="text-gold text-xs mt-1">10 نقاط</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-white/40 mb-1">⚽ الهداف</div>
                <div className="font-bold text-white">{tournamentPred.pred_top_scorer}</div>
                <div className="text-gold text-xs mt-1">15 نقطة</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-white/40 mb-1">⭐ أفضل لاعب</div>
                <div className="font-bold text-white">{tournamentPred.pred_best_player}</div>
                <div className="text-gold text-xs mt-1">10 نقاط</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setActiveGroup('open')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors
              ${activeGroup==='open' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}
          >
            مفتوحة {openMatches.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 ml-1">{openMatches.length}</span>}
          </button>
          {groups_list.map(g => (
            <button key={g}
              onClick={() => setActiveGroup(g)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold transition-colors
                ${activeGroup===g ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}
            >
              مجموعة {g}
            </button>
          ))}
          {knockout_stages.map(stage => (
            <button key={stage}
              onClick={() => setActiveGroup(stage)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-bold transition-colors
                ${activeGroup===stage ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}
            >
              {stageLabel(stage)}
            </button>
          ))}
        </div>

        {(() => {
          const toShow = activeGroup === 'open'
            ? openMatches
            : (groups[activeGroup] || [])

          if (toShow.length === 0)
            return <div className="text-center py-12 text-white/30">لا توجد مباريات</div>

          return (
            <div className="space-y-3">
              {toShow.map(match => {
                const locked = isLocked(match.kickoff_utc)
                const played = match.score1 !== null
                const pred   = predictions[match.id]
                const draft  = getDraft(match)
                const timeLeft = getTimeUntilLock(match.kickoff_utc)
                const isKnockout = match.stage !== 'group'

                return (
                  <div key={match.id}
                    className={`card space-y-3 ${played ? 'border-white/10' : locked ? 'border-red-500/30' : 'border-gold/30'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="badge-group">م{match.match_num} · {match.group_name || stageLabel(match.stage)}</span>
                      {!locked && !played && (
                        <span className="text-xs text-emerald-400">⏰ يُغلق بعد {timeLeft}</span>
                      )}
                      {locked && !played && (
                        <span className="text-xs text-red-400">🔒 مغلق</span>
                      )}
                      {played && (
                        <span className="text-xs text-white/40">{formatKuwaitTime(match.kickoff_utc)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-right font-bold text-sm">{match.team1}</span>
                      {played ? (
                        <div className="flex items-center gap-1 px-3 py-1 bg-pitch rounded-lg font-black text-lg text-gold">
                          <span>{match.score1}</span><span className="text-white/40">-</span><span>{match.score2}</span>
                        </div>
                      ) : (
                        <div className="text-white/30 font-bold text-lg px-2">🆚</div>
                      )}
                      <span className="flex-1 font-bold text-sm">{match.team2}</span>
                    </div>

                    {played && match.qualifier && (
                      <div className="text-xs text-white/40 text-center">🏆 المتأهل: {match.qualifier}</div>
                    )}
                    {played && match.scorer && !isKnockout && (
                      <div className="text-xs text-white/40 text-center">⚽ {match.scorer}</div>
                    )}

                    {played ? (
                      pred ? (
                        <div className={`rounded-xl p-2.5 text-sm text-center
                          ${pred.total_pts > 0 ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-white/5'}`}
                        >
                          <span className="text-white/60">توقعك: {pred.pred_score1}-{pred.pred_score2}</span>
                          {pred.pred_qualifier && <span className="text-white/40 mr-2">· 🏆 {pred.pred_qualifier}</span>}
                          {pred.pred_scorer && !isKnockout && <span className="text-white/40 mr-2">· ⚽ {pred.pred_scorer}</span>}
                          <span className={`font-black mr-3 ${pred.total_pts > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
                            +{pred.total_pts} نقطة
                          </span>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-white/20 py-1">لم تتوقع هذه المباراة</div>
                      )
                    ) : locked ? (
                      pred ? (
                        <div className="bg-white/5 rounded-xl p-2.5 text-sm text-center text-white/50">
                          توقعك المسجل: <strong>{pred.pred_score1}-{pred.pred_score2}</strong>
                          {pred.pred_qualifier && <span className="text-white/40 mr-1">· 🏆 {pred.pred_qualifier}</span>}
                          {pred.pred_scorer && !isKnockout && <span className="text-white/40 mr-1">· ⚽ {pred.pred_scorer}</span>}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-red-400/60 py-1">🔒 لم تسجل توقعاً قبل الإغلاق</div>
                      )
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number" min="0" max="20"
                            value={draft.s1}
                            onChange={e => updateDraft(match.id, 'score1', e.target.value)}
                            placeholder="0"
                            className="score-input"
                          />
                          <span className="text-white/30 font-bold">-</span>
                          <input
                            type="number" min="0" max="20"
                            value={draft.s2}
                            onChange={e => updateDraft(match.id, 'score2', e.target.value)}
                            placeholder="0"
                            className="score-input"
                          />
                          {!isKnockout && (
                            <input
                              type="text"
                              value={draft.scorer}
                              onChange={e => updateDraft(match.id, 'scorer', e.target.value)}
                              placeholder="مسجل الهدف (اختياري)"
                              className="flex-1 bg-navy border-2 border-white/20 focus:border-gold
                                         rounded-xl py-2 px-3 text-sm outline-none transition-colors"
                            />
                          )}
                        </div>
                        {isKnockout && draft.s1 !== '' && draft.s1 === draft.s2 && (
  <div className="flex gap-2 items-center">

                            <span className="text-xs text-white/50 flex-shrink-0">🏆 المتأهل:</span>
                            <select
                              value={draft.qualifier}
                              onChange={e => updateDraft(match.id, 'qualifier', e.target.value)}
                              className="flex-1 bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-sm text-white outline-none appearance-none"
                            >
                              <option value="">— اختر الفريق المتأهل —</option>
                              <option value={match.team1}>{match.team1}</option>
                              <option value={match.team2}>{match.team2}</option>
                            </select>
                          </div>
                        )}
                        <button
                          onClick={() => savePrediction(match)}
                          disabled={saving[match.id] || draft.s1==='' || draft.s2==='' || (isKnockout && draft.s1 === draft.s2 && draft.s1 !== '' && !draft.qualifier)}

                          className="btn-primary w-full text-sm"
                        >
                          {saving[match.id] ? '⏳ جاري الحفظ...' : saved[match.id] ? '✅ تم الحفظ!' : pred ? 'تحديث التوقع' : 'حفظ التوقع'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
