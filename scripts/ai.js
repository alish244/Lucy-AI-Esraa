/* ==========================================================================
   AI Client
   Routing order:
     1. Local knowledge base (instant, offline, strictly scoped).
     2. Anthropic Claude (preferred cloud engine when a key is configured).
     3. Google Gemini (alternative cloud engine when a key is configured).
     4. Scope-guidance fallback.
   All responses stay in Arabic and scoped to Al-Esraa University context.
   ========================================================================== */

(function () {
  'use strict';

  // --- Claude config -------------------------------------------------------
  // Newest first; older models retained as fallbacks for older keys.
  const CLAUDE_MODELS = [
    'claude-haiku-4-5-20251001',
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022'
  ];
  const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

  // --- Gemini config -------------------------------------------------------
  const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-latest'];
  const GEMINI_URL = (model, key) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  // --- Key / preference storage -------------------------------------------
  function getKey()          { try { return localStorage.getItem('lucy.gemini.key') || ''; } catch { return ''; } }
  function setKey(v)         { try { localStorage.setItem('lucy.gemini.key', v || ''); } catch {} }
  function hasKey()          { return !!getKey(); }

  function getClaudeKey()    { try { return localStorage.getItem('lucy.claude.key') || ''; } catch { return ''; } }
  function setClaudeKey(v)   { try { localStorage.setItem('lucy.claude.key', v || ''); } catch {} }
  function hasClaudeKey()    { return !!getClaudeKey(); }

  function getEngine()       { try { return localStorage.getItem('lucy.engine') || 'auto'; } catch { return 'auto'; } }
  function setEngine(v)      { try { localStorage.setItem('lucy.engine', v || 'auto'); } catch {} }

  // --- Claude call --------------------------------------------------------
  async function askClaude(question, contextText) {
    const key = getClaudeKey();
    if (!key) throw new Error('NO_KEY');

    const systemPrompt =
      `${contextText}\n\n` +
      `أنتِ "لوسي" (Lucy)، مساعدة ذكية أنثى بشخصية هادئة وواثقة ودافئة.\n` +
      `أجيبي باللغة العربية الفصحى المبسطة، موجزة (2-4 جمل)، واستخدمي المعلومات أعلاه حصراً.\n` +
      `إن سُئلتِ عن أي شيء خارج نطاق جامعة الإسراء، اعتذري بلطف واقترحي سؤالاً ذا صلة.`;

    let lastError = null;
    for (const model of CLAUDE_MODELS) {
      try {
        const res = await fetch(CLAUDE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            // Required for direct browser calls; Anthropic documents this explicitly.
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 500,
            system: systemPrompt,
            messages: [{ role: 'user', content: question }]
          })
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          // Retry on 404 (model gone) or 400 (bad request — may be model-specific).
          // This lets us walk down CLAUDE_MODELS until one works.
          if (res.status === 404 || res.status === 400) {
            lastError = new Error(`CLAUDE_HTTP_${res.status}_${model}: ${errText.slice(0, 500)}`);
            continue;
          }
          throw new Error(`CLAUDE_HTTP_${res.status}: ${errText.slice(0, 500)}`);
        }

        const data = await res.json();
        const parts = data?.content || [];
        const answer = parts.map(p => (p.type === 'text' ? p.text : '')).join(' ').trim();
        if (!answer) throw new Error('CLAUDE_EMPTY');
        return answer;
      } catch (err) {
        if (err.message && err.message.startsWith('CLAUDE_HTTP_404')) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError || new Error('CLAUDE_NO_MODEL');
  }

  function friendlyClaudeError(err) {
    const m = err.message || '';
    if (m.startsWith('CLAUDE_HTTP_401')) return 'مفتاح Claude غير صالح أو منتهي. أنشئي مفتاحاً جديداً من console.anthropic.com.';
    if (m.startsWith('CLAUDE_HTTP_403')) return 'المفتاح غير مصرَّح به. تحقّقي من صلاحياته في إعدادات المفاتيح.';
    if (m.startsWith('CLAUDE_HTTP_402') || /credit_balance/i.test(m)) return 'رصيد حسابك في Anthropic نفد. أضيفي رصيداً من console.anthropic.com/settings/billing.';
    if (m.startsWith('CLAUDE_HTTP_429')) return 'تجاوزتِ حد الطلبات. انتظري قليلاً ثم حاولي.';
    if (m.startsWith('CLAUDE_HTTP_404')) return 'لم يُقبل أي من موديلات Claude. المفتاح قد يكون مقيداً.';
    if (m.startsWith('CLAUDE_HTTP_5'))   return 'خدمة Claude غير متوفرة مؤقتاً. حاولي بعد قليل.';
    if (m === 'CLAUDE_EMPTY')            return 'Claude أعاد استجابة فارغة. جرّبي صياغة أخرى.';
    return `تعذّر الاتصال بـ Claude. تحقّقي من الإنترنت. (${m.slice(0, 80)})`;
  }

  // --- Gemini call --------------------------------------------------------
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
      generationConfig: { temperature: 0.35, topP: 0.9, maxOutputTokens: 500 },
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
          if (res.status === 404) {
            lastError = new Error(`GEMINI_HTTP_404_${model}`);
            continue;
          }
          throw new Error(`GEMINI_HTTP_${res.status}: ${errText.slice(0, 200)}`);
        }
        const data = await res.json();
        const answer = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ').trim() || '';
        if (!answer) throw new Error('GEMINI_EMPTY');
        return answer;
      } catch (err) {
        if (err.message && err.message.startsWith('GEMINI_HTTP_404')) {
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
    if (m.startsWith('GEMINI_HTTP_401') || m.startsWith('GEMINI_HTTP_403')) return 'المفتاح غير مصرَّح به. تأكدي من تفعيل Generative Language API على حسابك.';
    if (m.startsWith('GEMINI_HTTP_429')) return 'تجاوزتِ حد الاستخدام المجاني من Gemini. حاولي بعد دقيقة.';
    if (m.startsWith('GEMINI_HTTP_404')) return 'الموديل غير متاح لمفتاحك. جدّدي المفتاح من Google AI Studio.';
    if (m.startsWith('GEMINI_HTTP_5'))   return 'خدمة Gemini غير متوفرة مؤقتاً. حاولي بعد قليل.';
    if (m === 'GEMINI_EMPTY')            return 'Gemini أعاد استجابة فارغة. جرّبي صياغة أخرى.';
    return `تعذّر الاتصال بـ Gemini. تحقّقي من الإنترنت. (${m.slice(0, 80)})`;
  }

  // --- Routing ------------------------------------------------------------
  const SCOPE_FALLBACK =
    'عذراً، أنا مخصصة للإجابة عن الأسئلة المتعلقة بـ**جامعة الإسراء**، ' +
    '**قسم هندسة تقنيات الحاسوب**، **الشعبة A3**، والمشروع ومطوريه. ' +
    'جرّب سؤالاً من هذه المواضيع، أو أضف مفتاح **Claude** أو **Gemini** من الإعدادات للحصول على إجابات أذكى.';

  function selectCloudEngine(engine, claudeSet, geminiSet) {
    if (engine === 'claude' && claudeSet) return ['claude'];
    if (engine === 'gemini' && geminiSet) return ['gemini'];
    if (engine === 'local') return [];
    // auto: prefer Claude, fall back to Gemini
    const order = [];
    if (claudeSet) order.push('claude');
    if (geminiSet) order.push('gemini');
    return order;
  }

  async function callEngine(name, question, context) {
    if (name === 'claude') return { text: await askClaude(question, context), source: 'claude' };
    if (name === 'gemini') return { text: await askGemini(question, context), source: 'gemini' };
    throw new Error('UNKNOWN_ENGINE');
  }

  async function ask(question) {
    const local = window.LucyKnowledge.localAnswer(question);
    const claudeSet = hasClaudeKey();
    const geminiSet = hasKey();
    const engine = getEngine();
    const engines = selectCloudEngine(engine, claudeSet, geminiSet);

    const isOpenEnded =
      question.trim().length > 30 ||
      /لماذا|كيف|اشرح|وضح|ماذا|لماذ|ما\s*هو|ما\s*هي|ما\s*معنى|أخبر|حدثيني|تكلمي|رأيك|why|how|explain|what|tell|describe/i.test(question);

    // 1) Short lookups go straight to local when available, unless the user
    //    explicitly pinned a cloud engine.
    const pinnedCloud = engine === 'claude' || engine === 'gemini';
    if (local && !pinnedCloud && !(engines.length && isOpenEnded)) {
      return { text: local, source: 'local' };
    }

    // 2) Try cloud engines in priority order.
    let lastErr = null;
    if (engines.length) {
      const context = window.LucyKnowledge.buildAIContext();
      for (const name of engines) {
        try {
          return await callEngine(name, question, context);
        } catch (err) {
          console.warn(`${name} failed:`, err.message);
          lastErr = { name, err };
        }
      }
      // All cloud engines failed. Prefer local if we have it; else friendly error.
      if (local) return { text: local, source: 'local' };
      const friendly = lastErr.name === 'claude'
        ? friendlyClaudeError(lastErr.err)
        : friendlyGeminiError(lastErr.err);
      return { text: friendly, source: 'fallback' };
    }

    // 3) No cloud engines: local if we have it, else scope guidance.
    if (local) return { text: local, source: 'local' };
    return { text: SCOPE_FALLBACK, source: 'fallback' };
  }

  window.LucyAI = {
    ask,
    getKey, setKey, hasKey,                 // Gemini (kept for backward compat)
    getClaudeKey, setClaudeKey, hasClaudeKey,
    getEngine, setEngine
  };
})();
