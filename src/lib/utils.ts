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
 const lockTime = new Date(kickoff.getTime() - 1 * 60 * 1000)
 return Date.now() >= lockTime.getTime()
}
 
export function getTimeUntilLock(kickoffUtc: string): string {
 const lockTime = new Date(new Date(kickoffUtc).getTime() - 1 * 60 * 1000)
 const diff = lockTime.getTime() - Date.now()
 if (diff <= 0) return 'مغلق'
 const totalMinutes = Math.floor(diff / 60000)
 const h = Math.floor(totalMinutes / 60)
 const m = totalMinutes % 60
 if (h >= 24) {
   const days = Math.floor(h / 24)
   return `${days} يوم`
 }
 if (h > 0) return `${h}س ${m}د`
 return `${m} دقيقة`
}
 
function matchesText(a?: string, b?: string): boolean {
 if (!a || !b) return false
 const x = a.trim().toLowerCase()
 const y = b.trim().toLowerCase()
 if (!x || !y) return false
 return x.includes(y) || y.includes(x)
}
 
export function calcPoints(
 pred1: number, pred2: number,
 act1: number, act2: number,
 predScorer: string, actScorer: string,
 stage: string,
 predQualifier?: string, actQualifier?: string,
 predAssist?: string, actAssist?: string,
 predCard?: string, actCard?: string
): {
 pts_result: number
 pts_scorer: number
 pts_qualifier: number
 pts_assist: number
 pts_card: number
 pts_bonus: number
 total_pts: number
} {
 const isGroup = stage === 'group'
 const isLateKnockout = stage === 'sf' || stage === 'final'
 const isEarlyKnockout = stage === 'r16' || stage === 'qf'
 
 let pts_result = 0
 let pts_scorer = 0
 let pts_qualifier = 0
 let pts_assist = 0
 let pts_card = 0
 let pts_bonus = 0
 
 if (isGroup) {
   if (pred1 === act1 && pred2 === act2) pts_result = 3
   else if (Math.sign(pred1 - pred2) === Math.sign(act1 - act2)) pts_result = 1
 
   if (matchesText(predScorer, actScorer)) pts_scorer = 3
 } else {
   // كل أدوار الإقصاء (r32, r16, qf, sf, final)
   const exactResult = pred1 === act1 && pred2 === act2
   if (exactResult) {
     pts_result = 6
   } else if (Math.sign(pred1 - pred2) === Math.sign(act1 - act2)) {
     pts_result = 1
   }
 
   // نقاط المتأهل - فقط إذا توقع المشارك تعادل
   const predictedDraw = pred1 === pred2
   if (predictedDraw && matchesText(predQualifier, actQualifier)) {
     pts_qualifier = 3
   }
 
   // مسجل الهدف، صانع الهدف، لاعب البطاقة - فقط لدور 16 وما بعده
   if (isEarlyKnockout || isLateKnockout) {
     if (matchesText(predScorer, actScorer)) pts_scorer = 3
   }
 
   // صانع الهدف ولاعب البطاقة - فقط نصف النهائي والنهائي
   if (isLateKnockout) {
     if (matchesText(predAssist, actAssist)) pts_assist = 3
     if (matchesText(predCard, actCard)) pts_card = 3
   }
 
   // البونص - فقط دور 16 وربع النهائي، عند نتيجة كاملة صحيحة + مسجل صحيح
   if (isEarlyKnockout && exactResult && pts_scorer === 3) {
     pts_bonus = 3
   }
 }
 
 const total_pts = pts_result + pts_scorer + pts_qualifier + pts_assist + pts_card + pts_bonus
 
 return { pts_result, pts_scorer, pts_qualifier, pts_assist, pts_card, pts_bonus, total_pts }
}
 
