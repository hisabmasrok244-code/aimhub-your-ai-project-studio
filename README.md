# AimHub: Your AI Project Studio

أنشئ تطبيق Android حقيقي باسم AimHub، وليس مجرد واجهة تجريبية أو موقع WebView.

فكرة التطبيق: منصة شبيهة بـ GitHub لكن مخصصة لإدارة المشاريع وبنائها وإنشاء APK من الهاتف.

1. المشاريع والمستودعات

نظام Projects / Repositories حقيقي داخل التطبيق.

كل مشروع عبارة عن ملفات ومجلدات مثل GitHub.

إنشاء مشروع جديد من الصفر.

رفع ملفات وZIP.

إنشاء وتعديل وحذف ونقل الملفات والمجلدات.

محرر كود داخل التطبيق.

حفظ التعديلات والنسخ.

واجهة واضحة لعرض بنية المشروع.

2. Actions

أضف نظام Actions شبيه بـ GitHub Actions:

تشغيل Build من داخل المشروع.

عرض حالة العملية: queued / running / success / failed.

عرض Logs مباشرة.

حفظ سجل عمليات البناء.

عند نجاح Build يظهر زر واضح Download APK.

إمكانية تنزيل APK الحقيقي الناتج إلى الهاتف.

لا تستخدم Build وهمي أو ملف APK تجريبي؛ يجب أن يكون النظام مصممًا لتنفيذ Build حقيقي.

3. Aymane AI

أضف قسمًا رئيسيًا باسم Aymane AI.

هذا AI مستقل تمامًا عن Lovable بعد تشغيل التطبيق.

المطلوب:

Chat داخل AimHub.

يستطيع قراءة ملفات المشروع الحالي.

يستطيع فهم بنية المشروع والأخطاء والـ Logs.

يستطيع إنشاء مشروع كامل من الصفر.

يستطيع إنشاء وتعديل وحذف الملفات.

يستطيع تنفيذ تعديلات مباشرة داخل Repository.

يستطيع إصلاح أخطاء Build.

يستطيع إضافة Features جديدة.

يستطيع إعادة كتابة أجزاء من المشروع عند الحاجة.

يستطيع تحليل GitHub Actions / Build Logs واقتراح وإجراء الإصلاحات.

المستخدم يكتب مثلًا: "أضف Multiplayer LAN" أو "أصلح خطأ Build" أو "أنشئ لعبة Android من الصفر" ويقوم AI بتعديل الملفات مباشرة داخل المشروع.

قبل التعديلات الكبيرة، اعرض للمستخدم ما سيتم تغييره مع إمكانية الموافقة.

بعد التعديل يمكن للمستخدم تشغيل Build مباشرة.

4. AI API

مهم جدًا: لا تجعل Aymane AI يعتمد على Lovable AI أو رصيد Lovable أو أي خدمة خاصة بـ Lovable.

صمم النظام بحيث يكون AI Backend مستقلًا تمامًا، باستخدام API Key سأضعه أنا لاحقًا في إعدادات المشروع/Environment Variables.

لا تضع API Key داخل الكود أو GitHub أو APK.

أنشئ طبقة AI مستقلة قابلة لتغيير مزود الـ API لاحقًا، مثل:

OpenAI-compatible API

OpenRouter

أو أي API متوافق مع OpenAI format.

أنا سأوفر API Key لاحقًا، لذلك لا تستخدم مفتاحًا تجريبيًا.

5. Android

التطبيق يجب أن يكون Android APK حقيقي قابل للبناء والتثبيت.

أريد المشروع مجهزًا للبناء عبر GitHub Actions، مع Workflow واضح يقوم بـ:

تثبيت dependencies.

Build التطبيق.

إنشاء APK حقيقي.

حفظ APK كـ Artifact.

إظهار رابط/زر لتنزيل APK.

6. التصميم

اجعل التصميم احترافيًا وحديثًا، مستوحى من GitHub وGitLab لكن بدون نسخ التصميم حرفيًا.

الاسم: AimHub

قسم الذكاء الاصطناعي: Aymane AI

أريد واجهة مناسبة للهاتف، سريعة، واضحة، Dark Mode، مع Navigation سهل بين:

Home

Projects

Repository

Files

Actions

Aymane AI

Settings

7. مهم جدًا

لا تنشئ مجرد Mockup أو Demo.

أريد أساسًا حقيقيًا قابلًا للتطوير، مع Architecture منظمة تسمح لاحقًا بإضافة:

Git integration

GitHub import/export

حسابات المستخدمين

Cloud repositories

Build servers

أكثر من لغة وبرنامج Build

إدارة Secrets

Branches وCommits

لا تحذف أو تكسر أي وظيفة موجودة أثناء التطوير. ابدأ ببناء النظام الأساسي الحقيقي، واجعل كل جزء قابلًا للتوسع لاحقًا. إذا كانت هناك وظيفة لا يمكن تنفيذها بالكامل داخل بيئة Lovable، أنشئ لها Architecture وواجهات API حقيقية بدل اختراع وظيفة وهمية.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d7d72102-37b0-42bc-a4d3-da166e8af56e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
