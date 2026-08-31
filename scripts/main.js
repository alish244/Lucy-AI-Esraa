/* ==========================================================================
   Main App Controller
   Wires together neural canvas, voice, AI, and the conversation UI.
   ========================================================================== */

(function () {
  'use strict';

  const dom = {};
  let neural = null;
  let autoSpeak = true;
  let currentState = 'idle';

  function $(sel) { return document.querySelector(sel); }

  function setState(next) {
    currentState = next;
    if (neural) neural.setState(next);
    const label = $('#stateLabel');
    const container = $('.neural-container');
    if (container) container.dataset.state = next;
    if (label) label.textContent = next.toUpperCase();
  }

  function addMessage(who, text) {
    const conv = dom.conversation;
    const el = document.createElement('div');
    el.className = `msg msg-${who}`;
    el.innerHTML = `<span class="msg-tag">${who === 'lucy' ? 'Lucy' : 'You'}</span><p>${formatText(text)}</p>`;
    conv.appendChild(el);
    conv.scrollTop = conv.scrollHeight;
  }

  function formatText(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\n/g, '<br/>');
  }

  function setAIBadge(source) {
    const badge = $('#aiBadge');
    if (!badge) return;
    badge.classList.remove('gemini', 'claude');
    if (source === 'claude') {
      badge.textContent = 'Claude AI';
      badge.classList.add('claude');
    } else if (source === 'gemini') {
      badge.textContent = 'Gemini AI';
      badge.classList.add('gemini');
    } else if (source === 'local') {
      badge.textContent = 'Local Knowledge';
    } else {
      badge.textContent = 'Fallback';
    }
  }

  async function handleQuestion(text) {
    if (!text || !text.trim()) return;
    addMessage('user', text);
    dom.textInput.value = '';
    setState('thinking');

    try {
      const { text: answer, source } = await window.LucyAI.ask(text);
      addMessage('lucy', answer);
      setAIBadge(source);
      if (autoSpeak) {
        window.LucyVoice.speak(answer);
      } else {
        setState('idle');
      }
    } catch (err) {
      console.error(err);
      addMessage('lucy', 'حدث خطأ غير متوقع. حاول مرة أخرى.');
      setState('error');
      setTimeout(() => setState('idle'), 1500);
    }
  }

  function populateVoiceSelect() {
    const sel = dom.voiceSelect;
    if (!sel) return;
    sel.innerHTML = '';
    const voices = window.LucyVoice.voices || [];
    if (!voices.length) {
      const opt = document.createElement('option');
      opt.textContent = 'No voices available';
      sel.appendChild(opt);
      return;
    }
    // Arabic first, then female, then everything else
    const sorted = voices.slice().sort((a, b) => {
      const aAr = /^ar/i.test(a.lang), bAr = /^ar/i.test(b.lang);
      if (aAr !== bAr) return aAr ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const v of sorted) {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (window.LucyVoice.selectedVoice && v.name === window.LucyVoice.selectedVoice.name) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
  }

  function wireSettings() {
    dom.settingsBtn.addEventListener('click', () => {
      dom.geminiKey.value = window.LucyAI.getKey() || '';
      if (dom.claudeKey)     dom.claudeKey.value = window.LucyAI.getClaudeKey() || '';
      if (dom.engineSelect)  dom.engineSelect.value = window.LucyAI.getEngine() || 'auto';
      populateVoiceSelect();
      dom.autoSpeak.checked = autoSpeak;
      openModal('settingsModal');
    });

    dom.aboutBtn.addEventListener('click', () => openModal('aboutModal'));

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.add('hidden');
      });
    });

    dom.saveSettings.addEventListener('click', () => {
      const geminiKey = (dom.geminiKey.value || '').trim();
      const claudeKey = dom.claudeKey ? (dom.claudeKey.value || '').trim() : '';
      const engine    = dom.engineSelect ? dom.engineSelect.value : 'auto';

      window.LucyAI.setKey(geminiKey);
      window.LucyAI.setClaudeKey(claudeKey);
      window.LucyAI.setEngine(engine);

      const voiceName = dom.voiceSelect.value;
      if (voiceName) window.LucyVoice.setVoiceByName(voiceName);
      autoSpeak = dom.autoSpeak.checked;
      try { localStorage.setItem('lucy.autoSpeak', autoSpeak ? '1' : '0'); } catch {}
      window.LucyVoice.setContinuous(dom.continuousListen.checked);
      try { localStorage.setItem('lucy.continuous', dom.continuousListen.checked ? '1' : '0'); } catch {}
      closeModal('settingsModal');

      const engineLabel = (() => {
        if (engine === 'claude') return claudeKey ? 'Claude AI' : 'Local Knowledge (مفتاح Claude ناقص)';
        if (engine === 'gemini') return geminiKey ? 'Gemini AI' : 'Local Knowledge (مفتاح Gemini ناقص)';
        if (engine === 'local')  return 'Local Knowledge';
        // auto
        if (claudeKey) return 'Auto (Claude مفضَّل)';
        if (geminiKey) return 'Auto (Gemini)';
        return 'Local Knowledge';
      })();
      addMessage('lucy', `تم حفظ الإعدادات ✓ — المحرك الحالي: **${engineLabel}**`);
    });
  }

  function restorePrefs() {
    try {
      autoSpeak = (localStorage.getItem('lucy.autoSpeak') ?? '1') === '1';
      const cont = localStorage.getItem('lucy.continuous') === '1';
      window.LucyVoice.setContinuous(cont);
      if (dom.continuousListen) dom.continuousListen.checked = cont;
      if (dom.autoSpeak) dom.autoSpeak.checked = autoSpeak;
    } catch {}
  }

  function wireInput() {
    dom.sendBtn.addEventListener('click', () => handleQuestion(dom.textInput.value));
    dom.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleQuestion(dom.textInput.value);
    });

    dom.micBtn.addEventListener('click', () => {
      if (window.LucyVoice.isListening) {
        window.LucyVoice.stop();
        dom.micBtn.classList.remove('listening');
        setState('idle');
      } else {
        const ok = window.LucyVoice.start();
        if (ok) {
          dom.micBtn.classList.add('listening');
          setState('listening');
        }
      }
    });

    document.querySelectorAll('.sug').forEach(btn => {
      btn.addEventListener('click', () => {
        handleQuestion(btn.dataset.q || btn.textContent);
      });
    });
  }

  async function initApp() {
    dom.conversation = $('#conversation');
    dom.textInput = $('#textInput');
    dom.sendBtn = $('#sendBtn');
    dom.micBtn = $('#micBtn');
    dom.settingsBtn = $('#settingsBtn');
    dom.aboutBtn = $('#aboutBtn');
    dom.geminiKey = $('#geminiKey');
    dom.claudeKey = $('#claudeKey');
    dom.engineSelect = $('#engineSelect');
    dom.voiceSelect = $('#voiceSelect');
    dom.autoSpeak = $('#autoSpeak');
    dom.continuousListen = $('#continuousListen');
    dom.saveSettings = $('#saveSettings');

    // Neural canvas
    const canvas = $('#neuralCanvas');
    neural = new window.LucyNeural.Renderer(canvas);

    // Voice
    await window.LucyVoice.init({
      onResult: (t) => {
        dom.micBtn.classList.remove('listening');
        handleQuestion(t);
      },
      onState: (s) => {
        if (!window.LucyVoice.isSpeaking) setState(s);
      },
      onError: (e) => {
        dom.micBtn.classList.remove('listening');
        setState('error');
        setTimeout(() => setState('idle'), 1500);
        if (e === 'not-allowed' || e === 'service-not-allowed') {
          addMessage('lucy', 'لم أتمكن من الوصول إلى المايكروفون. افتح الصفحة عبر `https://` أو `localhost` ومنحها إذن الميكروفون. يمكنك الكتابة بدلاً من ذلك.');
        } else if (e === 'not-supported') {
          addMessage('lucy', 'متصفحك لا يدعم التعرف على الصوت. استخدم Chrome أو Edge، أو اكتب سؤالك.');
        } else if (e !== 'no-speech' && e !== 'aborted') {
          console.warn('Voice error:', e);
        }
      }
    });

    restorePrefs();
    wireSettings();
    wireInput();
    setState('idle');

    // Initial greeting (spoken) after entering
    if (autoSpeak) {
      setTimeout(() => {
        window.LucyVoice.speak('مرحباً بك، أنا لوسي. كيف يمكنني مساعدتك اليوم؟');
      }, 600);
    }
  }

  document.addEventListener('lucy:entered', initApp);
})();
