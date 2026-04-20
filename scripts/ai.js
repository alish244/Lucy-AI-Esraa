/* ==========================================================================
   AI Client
   - Tries local knowledge first (free, offline, strict scope).
   - Falls back to Google Gemini (free tier) when the user provides a key.
   - All responses stay in Arabic and scoped to Al-Esraa University context.
   ========================================================================== */

(function () {
  'use strict';

  const GEMINI_MODEL = 'gemini-1.5-flash-latest';
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

    const res = await fetch(GEMINI_URL(GEMINI_MODEL, key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`GEMINI_HTTP_${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim()
      || '';
    if (!answer) throw new Error('GEMINI_EMPTY');
    return answer;
  }

  /**
   * Main ask() — chooses best strategy.
   * Returns { text, source: 'local' | 'gemini' | 'fallback' }
   */
  async function ask(question) {
    // 1) Try local knowledge first. It's instant and strictly scoped.
    const local = window.LucyKnowledge.localAnswer(question);

    // If we have a confident local answer, prefer it unless the user key is set
    // and the question looks open-ended (longer than a name lookup).
    const keySet = hasKey();
    const isOpenEnded = question.trim().length > 40 || /\bلماذا|كيف|اشرح|وضح|why|how|explain/i.test(question);

    if (local && !(keySet && isOpenEnded)) {
      return { text: local, source: 'local' };
    }

    // 2) Try Gemini when key is configured.
    if (keySet) {
      try {
        const context = window.LucyKnowledge.buildAIContext();
        const answer = await askGemini(question, context);
        return { text: answer, source: 'gemini' };
      } catch (err) {
        console.warn('Gemini failed, falling back:', err.message);
        if (local) return { text: local, source: 'local' };
      }
    }

    // 3) Out-of-scope graceful fallback.
    if (local) return { text: local, source: 'local' };
    return {
      text: 'عذراً، أنا مخصصة للإجابة عن الأسئلة المتعلقة بـ**جامعة الإسراء**، **قسم هندسة تقنيات الحاسوب**، **الشعبة A3**، والمشروع ومطوريه. جرّب سؤالاً من هذه المواضيع، أو افعِّل خيار "Gemini API" من الإعدادات للحصول على إجابات أذكى.',
      source: 'fallback'
    };
  }

  window.LucyAI = { ask, getKey, setKey, hasKey };
})();
