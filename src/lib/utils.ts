// Kuwait timezone offset: UTC+3
export const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000

export function toKuwaitTime(utcStr: string): Date {
  const d = new Date(utcStr)
  return new Date(d.getTime() + KUWAIT_OFFSET_MS)
}

export function formatKuwaitTime(utcStr: string): string {
  const d = toKuwaitTime(utcStr)
  const days = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت']
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const day = days[d.getUTCDay()]
  const date = d.getUTCDate()
  const month = months[d.getUTCMonth()]
  const h = d.getUTCHours().toString().padStart(2,'0')
  const m = d.getUTCMinutes().toString().padStart(2,'0')
  return `${day} ${date} ${month} - ${h}:${m}`
}

export function isLocked(kickoffUtc: string): boolean {
  const kickoff = new Date(kickoffUtc)
  const lockTime = new Date(kickoff.getTime() - 1 * 60 * 1000) // 1 minute before
  return new Date() >= lockTime
}

export function getTimeUntilLock(kickoffUtc: string): string {
  const lockTime = new Date(new Date(kickoffUtc).getTime() - 1 * 60 * 1000)
  const now = new Date()
  const diff = lockTime.getTime() - now.getTime()
  if (diff <= 0) return 'مغلق'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 24) {
    const days = Math.floor(h / 24)
    return `${days} يوم`
  }
  if (h > 0) return `${h}س ${m}د`
  return `${m} دقيقة`
}

export function calcPoints(
  pred1: number, pred2: number,
  act1: number,  act2: number,
  predScorer: string, actScorer: string,
  stage: string
): { pts_result: number; pts_scorer: number; total_pts: number } {
  const isGroup = stage === 'group'
  let pts_result = 0

  if (isGroup) {
    if (pred1 === act1 && pred2 === act2) pts_result = 3
    else if (Math.sign(pred1-pred2) === Math.sign(act1-act2)) pts_result = 1
 } else {
    // knockout: 6 for exact 90min, 3 for correct qualifier
    if (pred1 === act1 && pred2 === act2) {
      pts_result = 6
    } else if (Math.sign(pred1 - pred2) === Math.sign(act1 - act2)) {
      pts_result = 3
    }
  }


  let pts_scorer = 0
  if (predScorer && actScorer) {
    const p = predScorer.trim().toLowerCase()
    const a = actScorer.trim().toLowerCase()
    if (p && a && (a.includes(p) || p.includes(a))) pts_scorer = 3
  }

  return { pts_result, pts_scorer, total_pts: pts_result + pts_scorer }
}
