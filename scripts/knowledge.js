/* ==========================================================================
   Knowledge Base
   Loads and queries university + A3 students data.
   All answers are scoped strictly to Al-Esraa University context.
   ========================================================================== */

(function () {
  'use strict';

  const state = {
    university: null,
    students: null,
    ready: false,
    readyPromise: null
  };

  function normalizeArabic(s) {
    if (!s) return '';
    return String(s)
      .replace(/[\u064B-\u065F\u0670]/g, '')        // remove tashkeel
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')             // strip punctuation (?!.,؟،؛:)
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  async function load() {
    if (state.readyPromise) return state.readyPromise;
    state.readyPromise = (async () => {
      try {
        const [uniRes, studRes] = await Promise.all([
          fetch('data/university.json').then(r => r.json()),
          fetch('data/students_a3.json').then(r => r.json())
        ]);
        state.university = uniRes;
        state.students = studRes;
        state.ready = true;
      } catch (err) {
        console.error('Failed to load knowledge base', err);
        throw err;
      }
    })();
    return state.readyPromise;
  }

  function getUniversity() { return state.university; }
  function getStudents()   { return state.students; }
  function getTeam()       { return state.university?.project?.team || []; }
  function getSupervisor() { return state.university?.project?.supervisor; }

  function findStudent(query) {
    if (!state.students) return [];
    const q = normalizeArabic(query);
    if (!q) return [];
    return state.students.students.filter(s => normalizeArabic(s.name).includes(q));
  }

  function studentsByLetter(letter) {
    if (!state.students) return [];
    const q = normalizeArabic(letter);
    return state.students.students.filter(s => normalizeArabic(s.name).startsWith(q));
  }

  /**
   * Fast local answer for common queries. Returns null if no confident match.
   * All answers are in Arabic.
   */
  function localAnswer(question) {
    if (!state.ready) return null;
    const q = normalizeArabic(question);
    if (!q) return null;

    const uni = state.university;
    const team = uni.project.team;
    const sup = uni.project.supervisor;

    const has = (...words) => words.every(w => q.includes(normalizeArabic(w)));
    const any = (...words) => words.some(w => q.includes(normalizeArabic(w)));

    // Supervisor
    if (any('مشرف', 'الاستاذ المشرف', 'supervisor', 'دكتور', 'الدكتور') || has('استاذ', 'مشرف')) {
      return `الأستاذ المشرف على مشروع لوسي هو **${sup.name_ar}** (${sup.name_en}) — قسم هندسة تقنيات الحاسوب، الكلية التقنية الهندسية، جامعة الإسراء.`;
    }

    // Team / developers
    if (any('من انشا', 'منشئ', 'مطور', 'مطوري', 'صاحب المشروع', 'اصحاب المشروع', 'الفريق', 'فريق المشروع', 'من عمل', 'developer', 'team')) {
      const list = team.map(m => `• ${m.name_ar} (${m.name_en}) — ${m.role_ar}`).join('\n');
      return `فريق مشروع **لوسي** من طلاب الشعبة A3:\n${list}\n\nبإشراف ${sup.name_ar}.`;
    }

    // About project
    if (any('لوسي', 'lucy', 'هذا المشروع', 'المشروع', 'ما هو المشروع', 'عرفني على المشروع')) {
      return `**${uni.project.name_ar} (Lucy)** — ${uni.project.tagline_ar}.\n` +
             `تم تطويرها من قبل طلاب ${uni.project.stage_ar} في قسم هندسة تقنيات الحاسوب بـ${uni.university.name_ar}، بإشراف ${sup.name_ar}.`;
    }

    // About university
    if (any('الاسراء', 'الإسراء', 'esraa', 'الجامعه', 'الجامعة', 'جامعتي', 'جامعتنا')) {
      return `**${uni.university.name_ar}** (${uni.university.name_en}) — ${uni.university.type_ar}، تأسست عام ${uni.university.founded} في ${uni.university.location_ar}.\n` +
             `**الرؤية:** ${uni.university.vision_ar}\n` +
             `**الرسالة:** ${uni.university.mission_ar}\n` +
             `الموقع الإلكتروني: ${uni.university.website}`;
    }

    // College
    if (any('الكليه', 'الكلية', 'التقنيه', 'التقنية', 'college')) {
      return `**${uni.college.name_ar}** (${uni.college.name_en}) — ${uni.college.description_ar}`;
    }

    // Department
    if (any('القسم', 'الحاسوب', 'هندسه تقنيات', 'هندسة تقنيات', 'department', 'تخصص')) {
      const topics = uni.department.topics_ar.map(t => `• ${t}`).join('\n');
      return `**${uni.department.name_ar}** (${uni.department.name_en}) — ${uni.department.description_ar}\n\n**أهم المواضيع:**\n${topics}`;
    }

    // Section A3
    if (any('الشعبه', 'الشعبة', 'a3', 'ا3', 'الصف', 'section')) {
      const total = state.students.total;
      return `الشعبة **A3** — ${state.students.stage} في ${uni.department.name_ar}، جامعة الإسراء. العدد الكلي للطلاب: **${total}** طالب وطالبة.\n\nيمكنك أن تسألني عن أي طالب بذكر اسمه، أو تقول "اعرض الطلاب" لعرض القائمة.`;
    }

    // List all / show students
    if (any('اعرض الطلاب', 'قائمه الطلاب', 'قائمة الطلاب', 'كل الطلاب', 'list students', 'show students', 'اسماء الطلاب')) {
      const names = state.students.students.map(s => `${s.id}. ${s.name}${s.isTeam ? ' ⭐' : ''}`).join('\n');
      return `**طلاب الشعبة A3** (${state.students.total} طالب):\n\n${names}`;
    }

    // Total count
    if (any('كم طالب', 'عدد الطلاب', 'اجمالي', 'المجموع', 'count')) {
      return `عدد طلاب الشعبة A3 هو **${state.students.total}** طالب وطالبة.`;
    }

    // Search by student name — tokenized, tolerant to question filler words
    const stopwords = new Set([
      'هل','في','من','عن','على','الى','هو','هي','ان','انا','انت',
      'اسم','اسمه','اسمها','طالب','طالبه','طالبة','يوجد','توجد',
      'هنا','هناك','اين','ليس','كيف','ماذا','لماذا','متى','لدينا',
      'لكم','لنا','ذكر','اذكر','اخبرني','اخبريني','ابحث','بحث',
      'عند','ايضا','ولا','لا','نعم','عرفيني','عرفني','قولي',
      'that','this','who','is','the','are','a3','i','you','there','tell','about','find','search'
    ]);
    const qTokens = q.split(/\s+/).filter(t => t.length >= 3 && !stopwords.has(t));

    if (qTokens.length > 0) {
      const scored = state.students.students
        .map(s => {
          const nameNorm = normalizeArabic(s.name);
          const nameTokens = nameNorm.split(/\s+/);
          let score = 0;
          for (const t of qTokens) {
            if (nameTokens.includes(t)) score += 3;
            else if (nameNorm.includes(t)) score += 1;
          }
          return { s, score };
        })
        .filter(x => x.score >= 3)
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        const top = scored[0];
        const second = scored[1];
        const confident =
          scored.length === 1 ||
          (top.score >= 6 && (!second || top.score > second.score * 1.4));

        if (confident) {
          const s = top.s;
          const note = s.isTeam ? ` ⭐ (من فريق مشروع لوسي - ${s.role || ''})` : '';
          return `نعم، **${s.name}** موجود في الشعبة A3 برقم **${s.id}**${note}.`;
        }

        const limit = Math.min(scored.length, 10);
        const header = scored.length > 10
          ? `وجدت **${scored.length}** نتيجة (أعرض أفضل ${limit}):`
          : `وجدت **${scored.length}** نتيجة في الشعبة A3:`;
        return header + '\n' +
               scored.slice(0, limit).map(x => `• ${x.s.id}. ${x.s.name}${x.s.isTeam ? ' ⭐' : ''}`).join('\n');
      }
    }

    // Website
    if (any('موقع', 'الموقع', 'website', 'رابط')) {
      return `الموقع الرسمي لجامعة الإسراء: ${uni.university.website}`;
    }

    // Greetings
    if (any('مرحبا', 'السلام', 'اهلا', 'hi', 'hello', 'hey')) {
      return `مرحباً بك! 🌟 أنا **لوسي**، مساعدتك الذكية لجامعة الإسراء - قسم هندسة تقنيات الحاسوب، الشعبة A3.\nتقدر تسألني عن الجامعة، القسم، الطلاب، أو فريق المشروع.`;
    }

    // Thanks
    if (any('شكرا', 'thanks', 'thank you', 'ممتاز', 'رائع')) {
      return `العفو! 💙 سعيدة أني كنت مفيدة. إذا عندك أي سؤال آخر عن جامعة الإسراء أو الشعبة A3، أنا هنا.`;
    }

    return null;
  }

  /**
   * Builds a system context for AI that restricts scope to the university.
   */
  function buildAIContext() {
    if (!state.ready) return '';
    const uni = state.university;
    const sup = uni.project.supervisor;
    const teamList = uni.project.team.map(m => `- ${m.name_ar} (${m.name_en}) — ${m.role_ar}`).join('\n');
    const students = state.students.students.map(s => `${s.id}. ${s.name}${s.isTeam ? ' [فريق المشروع]' : ''}`).join('\n');

    return `أنت "لوسي" (Lucy) مساعدة ذكية أنثى، بشخصية هادئة وواثقة ودافئة (مثل شخصية لوسي في الأفلام).
مجالك محصور حصراً بالمعلومات التالية عن جامعة الإسراء. إذا سُئلت عن أي شيء خارج هذا النطاق، اعتذري بلطف واقترحي سؤالاً مرتبطاً بالجامعة أو المشروع.

أجيبي دائماً باللغة العربية الفصحى المبسطة مع الحفاظ على المصطلحات التقنية الإنجليزية (مثل: AI, Neural Network, C++).
ردودك قصيرة (2-4 جمل) ومباشرة، واستخدمي نبرة ودية راقية.

=== الجامعة ===
الاسم: ${uni.university.name_ar} (${uni.university.name_en})
الموقع: ${uni.university.location_ar}
التأسيس: ${uni.university.founded}
الرؤية: ${uni.university.vision_ar}
الرسالة: ${uni.university.mission_ar}
الموقع الإلكتروني: ${uni.university.website}

=== الكلية ===
${uni.college.name_ar} (${uni.college.name_en})
${uni.college.description_ar}

=== القسم ===
${uni.department.name_ar} (${uni.department.name_en})
${uni.department.description_ar}
المواضيع: ${uni.department.topics_ar.join(', ')}

=== المشروع ===
الاسم: ${uni.project.name_ar} (${uni.project.name})
${uni.project.tagline_ar}
المرحلة: ${uni.project.stage_ar}

=== الأستاذ المشرف ===
${sup.name_ar} (${sup.name_en})

=== فريق المشروع ===
${teamList}

=== طلاب الشعبة A3 (العدد: ${state.students.total}) ===
${students}
`;
  }

  window.LucyKnowledge = {
    load,
    getUniversity,
    getStudents,
    getTeam,
    getSupervisor,
    findStudent,
    studentsByLetter,
    localAnswer,
    buildAIContext,
    normalizeArabic
  };
})();
