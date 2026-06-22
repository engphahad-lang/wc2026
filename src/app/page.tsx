'use client'
import { useState, useEffect } from 'react'
import { supabase, type LeaderboardRow, type Participant } from '@/lib/supabase'
import Link from 'next/link'

export default function HomePage() {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [leaderboard, setLeaderboard]   = useState<LeaderboardRow[]>([])
  const [selected, setSelected]         = useState<string>('')
  const [pin, setPin]                   = useState<string>('')
  const [error, setError]               = useState<string>('')
  const [loading, setLoading]           = useState(true)
  const [checking, setChecking]         = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: parts }, { data: lb }] = await Promise.all([
        supabase.from('participants').select('id,name,prev_pts').order('name'),
        supabase.from('leaderboard').select('*').order('rank'),
      ])
      setParticipants(parts || [])
      setLeaderboard(lb || [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogin() {
    if (!selected || !pin) {
      setError('اختر اسمك وأدخل الرمز')
      return
    }
    setChecking(true)
    setError('')
    const { data } = await supabase
      .from('participants')
      .select('id,pin')
      .eq('id', selected)
      .single()

    if (data && data.pin === pin.trim()) {
      window.location.href = `/participant/${selected}`
    } else {
      setError('❌ الرمز غير صحيح')
    }
    setChecking(false)
  }

  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy to-pitch">
      <header className="relative overflow-hidden bg-navy border-b border-gold/30">
        <div className="absolute inset-0 opacity-5 bg-[url('/field.svg')] bg-cover" />
        <div className="relative max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-3xl font-black text-gold tracking-tight">مسابقة الخبير</h1>
          <p className="text-white/60 mt-1 text-lg">كأس العالم 2026</p>
          <div className="flex justify-center gap-4 mt-4 text-sm text-white/50">
            <span>🇺🇸 أمريكا</span>
            <span>🇲🇽 المكسيك</span>
            <span>🇨🇦 كندا</span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        <div className="card space-y-4">
          <h2 className="text-lg font-bold text-gold">⚽ اختر اسمك وسجّل توقعاتك</h2>
          <select
            value={selected}
            onChange={e => { setSelected(e.target.value); setError('') }}
            className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl
                       py-3 px-4 text-white text-base outline-none transition-colors appearance-none"
          >
            <option value="">— اختر اسمك —</option>
            {participants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {selected && (
            <div className="space-y-3 animate-fade-in">
              <input
                type="number"
                value={pin}
                onChange={e => { setPin(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="أدخل رمزك المكوّن من 4 أرقام"
                maxLength={4}
                className="w-full bg-navy border-2 border-white/20 focus:border-gold rounded-xl
                           py-3 px-4 text-white text-center text-xl tracking-widest outline-none transition-colors"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button
                onClick={handleLogin}
                disabled={checking || pin.length < 4}
                className="btn-primary w-full text-lg"
              >
                {checking ? '⏳ جاري التحقق...' : 'دخول ←'}
              </button>
            </div>
          )}
         </div>
        <Link href="/today" className="btn-ghost w-full text-center block text-sm">
          📅 توقعات مباريات اليوم
        </Link>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gold">📊 الترتيب العام</h2>
            <span className="text-xs text-white/40">النقاط السابقة + الموقع</span>
          </div>
          {loading ? (
            <div className="text-center py-8 text-white/40">جاري التحميل...</div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors
                    ${row.rank <= 3 ? 'bg-gold/10 border border-gold/30' : 'bg-white/5'}`}
                >
                  <span className="text-xl w-8 text-center flex-shrink-0">
                    {medals[row.rank] || <span className="text-white/40 text-sm font-bold">{row.rank}</span>}
                  </span>
                  <span className="flex-1 font-bold text-sm">{row.name}</span>
                  <div className="text-left text-xs text-white/40 leading-tight">
                    <div>سابق: {row.prev_pts}</div>
                    <div>موقع: {row.site_pts}</div>
                  </div>
                  <span className="text-gold font-black text-xl w-12 text-center">{row.total_pts}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-gold">📌 نظام النقاط</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['نتيجة صحيحة كاملة (مجموعات)', '3 نقاط'],
              ['فائز/تعادل صحيح فقط', '1 نقطة'],
              ['مسجل هدف صحيح', '3 نقاط'],
              ['نتيجة صحيحة 90 دقيقة (خروج)', '6 نقاط'],
              ['متأهل صحيح', '3 نقاط'],
            ].map(([label, pts]) => (
              <div key={label} className="bg-white/5 rounded-lg p-2">
                <div className="text-white/70 text-xs leading-tight">{label}</div>
                <div className="text-gold font-bold mt-0.5">{pts}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40 mt-1">
            ⏰ باب التوقعات يُغلق قبل بداية كل مباراة بدقيقة واحدة
          </p>
        </div>

        <div className="text-center">
          <Link href="/admin" className="text-xs text-white/20 hover:text-white/40 transition-colors">
            لوحة الإدارة
          </Link>
        </div>
      </div>
    </div>
  )
}
