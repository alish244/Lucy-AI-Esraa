/* ==========================================================================
   AI Client
   - Tries local knowledge first (free, offline, strict scope).
   - Falls back to Google Gemini (free tier) when the user provides a key.
   - All responses stay in Arabic and scoped to Al-Esraa University context.
   ========================================================================== */

(function () {
  'use strict';

  // Google rotated the free-tier models; 1.5-flash-latest was retired.
  // Try newer first, fall back to the previous generation for older keys.
  const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
  const GEMINI_URL = (model, key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  function getKey() {
    try { return localStorage.getItem('lucy.gemini.key') || ''; } catch { return ''; }
  }
  function setKey(v) {
    try { localStorage.setItem('lucy.gemini.key', v || ''); } catch {}
  }
  function hasKey() { return !!getKey(); }

  async function askGemini(question, contextText) {
    const key = getKey();
    if (!key) throw new Error('NO_KEY');

    const body = {
      contents: [{
        role: 'user',
        parts: [{
          text: `${contextText}\n\n=== سؤال المستخدم ===\n${question}\n\n=== تعليمات ===\nأجيبي باللغة العربية فقط. كوني موجزة (2-4 جمل). استخدمي المعلومات أعلاه حصراً.`
        }]
      }],
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 500
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    };

    let lastError = null;
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(GEMINI_URL(model, key), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          // 404 = model not available for this key; try next model.
          // Other status codes are terminal (bad key, quota, etc.).
          if (res.status === 404) {
            lastError = new Error(`GEMINI_HTTP_404_${model}`);
            continue;
          }
          throw new Error(`GEMINI_HTTP_${res.status}: ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const answer =
          data?.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim()
          || '';
        if (!answer) throw new Error('GEMINI_EMPTY');
        return answer;
      } catch (err) {
        if (err.message.startsWith('GEMINI_HTTP_404')) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error('GEMINI_NO_MODEL');
  }

  function friendlyGeminiError(err) {
    const m = err.message || '';
    if (m.startsWith('GEMINI_HTTP_400')) return 'مفتاح Gemini غير صالح أو الطلب مرفوض. تحقق من المفتاح في الإعدادات.';
    if (m.startsWith('GEMINI_HTTP_401') || m.startsWith('GEMINI_HTTP_403')) return 'المفتاح غير مصرَّح به. تأكد من تفعيل Generative Language API على حسابك في Google AI Studio.';
    if (m.startsWith('GEMINI_HTTP_429')) return 'تجاوزت حد الاستخدام المجاني من Gemini. حاولي بعد دقيقة.';
    if (m.startsWith('GEMINI_HTTP_404')) return 'الموديل غير متاح لمفتاحك. جدّدي المفتاح من Google AI Studio.';
    if (m.startsWith('GEMINI_HTTP_5'))   return 'خدمة Gemini غير متوفرة مؤقتاً. حاولي بعد قليل.';
    if (m === 'GEMINI_EMPTY')            return 'Gemini أعاد استجابة فارغة (قد تكون فلترة محتوى). جرّبي صياغة أخرى.';
    return `تعذّر الاتصال بـ Gemini. تحقّقي من الإنترنت. (${m.slice(0, 80)})`;
  }

  /**
   * Main ask() — chooses best strategy.
   * Returns { text, source: 'local' | 'gemini' | 'fallback' }
   */
  async function ask(question) {
    const local = window.LucyKnowledge.localAnswer(question);
    const keySet = hasKey();
    const isOpenEnded =
      question.trim().length > 30 ||
      /لماذا|كيف|اشرح|وضح|ماذا|لماذ|ما\s*هو|ما\s*هي|ما\s*معنى|أخبر|حدثيني|تكلمي|رأيك|why|how|explain|what|tell|describe/i.test(question);

    // 1) Local wins only for short, specific lookups. When the key is set and
    //    the question is open-ended we route to Gemini for a richer answer.
    if (local && !(keySet && isOpenEnded)) {
      return { text: local, source: 'local' };
    }

    // 2) Key is set — always reach Gemini rather than silently falling back.
    if (keySet) {
      try {
        const context = window.LucyKnowledge.buildAIContext();
        const answer = await askGemini(question, context);
        return { text: answer, source: 'gemini' };
      } catch (err) {
        console.warn('Gemini failed:', err.message);
        if (local) return { text: local, source: 'local' };
        return { text: friendlyGeminiError(err), source: 'fallback' };
      }
    }

    // 3) No key set: local wins if it matched, otherwise scope-guidance message.
    if (local) return { text: local, source: 'local' };
    return {
      text: 'عذراً، أنا مخصصة للإجابة عن الأسئلة المتعلقة بـ**جامعة الإسراء**، **قسم هندسة تقنيات الحاسوب**، **الشعبة A3**، والمشروع ومطوريه. جرّب سؤالاً من هذه المواضيع، أو افعِّل خيار "Gemini API" من الإعدادات للحصول على إجابات أذكى.',
      source: 'fallback'
    };
  }

  window.LucyAI = { ask, getKey, setKey, hasKey };
})();
