'use client'
import { useState, useEffect } from 'react'
import { supabase, type Match, type Prediction, type Participant } from '@/lib/supabase'
import { formatKuwaitTime, calcPoints } from '@/lib/utils'
 
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || '1234'
 
type TournamentPred = {
 id: number
 participant_id: number
 pred_champion: string
 pred_runner_up: string
 pred_top_scorer: string
 pred_best_player: string
}
 
export default function AdminPage() {
 const [pin, setPin]         = useState('')
 const [authed, setAuthed]   = useState(false)
 const [matches, setMatches] = useState<Match[]>([])
 const [participants, setParticipants] = useState<Participant[]>([])
 const [results, setResults] = useState<Record<number, { s1: string; s2: string; scorer: string; qualifier: string }>>({})
 const [saving, setSaving]   = useState<Record<number, boolean>>({})
 const [msg, setMsg]         = useState('')
 const [activeTab, setActiveTab] = useState<'results' | 'predictions' | 'manual' | 'tournament' | 'setup'>('results')
 const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null)
 const [participantPredictions, setParticipantPredictions] = useState<Record<number, Prediction>>({})
 const [predDrafts, setPredDrafts] = useState<Record<number, { s1: string; s2: string; scorer: string; qualifier: string }>>({})
 const [savingPred, setSavingPred] = useState<Record<number, boolean>>({})
 const [manualParticipant, setManualParticipant] = useState<number | null>(null)
 const [manualPredictions, setManualPredictions] = useState<Record<number, Prediction>>({})
 const [manualPts, setManualPts] = useState<Record<number, { pts_result: string; pts_scorer: string; pts_qualifier: string }>>({})
 const [savingManual, setSavingManual] = useState<Record<number, boolean>>({})
 const [tournamentPreds, setTournamentPreds] = useState<TournamentPred[]>([])
 const [tournamentResult, setTournamentResult] = useState({ champion: '', runner_up: '', top_scorer: '', best_player: '' })
 const [savingTournament, setSavingTournament] = useState(false)
 const [newMatch, setNewMatch] = useState({ team1: '', team2: '', stage: 'r16', date: '', time: '' })
 const [savingMatch, setSavingMatch] = useState(false)
 const [hideCompleted, setHideCompleted] = useState(true)
 
 async function loadMatches() {
   const { data } = await supabase.from('matches').select('*').order('match_num')
   setMatches(data || [])
 }
 
 async function loadParticipants() {
   const { data } = await supabase.from('participants').select('*').order('name')
   setParticipants(data || [])
 }
 
 async function loadTournamentPreds() {
   const { data } = await supabase.from('tournament_predictions').select('*')
   setTournamentPreds(data || [])
 }
 
 useEffect(() => {
   if (authed) { loadMatches(); loadParticipants(); loadTournamentPreds() }
 }, [authed])
 
 async function loadParticipantPredictions(participantId: number) {
   const { data } = await supabase.from('predictions').select('*').eq('participant_id', participantId)
   if (data) {
     const map: Record<number, Prediction> = {}
     data.forEach(p => { map[p.match_id] = p })
     setParticipantPredictions(map)
     setPredDrafts({})
   }
 }
 
 async function loadManualPredictions(participantId: number) {
   const { data } = await supabase.from('predictions').select('*').eq('participant_id', participantId)
   if (data) {
     const map: Record<number, Prediction> = {}
     data.forEach(p => { map[p.match_id] = p })
     setManualPredictions(map)
     setManualPts({})
   }
 }
 
 async function saveResult(match: Match) {
   const r = results[match.id]
   if (!r) return
   const s1 = parseInt(r.s1), s2 = parseInt(r.s2)
   if (isNaN(s1) || isNaN(s2)) return
   const isKnockout = match.stage !== 'group'
   setSaving(prev => ({ ...prev, [match.id]: true }))
 
   await supabase.from('matches')
     .update({
       score1: s1, score2: s2,
       scorer: !isKnockout ? (r.scorer || null) : null,
       qualifier: isKnockout ? (r.qualifier || null) : null
     })
     .eq('id', match.id)
 
   const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', match.id)
   if (preds && preds.length > 0) {
     const updates = preds.map((p: Prediction) => {
       const pts = calcPoints(
         p.pred_score1, p.pred_score2, s1, s2,
         p.pred_scorer || '', r.scorer || '', match.stage,
         p.pred_qualifier || '', r.qualifier || ''
       )
       return { id: p.id, ...pts }
     })
     for (const u of updates) {
       await supabase.from('predictions').update({
         pts_result: u.pts_result,
         pts_scorer: u.pts_scorer,
         pts_qualifier: u.pts_qualifier,
         total_pts: u.total_pts
       }).eq('id', u.id)
     }
   }
   setMsg(`✅ تم حفظ نتيجة مباراة ${match.match_num} وتحديث النقاط`)
   setSaving(prev => ({ ...prev, [match.id]: false }))
   setTimeout(() => window.location.reload(), 1500)
 }
 
 async function saveTournamentResults() {
   if (!tournamentResult.champion) return
   setSavingTournament(true)
   for (const tp of tournamentPreds) {
     let bonus = 0
     if (tp.pred_champion?.toLowerCase() === tournamentResult.champion.toLowerCase()) bonus += 20
     if (tp.pred_runner_up?.toLowerCase() === tournamentResult.runner_up.toLowerCase()) bonus += 10
     if (tp.pred_top_scorer?.toLowerCase() === tournamentResult.top_scorer.toLowerCase()) bonus += 15
     if (tp.pred_best_player?.toLowerCase() === tournamentResult.best_player.toLowerCase()) bonus += 10
     if (bonus > 0) {
       const participant = participants.find(p => p.id === tp.participant_id)
       if (participant) {
         await supabase.from('participants').update({ prev_pts: (participant.prev_pts || 0) + bonus }).eq('id', tp.participant_id)
       }
     }
   }
   setMsg('✅ تم حساب نقاط توقعات البطولة وإضافتها')
   setSavingTournament(false)
   await loadParticipants()
   setTimeout(() => setMsg(''), 4000)
 }
 
 async function toggleLock(match: Match) {
   await supabase.from('matches').update({ is_locked: !match.is_locked }).eq('id', match.id)
   await loadMatches()
 }
 
 async function createMatch() {
   if (!newMatch.team1 || !newMatch.team2 || !newMatch.date || !newMatch.time) return
   setSavingMatch(true)
 
   const localStr = `${newMatch.date}T${newMatch.time}:00`
   const kickoff_utc = new Date(new Date(localStr).getTime() - 3 * 60 * 60 * 1000).toISOString()
 
   const maxNum = matches.length > 0 ? Math.max(...matches.map(m => m.match_num)) : 0
 
   await supabase.from('matches').insert({
     match_num: maxNum + 1,
     team1: newMatch.team1,
     team2: newMatch.team2,
     stage: newMatch.stage,
     group_name: null,
     kickoff_utc,
     is_locked: false,
     score1: null,
     score2: null,
   })
 
   setNewMatch({ team1: '', team2: '', stage: 'r16', date: '', time: '' })
   setSavingMatch(false)
   setMsg('✅ تم إنشاء المباراة بنجاح')
   await loadMatches()
   setTimeout(() => setMsg(''), 3000)
 }
 
 function getResult(match: Match) {
   return results[match.id] || {
     s1: match.score1 !== null ? String(match.score1) : '',
     s2: match.score2 !== null ? String(match.score2) : '',
     scorer: match.scorer || '',
     qualifier: match.qualifier || '',
   }
 }
 
 async function saveParticipantPrediction(match: Match) {
   if (!selectedParticipant) return
   const draft = predDrafts[match.id]
   if (!draft) return
   const s1 = parseInt(draft.s1), s2 = parseInt(draft.s2)
   if (isNaN(s1) || isNaN(s2)) return
   const isKnockout = match.stage !== 'group'
   setSavingPred(prev => ({ ...prev, [match.id]: true }))
   const existing = participantPredictions[match.id]
   const payload = {
     participant_id: selectedParticipant, match_id: match.id,
     pred_score1: s1, pred_score2: s2,
     pred_scorer: !isKnockout ? (draft.scorer || null) : null,
     pred_qualifier: isKnockout ? (draft.qualifier || null) : null,
   }
   if (existing) {
     if (match.score1 !== null && match.score2 !== null) {
       const pts = calcPoints(s1, s2, match.score1, match.score2,
         draft.scorer || '', match.scorer || '', match.stage,
         draft.qualifier || '', match.qualifier || '')
       await supabase.from('predictions').update({ ...payload, ...pts }).eq('id', existing.id)
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
 
 async function saveManualPoints(predId: number, matchId: number) {
   const pts = manualPts[matchId]
   if (!pts) return
   const pts_result = parseInt(pts.pts_result)
   const pts_scorer = parseInt(pts.pts_scorer)
   const pts_qualifier = parseInt(pts.pts_qualifier || '0')
   if (isNaN(pts_result)) return
   const match = matches.find(m => m.id === matchId)
   const isKnockout = match?.stage !== 'group'
   setSavingManual(prev => ({ ...prev, [matchId]: true }))
   await supabase.from('predictions').update({
     pts_result,
     pts_scorer: isKnockout ? 0 : pts_scorer,
     pts_qualifier,
     total_pts: pts_result + (isKnockout ? 0 : pts_scorer) + pts_qualifier
   }).eq('id', predId)
   await loadManualPredictions(manualParticipant!)
   setSavingManual(prev => ({ ...prev, [matchId]: false }))
   setMsg('✅ تم تعديل النقاط يدوياً')
   setTimeout(() => setMsg(''), 3000)
 }
 
 function getPredDraft(match: Match) {
   const d = predDrafts[match.id]
   const p = participantPredictions[match.id]
   return {
     s1: d?.s1 ?? (p ? String(p.pred_score1) : ''),
     s2: d?.s2 ?? (p ? String(p.pred_score2) : ''),
     scorer: d?.scorer ?? (p?.pred_scorer || ''),
     qualifier: d?.qualifier ?? (p?.pred_qualifier || ''),
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
 
 if (!authed) {
   return (
     <div className="min-h-screen bg-navy flex items-center justify-center p-4">
       <div className="card w-full max-w-xs space-y-4 text-center">
         <div className="text-4xl">🔐</div>
         <h1 className="text-xl font-bold text-gold">لوحة الإدارة</h1>
         <input type="password" value={pin}
           onChange={e => setPin(e.target.value)}
           onKeyDown={e => e.key === 'Enter' && pin === ADMIN_PIN && setAuthed(true)}
           placeholder="رمز الدخول"
           className="w-full bg-navy-light border-2 border-white/20 rounded-xl py-3 px-4 text-center text-white outline-none"
         />
         <button onClick={() => pin === ADMIN_PIN ? setAuthed(true) : setMsg('رمز خاطئ')}
           className="btn-primary w-full">دخول</button>
         {msg && <p className="text-red-400 text-sm">{msg}</p>}
       </div>
     </div>
   )
 }
 
 const unplayed = matches.filter(m => m.score1 === null && m.score2 === null)
 const played   = matches.filter(m => m.score1 !== null || m.score2 !== null)
 
 return (
   <div className="min-h-screen bg-navy">
     <header className="bg-navy border-b border-gold/30 sticky top-0 z-10">
       <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
         <h1 className="text-lg font-black text-gold">⚙️ لوحة الإدارة</h1>
         <span className="text-xs text-white/40">{matches.length} مباراة · {played.length} مُلعبة</span>
       </div>
       <div className="max-w-3xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
         <button onClick={() => setActiveTab('results')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeTab === 'results' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}>📊 النتائج</button>
         <button onClick={() => setActiveTab('predictions')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeTab === 'predictions' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}>✏️ تعديل التوقعات</button>
         <button onClick={() => setActiveTab('manual')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeTab === 'manual' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}>🔢 تعديل النقاط</button>
         <button onClick={() => setActiveTab('tournament')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeTab === 'tournament' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}>🏆 نتائج البطولة</button>
         <button onClick={() => setActiveTab('setup')} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-bold transition-colors ${activeTab === 'setup' ? 'bg-gold text-navy' : 'bg-white/10 text-white/70'}`}>🏗️ إنشاء مباريات</button>
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
               {unplayed.map(match => {
                 const r = getResult(match)
                 const isKnockout = match.stage !== 'group'
                 return (
                   <div key={match.id} className="card space-y-3">
                     <div className="flex items-center justify-between">
                       <span className="badge-group">م{match.match_num} · {match.group_name || stageLabel(match.stage)}</span>
                       <div className="flex items-center gap-2">
                         <span className="text-xs text-white/40">{formatKuwaitTime(match.kickoff_utc)}</span>
                         <button onClick={() => toggleLock(match)}
                           className={`text-xs px-2 py-1 rounded-lg ${match.is_locked ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                           {match.is_locked ? '🔒 مغلق' : '🔓 مفتوح'}
                         </button>
                       </div>
                     </div>
                     <div className="flex items-center gap-1 font-bold text-sm">
                       <span className="flex-1 text-right">{match.team1}</span>
                       <input type="number" min="0" max="20" value={r.s1}
                         onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:'',qualifier:''}), s1: e.target.value}}))}
                         className="score-input" placeholder="0" />
                       <span className="text-white/30">-</span>
                       <input type="number" min="0" max="20" value={r.s2}
                         onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:'',qualifier:''}), s2: e.target.value}}))}
                         className="score-input" placeholder="0" />
                       <span className="flex-1">{match.team2}</span>
                     </div>
                     {!isKnockout && (
                       <input type="text" value={r.scorer}
                         onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:'',qualifier:''}), scorer: e.target.value}}))}
                         placeholder="مسجلو الأهداف"
                         className="w-full bg-navy border border-white/20 rounded-xl py-2 px-3 text-sm outline-none focus:border-gold"
                       />
                     )}
                     {isKnockout && (
                       <div className="flex gap-2 items-center">
                         <span className="text-xs text-white/50 flex-shrink-0">🏆 المتأهل:</span>
                         <select value={r.qualifier}
                           onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:'',s2:'',scorer:'',qualifier:''}), qualifier: e.target.value}}))}
                           className="flex-1 bg-navy border border-white/20 focus:border-gold rounded-xl py-2 px-3 text-sm text-white outline-none appearance-none">
                           <option value="">— اختر المتأهل —</option>
                           <option value={match.team1}>{match.team1}</option>
                           <option value={match.team2}>{match.team2}</option>
                         </select>
                       </div>
                     )}
                     <button onClick={() => saveResult(match)}
                       disabled={saving[match.id] || r.s1==='' || r.s2===''}
                       className="btn-primary w-full text-sm">
                       {saving[match.id] ? '⏳ جاري الحفظ...' : '💾 حفظ النتيجة وتحديث النقاط'}
                     </button>
                   </div>
                 )
               })}
             </div>
           </section>
 
           <section>
             <h2 className="text-gold font-bold mb-3 flex items-center justify-between"><span>✅ نتائج مُدخلة ({played.length})</span><button onClick={() => setHideCompleted(!hideCompleted)} className="text-xs px-3 py-1 rounded-full bg-white/10 text-white/60">{hideCompleted ? '👁 إظهار' : '🙈 إخفاء'}</button></h2>
             <div className="space-y-2">
               {!hideCompleted && played.map(match => {
                 const r = getResult(match)
                 const isKnockout = match.stage !== 'group'
                 return (
                   <div key={match.id} className="card py-2 px-3 space-y-2">
                     <div className="flex items-center gap-2 text-sm">
                       <span className="text-white/40 text-xs w-8">م{match.match_num}</span>
                       <span className="flex-1 text-right font-bold text-xs">{match.team1}</span>
                       <span className="bg-pitch px-3 py-1 rounded-lg font-black text-gold text-sm">{match.score1}-{match.score2}</span>
                       <span className="flex-1 text-xs font-bold">{match.team2}</span>
                     </div>
                     {match.scorer && <div className="text-xs text-white/30 text-center">⚽ {match.scorer}</div>}
                     {match.qualifier && <div className="text-xs text-white/30 text-center">🏆 {match.qualifier}</div>}
                     <details className="group">
                       <summary className="text-xs text-white/30 cursor-pointer hover:text-white/60">تعديل النتيجة</summary>
                       <div className="mt-2 space-y-2">
                         <div className="flex items-center gap-1">
                           <input type="number" min="0" max="20" value={r.s1}
                             onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:match.scorer||'',qualifier:match.qualifier||''}), s1: e.target.value}}))}
                             className="score-input" />
                           <span className="text-white/30">-</span>
                           <input type="number" min="0" max="20" value={r.s2}
                             onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:match.scorer||'',qualifier:match.qualifier||''}), s2: e.target.value}}))}
                             className="score-input" />
                           {!isKnockout && (
                             <input type="text" value={r.scorer}
                               onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:match.scorer||'',qualifier:match.qualifier||''}), scorer: e.target.value}}))}
                               className="flex-1 bg-navy border border-white/20 rounded-xl py-1.5 px-2 text-xs outline-none" />
                           )}
                         </div>
                         {isKnockout && (
                           <div className="flex gap-2 items-center">
                             <span className="text-xs text-white/50">🏆 المتأهل:</span>
                             <select value={r.qualifier}
                               onChange={e => setResults(prev => ({ ...prev, [match.id]: {...(prev[match.id]||{s1:String(match.score1),s2:String(match.score2),scorer:'',qualifier:match.qualifier||''}), qualifier: e.target.value}}))}
                               className="flex-1 bg-navy border border-white/20 rounded-xl py-1.5 px-2 text-xs text-white outline-none appearance-none">
                               <option value="">— اختر المتأهل —</option>
                               <option value={match.team1}>{match.team1}</option>
                               <option value={match.team2}>{match.team2}</option>
                             </select>
                           </div>
                         )}
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
             <select value={selectedParticipant || ''}
               onChange={e => { const id = Number(e.target.value); setSelectedParticipant(id); loadParticipantPredictions(id) }}
               className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white text-base outline-none transition-colors appearance-none">
               <option value="">— اختر مشارك —</option>
               {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
             </select>
           </div>
           {selectedParticipant && (
             <div className="space-y-3">
               {matches.map(match => {
                 const pred = participantPredictions[match.id]
                 const draft = getPredDraft(match)
                 const hasPred = !!pred
                 const isKnockout = match.stage !== 'group'
                 return (
                   <div key={match.id} className={`card space-y-3 ${hasPred ? 'border-gold/20' : 'border-white/5'}`}>
                     <div className="flex items-center justify-between">
                       <span className="badge-group">م{match.match_num} · {match.group_name || stageLabel(match.stage)}</span>
                       <span className="text-xs text-white/40">{formatKuwaitTime(match.kickoff_utc)}</span>
                     </div>
                     <div className="flex items-center gap-2 text-sm font-bold">
                       <span className="flex-1 text-right">{match.team1}</span>
                       {match.score1 !== null ? <span className="bg-pitch px-3 py-1 rounded-lg font-black text-gold">{match.score1}-{match.score2}</span> : <span className="text-white/30 px-2">🆚</span>}
                       <span className="flex-1">{match.team2}</span>
                     </div>
                     {hasPred && (
                       <div className="text-xs text-white/40 text-center">
                         التوقع: <span className="text-white/70 font-bold">{pred.pred_score1}-{pred.pred_score2}</span>
                         {pred.pred_qualifier && <span className="mr-2">· 🏆 {pred.pred_qualifier}</span>}
                         {pred.pred_scorer && <span className="mr-2">· ⚽ {pred.pred_scorer}</span>}
                         {match.score1 !== null && <span className={`mr-2 font-bold ${pred.total_pts > 0 ? 'text-emerald-400' : 'text-white/30'}`}>({pred.total_pts} نقطة)</span>}
                       </div>
                     )}
                     {!hasPred && <div className="text-xs text-white/30 text-center">لا يوجد توقع مسجل</div>}
                     <details>
                       <summary className="text-xs text-gold/60 cursor-pointer hover:text-gold">{hasPred ? '✏️ تعديل التوقع' : '➕ إضافة توقع'}</summary>
                       <div className="mt-3 space-y-2">
                         <div className="flex items-center gap-2">
                           <span className="text-xs text-white/50 w-16 text-right">{match.team1}</span>
                           <input type="number" min="0" max="20" value={draft.s1}
                             onChange={e => setPredDrafts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '', qualifier: '' }), s1: e.target.value }}))}
                             className="score-input" placeholder="0" />
                           <span className="text-white/30">-</span>
                           <input type="number" min="0" max="20" value={draft.s2}
                             onChange={e => setPredDrafts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '', qualifier: '' }), s2: e.target.value }}))}
                             className="score-input" placeholder="0" />
                           <span className="text-xs text-white/50 w-16">{match.team2}</span>
                         </div>
                         {!isKnockout && (
                           <input type="text" value={draft.scorer}
                             onChange={e => setPredDrafts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '', qualifier: '' }), scorer: e.target.value }}))}
                             placeholder="مسجل الهدف (اختياري)"
                             className="w-full bg-navy border border-white/20 rounded-xl py-2 px-3 text-sm outline-none focus:border-gold"
                           />
                         )}
                         {isKnockout && (
                           <div className="flex gap-2 items-center">
                             <span className="text-xs text-white/50">🏆 المتأهل:</span>
                             <select value={draft.qualifier}
                               onChange={e => setPredDrafts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { s1: '', s2: '', scorer: '', qualifier: '' }), qualifier: e.target.value }}))}
                               className="flex-1 bg-navy border border-white/20 rounded-xl py-2 px-3 text-sm text-white outline-none appearance-none">
                               <option value="">— اختر المتأهل —</option>
                               <option value={match.team1}>{match.team1}</option>
                               <option value={match.team2}>{match.team2}</option>
                             </select>
                           </div>
                         )}
                         <button onClick={() => saveParticipantPrediction(match)}
                           disabled={savingPred[match.id] || draft.s1 === '' || draft.s2 === ''}
                           className="btn-primary w-full text-sm">
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
 
       {activeTab === 'manual' && (
         <section className="space-y-4">
           <h2 className="text-gold font-bold">🔢 تعديل النقاط يدوياً</h2>
           <div className="card space-y-3">
             <label className="text-sm text-white/70">اختر المشارك:</label>
             <select value={manualParticipant || ''}
               onChange={e => { const id = Number(e.target.value); setManualParticipant(id); loadManualPredictions(id) }}
               className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white text-base outline-none transition-colors appearance-none">
               <option value="">— اختر مشارك —</option>
               {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
             </select>
           </div>
           {manualParticipant && (
             <div className="space-y-3">
               {matches.filter(m => manualPredictions[m.id]).map(match => {
                 const pred = manualPredictions[match.id]
                 if (!pred) return null
                 const isKnockout = match.stage !== 'group'
                 const draft = manualPts[match.id] || {
                   pts_result: String(pred.pts_result),
                   pts_scorer: String(pred.pts_scorer),
                   pts_qualifier: String(pred.pts_qualifier || 0)
                 }
                 return (
                   <div key={match.id} className="card space-y-3">
                     <div className="flex items-center justify-between">
                       <span className="badge-group">م{match.match_num} · {match.group_name || stageLabel(match.stage)}</span>
                       <span className="text-xs text-white/40">{match.team1} vs {match.team2}</span>
                     </div>
                     <div className="text-xs text-white/50 text-center">
                       توقع: <span className="text-white/70">{pred.pred_score1}-{pred.pred_score2}</span>
                       {pred.pred_qualifier && <span className="mr-2">· 🏆 {pred.pred_qualifier}</span>}
                       · نقاط: <span className="text-emerald-400 font-bold">{pred.total_pts}</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className="flex-1">
                         <label className="text-xs text-white/50">نقاط النتيجة</label>
                         <input type="number" min="0" max="10" value={draft.pts_result}
                           onChange={e => setManualPts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { pts_result: String(pred.pts_result), pts_scorer: String(pred.pts_scorer), pts_qualifier: String(pred.pts_qualifier||0) }), pts_result: e.target.value }}))}
                           className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-center text-white outline-none mt-1" />
                       </div>
                       {isKnockout && (
                         <div className="flex-1">
                           <label className="text-xs text-white/50">نقاط المتأهل</label>
                           <input type="number" min="0" max="3" value={draft.pts_qualifier}
                             onChange={e => setManualPts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { pts_result: String(pred.pts_result), pts_scorer: String(pred.pts_scorer), pts_qualifier: String(pred.pts_qualifier||0) }), pts_qualifier: e.target.value }}))}
                             className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-center text-white outline-none mt-1" />
                         </div>
                       )}
                       {!isKnockout && (
                         <div className="flex-1">
                           <label className="text-xs text-white/50">نقاط الهداف</label>
                           <input type="number" min="0" max="3" value={draft.pts_scorer}
                             onChange={e => setManualPts(prev => ({ ...prev, [match.id]: { ...(prev[match.id] || { pts_result: String(pred.pts_result), pts_scorer: String(pred.pts_scorer), pts_qualifier: String(pred.pts_qualifier||0) }), pts_scorer: e.target.value }}))}
                             className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-center text-white outline-none mt-1" />
                         </div>
                       )}
                       <div className="flex-1 text-center">
                         <label className="text-xs text-white/50">المجموع</label>
                         <div className="text-gold font-black text-xl mt-2">
                           {isKnockout
                             ? (parseInt(draft.pts_result)||0) + (parseInt(draft.pts_qualifier)||0)
                             : (parseInt(draft.pts_result)||0) + (parseInt(draft.pts_scorer)||0)
                           }
                         </div>
                       </div>
                     </div>
                     <button onClick={() => saveManualPoints(pred.id, match.id)} disabled={savingManual[match.id]}
                       className="btn-primary w-full text-sm">
                       {savingManual[match.id] ? '⏳ جاري الحفظ...' : '💾 حفظ النقاط'}
                     </button>
                   </div>
                 )
               })}
             </div>
           )}
         </section>
       )}
 
       {activeTab === 'tournament' && (
         <section className="space-y-4">
           <h2 className="text-gold font-bold">🏆 نتائج البطولة النهائية</h2>
           <div className="card space-y-4">
             <p className="text-xs text-white/50">أدخل النتائج الفعلية للبطولة ثم اضغط حساب النقاط.</p>
             <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-xs text-white/50 mb-1 block">🥇 البطل (20 نقطة)</label>
                 <input type="text" value={tournamentResult.champion}
                   onChange={e => setTournamentResult(prev => ({ ...prev, champion: e.target.value }))}
                   placeholder="اسم الفريق"
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-sm text-white outline-none" />
               </div>
               <div>
                 <label className="text-xs text-white/50 mb-1 block">🥈 الوصيف (10 نقاط)</label>
                 <input type="text" value={tournamentResult.runner_up}
                   onChange={e => setTournamentResult(prev => ({ ...prev, runner_up: e.target.value }))}
                   placeholder="اسم الفريق"
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-sm text-white outline-none" />
               </div>
               <div>
                 <label className="text-xs text-white/50 mb-1 block">⚽ الهداف (15 نقطة)</label>
                 <input type="text" value={tournamentResult.top_scorer}
                   onChange={e => setTournamentResult(prev => ({ ...prev, top_scorer: e.target.value }))}
                   placeholder="اسم اللاعب"
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-sm text-white outline-none" />
               </div>
               <div>
                 <label className="text-xs text-white/50 mb-1 block">⭐ أفضل لاعب (10 نقاط)</label>
                 <input type="text" value={tournamentResult.best_player}
                   onChange={e => setTournamentResult(prev => ({ ...prev, best_player: e.target.value }))}
                   placeholder="اسم اللاعب"
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-2 px-3 text-sm text-white outline-none" />
               </div>
             </div>
             <button onClick={saveTournamentResults}
               disabled={savingTournament || !tournamentResult.champion}
               className="btn-primary w-full">
               {savingTournament ? '⏳ جاري الحساب...' : '🏆 حساب نقاط البطولة وإضافتها'}
             </button>
           </div>
           <div className="card space-y-3">
             <h3 className="text-sm font-bold text-white/70">توقعات المشاركين للبطولة</h3>
             <div className="overflow-x-auto">
               <table className="w-full text-xs">
                 <thead>
                   <tr className="border-b border-white/10">
                     <th className="text-right py-2 px-1 text-white/40 font-normal">المشارك</th>
                     <th className="text-center py-2 px-1 text-white/40 font-normal">البطل</th>
                     <th className="text-center py-2 px-1 text-white/40 font-normal">الوصيف</th>
                     <th className="text-center py-2 px-1 text-white/40 font-normal">الهداف</th>
                     <th className="text-center py-2 px-1 text-white/40 font-normal">أفضل لاعب</th>
                   </tr>
                 </thead>
                 <tbody>
                   {tournamentPreds.map(tp => {
                     const p = participants.find(x => x.id === tp.participant_id)
                     const champMatch = tournamentResult.champion && tp.pred_champion?.toLowerCase() === tournamentResult.champion.toLowerCase()
                     const runnerMatch = tournamentResult.runner_up && tp.pred_runner_up?.toLowerCase() === tournamentResult.runner_up.toLowerCase()
                     const scorerMatch = tournamentResult.top_scorer && tp.pred_top_scorer?.toLowerCase() === tournamentResult.top_scorer.toLowerCase()
                     const playerMatch = tournamentResult.best_player && tp.pred_best_player?.toLowerCase() === tournamentResult.best_player.toLowerCase()
                     return (
                       <tr key={tp.id} className="border-b border-white/5">
                         <td className="py-2 px-1 font-bold">{p?.name}</td>
                         <td className={`py-2 px-1 text-center ${champMatch ? 'text-emerald-400 font-bold' : 'text-white/60'}`}>{tp.pred_champion}</td>
                         <td className={`py-2 px-1 text-center ${runnerMatch ? 'text-emerald-400 font-bold' : 'text-white/60'}`}>{tp.pred_runner_up}</td>
                         <td className={`py-2 px-1 text-center ${scorerMatch ? 'text-emerald-400 font-bold' : 'text-white/60'}`}>{tp.pred_top_scorer}</td>
                         <td className={`py-2 px-1 text-center ${playerMatch ? 'text-emerald-400 font-bold' : 'text-white/60'}`}>{tp.pred_best_player}</td>
                       </tr>
                     )
                   })}
                 </tbody>
               </table>
             </div>
           </div>
         </section>
       )}
 
       {activeTab === 'setup' && (
         <section className="space-y-4">
           <h2 className="text-gold font-bold">🏗️ إنشاء مباراة جديدة</h2>
           <div className="card space-y-4">
 
             <div>
               <label className="text-xs text-white/50 mb-1 block">المرحلة</label>
               <select
                 value={newMatch.stage}
                 onChange={e => setNewMatch(prev => ({ ...prev, stage: e.target.value }))}
                 className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white outline-none appearance-none"
               >
                 <option value="r16">دور الـ16</option>
                 <option value="qf">ربع النهائي</option>
                 <option value="sf">نصف النهائي</option>
                 <option value="final">النهائي</option>
               </select>
             </div>
 
             <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-xs text-white/50 mb-1 block">الفريق الأول</label>
                 <input
                   type="text"
                   value={newMatch.team1}
                   onChange={e => setNewMatch(prev => ({ ...prev, team1: e.target.value }))}
                   placeholder="اسم الفريق"
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white text-sm outline-none"
                 />
               </div>
               <div>
                 <label className="text-xs text-white/50 mb-1 block">الفريق الثاني</label>
                 <input
                   type="text"
                   value={newMatch.team2}
                   onChange={e => setNewMatch(prev => ({ ...prev, team2: e.target.value }))}
                   placeholder="اسم الفريق"
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white text-sm outline-none"
                 />
               </div>
             </div>
 
             <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="text-xs text-white/50 mb-1 block">📅 التاريخ</label>
                 <input
                   type="date"
                   value={newMatch.date}
                   onChange={e => setNewMatch(prev => ({ ...prev, date: e.target.value }))}
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white text-sm outline-none"
                 />
               </div>
               <div>
                 <label className="text-xs text-white/50 mb-1 block">⏰ الوقت (بتوقيت الكويت)</label>
                 <input
                   type="time"
                   value={newMatch.time}
                   onChange={e => setNewMatch(prev => ({ ...prev, time: e.target.value }))}
                   className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl py-3 px-4 text-white text-sm outline-none"
                 />
               </div>
             </div>
 
             {newMatch.team1 && newMatch.team2 && newMatch.date && newMatch.time && (
               <div className="bg-white/5 rounded-xl p-3 text-xs text-white/60 text-center space-y-1">
                 <div className="font-bold text-white">{newMatch.team1} 🆚 {newMatch.team2}</div>
                 <div>{newMatch.date} — {newMatch.time} (بتوقيت الكويت)</div>
                 <div className="text-gold">🔒 يُغلق التوقع دقيقة قبل بدء المباراة تلقائياً</div>
               </div>
             )}
 
             <button
               onClick={createMatch}
               disabled={savingMatch || !newMatch.team1 || !newMatch.team2 || !newMatch.date || !newMatch.time}
               className="btn-primary w-full"
             >
               {savingMatch ? '⏳ جاري الإنشاء...' : '✅ إنشاء المباراة'}
             </button>
           </div>
 
           <div className="card space-y-3">
             <h3 className="text-sm font-bold text-white/70">مباريات الأدوار الإقصائية ({matches.filter(m => m.stage !== 'group').length})</h3>
             <div className="space-y-2">
               {matches.filter(m => m.stage !== 'group').map(match => (
                 <div key={match.id} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                   <span className="text-white/40 text-xs">م{match.match_num}</span>
                   <span className="text-xs text-gold/70 w-20 flex-shrink-0">{stageLabel(match.stage)}</span>
                   <span className="flex-1 text-right text-xs font-bold">{match.team1}</span>
                   <span className="text-white/30 text-xs">🆚</span>
                   <span className="flex-1 text-xs font-bold">{match.team2}</span>
                   <span className="text-white/30 text-xs flex-shrink-0">{formatKuwaitTime(match.kickoff_utc)}</span>
                 </div>
               ))}
               {matches.filter(m => m.stage !== 'group').length === 0 && (
                 <div className="text-center text-white/30 text-xs py-4">لا توجد مباريات إقصائية بعد</div>
               )}
             </div>
           </div>
         </section>
       )}
 
     </div>
   </div>
 )
}
