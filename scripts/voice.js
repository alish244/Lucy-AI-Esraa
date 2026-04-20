/* ==========================================================================
   Voice Engine
   - Web Speech API for recognition (ar-SA / ar-IQ)
   - SpeechSynthesis API for female Arabic TTS (Lucy-like)
   ========================================================================== */

(function () {
  'use strict';

  const state = {
    recognition: null,
    isListening: false,
    isSpeaking: false,
    voices: [],
    selectedVoice: null,
    onResult: null,
    onState: null,
    onError: null,
    continuous: false,
    wantsContinue: false
  };

  function initRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      state.isListening = true;
      state.onState && state.onState('listening');
    };
    rec.onerror = (e) => {
      state.isListening = false;
      state.onState && state.onState('idle');
      state.onError && state.onError(e.error || 'unknown');
    };
    rec.onend = () => {
      state.isListening = false;
      state.onState && state.onState('idle');
      if (state.wantsContinue && state.continuous) {
        // Restart after a short delay for continuous mode
        setTimeout(() => { try { rec.start(); } catch (_) {} }, 300);
      }
    };
    rec.onresult = (ev) => {
      const transcript = Array.from(ev.results)
        .map(r => r[0].transcript)
        .join(' ')
        .trim();
      if (transcript && state.onResult) state.onResult(transcript);
    };

    return rec;
  }

  function pickFemaleArabicVoice(voices) {
    // Preference order for Arabic female-sounding voices.
    const arabicVoices = voices.filter(v => (v.lang || '').toLowerCase().startsWith('ar'));
    if (arabicVoices.length === 0) {
      // Fallback: any "female" voice
      const fem = voices.find(v => /female|zira|hoda|naayf|salma|zariyah/i.test(v.name));
      return fem || voices[0] || null;
    }
    const preferences = [
      /hoda/i, /salma/i, /zariyah/i, /laila/i, /female/i, /naayf/i
    ];
    for (const re of preferences) {
      const hit = arabicVoices.find(v => re.test(v.name));
      if (hit) return hit;
    }
    return arabicVoices[0];
  }

  function loadVoices() {
    return new Promise(resolve => {
      const synth = window.speechSynthesis;
      if (!synth) { resolve([]); return; }
      let v = synth.getVoices();
      if (v && v.length) { resolve(v); return; }
      synth.onvoiceschanged = () => resolve(synth.getVoices());
      // Safety timeout
      setTimeout(() => resolve(synth.getVoices() || []), 1500);
    });
  }

  async function init(opts = {}) {
    state.onResult = opts.onResult || null;
    state.onState = opts.onState || null;
    state.onError = opts.onError || null;
    state.recognition = initRecognition();
    state.voices = await loadVoices();
    state.selectedVoice = pickFemaleArabicVoice(state.voices);
    return {
      recognitionAvailable: !!state.recognition,
      ttsAvailable: 'speechSynthesis' in window,
      voices: state.voices,
      selectedVoice: state.selectedVoice
    };
  }

  function setVoiceByName(name) {
    const v = state.voices.find(v => v.name === name);
    if (v) state.selectedVoice = v;
    return state.selectedVoice;
  }

  function setContinuous(on) {
    state.continuous = !!on;
  }

  function start() {
    if (!state.recognition) {
      state.onError && state.onError('not-supported');
      return false;
    }
    if (state.isListening) return true;
    try {
      state.wantsContinue = true;
      state.recognition.start();
      return true;
    } catch (e) {
      state.onError && state.onError(e.message || 'start-failed');
      return false;
    }
  }

  function stop() {
    state.wantsContinue = false;
    try { state.recognition && state.recognition.stop(); } catch (_) {}
  }

  function toggle() {
    return state.isListening ? (stop(), false) : start();
  }

  function speak(text, opts = {}) {
    if (!('speechSynthesis' in window)) return;
    if (!text) return;
    // Strip markdown before speaking
    const clean = String(text)
      .replace(/[*_`#>]/g, '')
      .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();

    // Cancel any in-flight utterance so Lucy doesn't talk over herself.
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(clean);
    u.lang = opts.lang || 'ar-SA';
    u.rate = opts.rate || 0.98;
    u.pitch = opts.pitch || 1.05;
    u.volume = opts.volume || 1.0;
    if (state.selectedVoice) u.voice = state.selectedVoice;

    u.onstart = () => {
      state.isSpeaking = true;
      state.onState && state.onState('speaking');
    };
    u.onend = () => {
      state.isSpeaking = false;
      state.onState && state.onState('idle');
    };
    u.onerror = () => {
      state.isSpeaking = false;
      state.onState && state.onState('idle');
    };

    window.speechSynthesis.speak(u);
  }

  function cancelSpeech() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
    state.isSpeaking = false;
  }

  window.LucyVoice = {
    init,
    start, stop, toggle,
    speak, cancelSpeech,
    setVoiceByName,
    setContinuous,
    get voices() { return state.voices; },
    get selectedVoice() { return state.selectedVoice; },
    get isListening() { return state.isListening; },
    get isSpeaking() { return state.isSpeaking; }
  };
})();
