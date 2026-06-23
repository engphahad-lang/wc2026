'use client'
import { useState, useEffect } from 'react'
import { supabase, type Match, type Prediction, type Participant } from '@/lib/supabase'
import { formatKuwaitTime, calcPoints } from '@/lib/utils'

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234'

export default function AdminPage() {
  const [pin, setPin]         = useState('')
  const [authed, setAuthed]   = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [results, setResults] = useState<Record<number, { s1: string; s2: string; scorer: string }>>({})
  const [saving, setSaving]   = useState<Record<number, boolean>>({})
  const [msg, setMsg]         = useState('')
  const [activeTab, setActiveTab] = useState<'results' | 'predictions'>('results')
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null)
  const [participantPredictions, setParticipantPredictions] = useState<Record<number, Prediction>>({})
  const [predDrafts, setPredDrafts] = useState<Record<number, { s1: string; s2: string; scorer: string }>>({})
  const [savingPred, setSavingPred] = useState<Record<number, boolean>>({})

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*').order('match_num')
    setMatches(data || [])
  }

  async function loadParticipants() {
    const { data } = await supabase.from('participants').select('*').order('name')
    setParticipants(data || [])
  }

  useEffect(() => {
    if (authed) {
      loadMatches()
      loadParticipants()
    }
  }, [authed])

  async function loadParticipantPredictions(participantId: number) {
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .eq('participant_id', participantId)
    if (data) {
      const map: Record<number, Prediction> = {}
      data.forEach(p => { map[p.match_id] = p })
      setParticipantPredictions(map)
      setPredDrafts({})
    }
  }

  async function saveResult(match: Match) {
    const r = results[match.id]
    if (!r) return
    const s1 = parseInt(r.s1), s2 = parseInt(r.s2)
    if (isNaN(s1) || isNaN(s2)) return
    setSaving(prev => ({ ...prev, [match.id]: true }))
    await supabase.from('matches')
      .update({ score1: s1, score2: s2, scorer: r.scorer || null })
      .eq('id', match.id)
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
setSaving(prev => ({ ...prev, [match.id]: false }))
setTimeout(() => window.location.reload(), 1500)
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

  async function saveParticipantPrediction(match: Match) {
    if (!selectedParticipant) return
    const draft = predDrafts[match.id]
    if (!draft) return
    const s1 = parseInt(draft.s1)
    const s2 = parseInt(draft.s2)
    if (isNaN(s1) || isNaN(s2)) return
    setSavingPred(prev => ({ ...prev, [match.id]: true }))
    const existing = participantPredictions[match.id]
    const payload = {
      participant_id: selectedParticipant,
      match_id: match.id,
      pred_score1: s1,
      pred_score2: s2,
      pred_scorer: draft.scorer || null,
    }
    if (existing) {
      if (match.score1 !== null && match.score2 !== null) {
        const pts = calcPoints(s1, s2, match.score1, match.score2,
                               draft.scorer || '', match.scorer || '', match.stage)
        await supabase.from('predictions')
          .update({ 
  pred_score1: s1,
  pred_score2: s2,
  pred_scorer: draft.scorer || null,
  pts_result: pts.pts_result,
  pts_scorer: pts.pts_scorer,
  total_pts: pts.total_pts
})

          .eq('id', existing.id)
      } else {
        await supabase.from('predictions').update(payload).eq('id', existing.id)
      }
    } else {
      await supabase.from('predictions').insert(payload)
    }
    await loadParticipantPredictions(selectedParticipant)
    setSavingPred(prev => ({ ...prev, [match.id]: false }))
    setMsg(`✅ تم تعديل توقع المشارك للمباراة ${match.match_num}`)
    setTimeout(() => setMsg(''), 3000)
  }

  function getPredDraft(match: Match) {
    const d = predDrafts[match.id]
    const p = participantPredictions[match.id]
    return {
      s1: d?.s1 ?? (p ? String(p.pred_score1) : ''),
      s2: d?.s2 ?? (p ? String(p.pred_score2) : ''),
      scorer: d?.scorer ?? (p?.pred_scorer || ''),
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
        <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors
              ${activeTab === 'results' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}
          >
            📊 النتائج
          </button>
          <button
            onClick={() => setActiveTab('predictions')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-colors
              ${activeTab === 'predictions' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}
          >
            ✏️ تعديل توقعات المشاركين
          </button>
        </div>
      </header>

      {msg && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="bg-emerald-900/30 border border-emerald-500/30 rounded-xl p-3 text-sm text-emerald-400">{msg}</div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-6">

        {activeTab === 'results' && (
          <>
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
          </>
        )}

        {activeTab === 'predictions' && (
          <section className="space-y-4">
            <h2 className="text-gold font-bold">✏️ تعديل توقعات المشاركين</h2>
            <div className="card space-y-3">
              <label className="text-sm text-white/70">اختر المشارك:</label>
              <select
                value={selectedParticipant || ''}
                onChange={e => {
                  const id = Number(e.target.value)
                  setSelectedParticipant(id)
                  loadParticipantPredictions(id)
                }}
                className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl
                           py-3 px-4 text-white text-base outline-none transition-colors appearance-none"
              >
                <option value="">— اختر مشارك —</option>
                {participants.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {selectedParticipant && (
              <div className="space-y-3">
                {matches.map(match => {
                  const pred = participantPredictions[match.id]
                  const draft = getPredDraft(match)
                  const hasPred = !!pred
                  return (
                    <div key={match.id} className={`card space-y-3 ${hasPred ? 'border-gold/20' : 'border-white/5'}`}>
                      <div className="flex items-center justify-between">
                        <span className="badge-group">م{match.match_num} · مجموعة {match.group_name}</span>
                        <span className="text-xs text-white/40">{formatKuwaitTime(match.kickoff_utc)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <span className="flex-1 text-right">{match.team1}</span>
                        {match.score1 !== null ? (
                          <span className="bg-pitch px-3 py-1 rounded-lg font-black text-gold">
                            {match.score1}-{match.score2}
                          </span>
                        ) : (
                          <span className="text-white/30 px-2">🆚</span>
                        )}
                        <span className="flex-1">{match.team2}</span>
                      </div>
                      {hasPred && (
                        <div className="text-xs text-white/40 text-center">
                          التوقع الحالي: <span className="text-white/70 font-bold">{pred.pred_score1}-{pred.pred_score2}</span>
                          {pred.pred_scorer && <span className="mr-2">· ⚽ {pred.pred_scorer}</span>}
                          {match.score1 !== null && (
                            <span className={`mr-2 font-bold ${pred.total_pts > 0 ? 'text-emerald-400' : 'text-white/30'}`}>
                              ({pred.total_pts} نقطة)
                            </span>
                          )}
                        </div>
                      )}
                      {!hasPred && (
                        <div className="text-xs text-white/30 text-center">لا يوجد توقع مسجل</div>
                      )}
                      <details>
                        <summary className="text-xs text-gold/60 cursor-pointer hover:text-gold">
                          {hasPred ? '✏️ تعديل التوقع' : '➕ إضافة توقع'}
                        </summary>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/50 w-16 text-right">{match.team1}</span>
                            <input
                              type="number" min="0" max="20"
                              value={draft.s1}
                              onChange={e => setPredDrafts(prev => ({
                                ...prev,
                                [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '' }), s1: e.target.value }
                              }))}
                              className="score-input" placeholder="0"
                            />
                            <span className="text-white/30">-</span>
                            <input
                              type="number" min="0" max="20"
                              value={draft.s2}
                              onChange={e => setPredDrafts(prev => ({
                                ...prev,
                                [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '' }), s2: e.target.value }
                              }))}
                              className="score-input" placeholder="0"
                            />
                            <span className="text-xs text-white/50 w-16">{match.team2}</span>
                          </div>
                          <input
                            type="text"
                            value={draft.scorer}
                            onChange={e => setPredDrafts(prev => ({
                              ...prev,
                              [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '' }), scorer: e.target.value }
                            }))}
                            placeholder="مسجل الهدف / الكابتن (اختياري)"
                            className="w-full bg-navy border border-white/20 rounded-xl py-2 px-3 text-sm outline-none focus:border-gold"
                          />
                          <button
                            onClick={() => saveParticipantPrediction(match)}
                            disabled={savingPred[match.id] || draft.s1 === '' || draft.s2 === ''}
                            className="btn-primary w-full text-sm"
                          >
                            {savingPred[match.id] ? '⏳ جاري الحفظ...' : '💾 حفظ التعديل'}
                          </button>
                        </div>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
