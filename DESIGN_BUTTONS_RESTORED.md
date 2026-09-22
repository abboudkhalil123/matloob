# Design Refresh - Restored Navigation Actions

Compared the design refresh against the previous QA Round 6 project.

Restored authenticated actions that were missing from the redesigned shared header:
- لوحة التحكم
- الإشعارات with unread count
- الملف الشخصي
- PRO for suppliers
- تسجيل الخروج

Guest actions remain:
- تسجيل الدخول
- إنشاء حساب

Mobile menu includes all corresponding authenticated and guest actions.
Admin remains in the homepage footer next to privacy as requested; it is not exposed as a general header button.

No Supabase migrations or data logic were changed in this correction.
