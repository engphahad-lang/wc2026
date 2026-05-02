'use client'
import { useState, useEffect } from 'react'
import { supabase, type Match, type Prediction } from '@/lib/supabase'
import { formatKuwaitTime, calcPoints } from '@/lib/utils'

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234'

export default function AdminPage() {
  const [pin, setPin]         = useState('')
  const [authed, setAuthed]   = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [results, setResults] = useState<Record<number, { s1: string; s2: string; scorer: string }>>({})
  const [saving, setSaving]   = useState<Record<number, boolean>>({})
  const [msg, setMsg]         = useState('')

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_num')
    setMatches(data || [])
  }

  useEffect(() => { if (authed) loadMatches() }, [authed])

  async function saveResult(match: Match) {
    const r = results[match.id]
    if (!r) return
    const s1 = parseInt(r.s1), s2 = parseInt(r.s2)
    if (isNaN(s1) || isNaN(s2)) return

    setSaving(prev => ({ ...prev, [match.id]: true }))

    // 1. Update match result
    await supabase.from('matches')
      .update({ score1: s1, score2: s2, scorer: r.scorer || null })
      .eq('id', match.id)

    // 2. Recalculate all predictions for this match
    const { data: preds } = await supabase
      .from('predictions').select('*').eq('match_id', match.id)

    if (preds && preds.length > 0) {
      const updates = preds.map((p: Prediction) => {
        const pts = calcPoints(p.pred_score1, p.pred_score2, s1, s2,
                               p.pred_scorer || '', r.scorer || '', match.stage)
        return { id: p.id, ...pts }
      })
      for (const u of updates) {
        await supabase.from('predictions').update({
          pts_result: u.pts_result, pts_scorer: u.pts_scorer, total_pts: u.total_pts
        }).eq('id', u.id)
      }
    }

    setMsg(`✅ تم حفظ نتيجة مباراة ${match.match_num} وتحديث النقاط`)
    await loadMatches()
    setSaving(prev => ({ ...prev, [match.id]: false }))
    setTimeout(() => setMsg(''), 3000)
  }

  async function toggleLock(match: Match) {
    await supabase.from('matches').update({ is_locked: !match.is_locked }).eq('id', match.id)
    await loadMatches()
  }

  function getResult(match: Match) {
    return results[match.id] || {
      s1: match.score1 !== null ? String(match.score1) : '',
      s2: match.score2 !== null ? String(match.score2) : '',
      scorer: match.scorer || '',
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-4">
        <div className="card w-full max-w-xs space-y-4 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="text-xl font-bold text-gold">لوحة الإدارة</h1>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pin === ADMIN_PIN && setAuthed(true)}
            placeholder="رمز الدخول"
            className="w-full bg-navy-light border-2 border-white/20 rounded-xl py-3 px-4 text-center text-white outline-none"
          />
          <button
            onClick={() => pin === ADMIN_PIN ? setAuthed(true) : setMsg('رمز خاطئ')}
            className="btn-primary w-full"
          >دخول</button>
          {msg && <p className="text-red-400 text-sm">{msg}</p>}
        </div>
      </div>
    )
  }

  const unplayed = matches.filter(m => m.score1 === null)
  const played   = matches.filter(m => m.score1 !== null)

  return (
    <div className="min-h-screen bg-navy">
      <header className="bg-navy border-b border-gold/30 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-black text-gold">⚙️ لوحة الإدارة</h1>
          <span className="text-xs text-white/40">{matches.length} مباراة · {played.length} مُلعبة</span>
        </div>
      </header>

      {msg && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-3 text-sm text-emerald-400">{msg}</div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-6">

        {/* Unplayed - enter results */}
        <section>
          <h2 className="text-gold font-bold mb-3">⏳ مباريات تحتاج نتيجة ({unplayed.length})</h2>
          <div className="space-y-3">
            {unplayed.slice(0, 20).map(match => {
              const r = getResult(match)
              return (
                <div key={match.id} className="card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="badge-group">م{match.match_num} · مجموعة {match.group_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{formatKuwaitTime(match.kickoff_utc)}</span>
                      <button
                        onClick={() => toggleLock(match)}
                        className={`text-xs px-2 py-1 rounded-lg ${match.is_locked ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                      >
                        {match.is_locked ? '🔒 مغلق' : '🔓 مفتوح'}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-sm">
                    <span className="flex-1 text-right">{match.team1}</span>
                    <input type="number" min="0" max="20" value={r.s1}
                      onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:''}), s1: e.target.value}}))}
                      className="score-input" placeholder="0" />
                    <span className="text-white/30">-</span>
                    <input type="number" min="0" max="20" value={r.s2}
                      onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:''}), s2: e.target.value}}))}
                      className="score-input" placeholder="0" />
                    <span className="flex-1">{match.team2}</span>
                  </div>
                  <input type="text" value={r.scorer}
                    onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:''}), scorer: e.target.value}}))}
                    placeholder="مسجلو الأهداف (مثال: مبابي هالاند)"
                    className="w-full bg-navy border border-white/20 rounded-xl py-2 px-3 text-sm outline-none focus:border-gold"
                  />
                  <button
                    onClick={() => saveResult(match)}
                    disabled={saving[match.id] || r.s1==='' || r.s2===''}
                    className="btn-primary w-full text-sm"
                  >
                    {saving[match.id] ? '⏳ جاري الحفظ...' : '💾 حفظ النتيجة وتحديث النقاط'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* Played - show + allow edit */}
        <section>
          <h2 className="text-gold font-bold mb-3">✅ نتائج مُدخلة ({played.length})</h2>
          <div className="space-y-2">
            {played.map(match => {
              const r = getResult(match)
              return (
                <div key={match.id} className="card py-2 px-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-white/40 text-xs w-8">م{match.match_num}</span>
                    <span className="flex-1 text-right font-bold text-xs">{match.team1}</span>
                    <span className="bg-pitch px-3 py-1 rounded-lg font-black text-gold text-sm">
                      {match.score1}-{match.score2}
                    </span>
                    <span className="flex-1 text-xs font-bold">{match.team2}</span>
                  </div>
                  {match.scorer && <div className="text-xs text-white/30 text-center">⚽ {match.scorer}</div>}

                  {/* Inline edit */}
                  <details className="group">
                    <summary className="text-xs text-white/30 cursor-pointer hover:text-white/60">تعديل النتيجة</summary>
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1">
                        <input type="number" min="0" max="20" value={r.s1}
                          onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:match.scorer||''}), s1: e.target.value}}))}
                          className="score-input" />
                        <span className="text-white/30">-</span>
                        <input type="number" min="0" max="20" value={r.s2}
                          onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:match.scorer||''}), s2: e.target.value}}))}
                          className="score-input" />
                        <input type="text" value={r.scorer}
                          onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:match.scorer||''}), scorer: e.target.value}}))}
                          className="flex-1 bg-navy border border-white/20 rounded-xl py-1.5 px-2 text-xs outline-none" />
                      </div>
                      <button onClick={() => saveResult(match)} disabled={saving[match.id]}
                        className="btn-primary w-full text-xs">
                        {saving[match.id] ? '⏳...' : '💾 حفظ التعديل'}
                      </button>
                    </div>
                  </details>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
