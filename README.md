# 🏆 مسابقة الخبير - كأس العالم 2026

موقع توقعات كأس العالم 2026 مع نظام نقاط تلقائي.

---

## خطوات التشغيل (تستغرق ~20 دقيقة)

### الخطوة 1: إنشاء مشروع Supabase (قاعدة البيانات)

1. اذهب إلى **https://supabase.com** → سجّل دخول → New Project
2. اختر اسم للمشروع (مثلاً: `wc2026`)، واختر منطقة قريبة
3. بعد ما يجهز المشروع (دقيقتان) → اضغط **SQL Editor**
4. انسخ محتوى `supabase_schema.sql` والصقه → Run ✅
5. بعدها انسخ محتوى `supabase_seed.sql` والصقه → Run ✅
6. من Settings → API، انسخ:
   - `Project URL` → هذا هو NEXT_PUBLIC_SUPABASE_URL
   - `anon key` → هذا هو NEXT_PUBLIC_SUPABASE_ANON_KEY
   - `service_role key` → هذا هو SUPABASE_SERVICE_ROLE_KEY

### الخطوة 2: رفع الكود على GitHub

```bash
cd wc-site
git init
git add .
git commit -m "initial commit"
# أنشئ repo جديد على github.com وارفع:
git remote add origin https://github.com/YOUR_USERNAME/wc2026.git
git push -u origin main
```

### الخطوة 3: ربط Vercel

1. اذهب إلى **https://vercel.com** → Add New Project
2. اختر الـ repo اللي رفعته
3. في **Environment Variables** أضف:
   ```
   NEXT_PUBLIC_SUPABASE_URL     = https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   SUPABASE_SERVICE_ROLE_KEY    = eyJ...
   NEXT_PUBLIC_ADMIN_PIN        = [رمز سري تختاره أنت]
   ```
4. اضغط **Deploy** → ينتهي خلال دقيقة ✅

---

## البنية والصفحات

| الصفحة | الرابط | الوصف |
|--------|--------|-------|
| الرئيسية | `/` | الترتيب العام + اختيار المشارك |
| توقعات مشارك | `/participant/[id]` | جميع المباريات + فورم التوقع |
| لوحة الإدارة | `/admin` | إدخال النتائج + تحديث النقاط |

## منطق النقاط

- دور المجموعات: نتيجة صحيحة = 3 | فائز/تعادل = 1 | هداف = 3
- خروج المغلوب: نتيجة 90 دقيقة = 6 | متأهل = 3 | هداف = 3
- **باب التوقعات يُغلق تلقائياً قبل بداية كل مباراة بساعة**

## إضافة مباريات خروج المغلوب (73-104)

بعد انتهاء دور المجموعات، أضف المباريات من لوحة الإدارة أو بـ SQL:
```sql
insert into matches (match_num, stage, team1, team2, kickoff_utc)
values (73, 'r32', 'الفريق الأول', 'الفريق الثاني', '2026-07-01 19:00:00+00');
```

## لوحة الإدارة

ادخل على `/admin` واستخدم الـ PIN اللي حددته.
- أدخل النتيجة + مسجلو الأهداف → اضغط "حفظ"
- النظام يحسب نقاط كل مشارك تلقائياً
- تقدر تعدّل نتيجة أي مباراة في أي وقت وتُعاد الحسبة
