/* ==========================================================================
   Splash / Intro screen controller
   - Populates team cards from university.json
   - Runs a boot progress animation
   - Transitions to main app
   ========================================================================== */

(function () {
  'use strict';

  const BOOT_STEPS = [
    'INITIALIZING NEURAL CORE…',
    'LOADING KNOWLEDGE GRAPH…',
    'CONNECTING TO AL-ESRAA DATABASE…',
    'CALIBRATING VOICE ENGINE…',
    'SYNCING SECTION A3 ROSTER…',
    'LUCY IS READY'
  ];

  function populateTeam() {
    const team = window.LucyKnowledge.getTeam();
    if (!team || !team.length) return;
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    grid.innerHTML = team.map(m => `
      <article class="team-card">
        <div class="team-photo" style="background-image: url('assets/images/${m.image}');"></div>
        <p class="team-name-ar">${m.name_ar}</p>
        <p class="team-name-en">${m.name_en}</p>
        <p class="team-role">${m.role_en}</p>
      </article>
    `).join('');
  }

  function runBootSequence() {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    const enterBtn = document.getElementById('enterBtn');

    let step = 0;
    const totalDuration = 3600; // ms
    const stepInterval = totalDuration / BOOT_STEPS.length;

    function tick() {
      step++;
      if (step > BOOT_STEPS.length) {
        enterBtn.classList.remove('hidden');
        text.textContent = BOOT_STEPS[BOOT_STEPS.length - 1];
        fill.style.width = '100%';
        return;
      }
      const pct = (step / BOOT_STEPS.length) * 100;
      fill.style.width = `${pct}%`;
      text.textContent = BOOT_STEPS[step - 1];
      setTimeout(tick, stepInterval);
    }
    tick();
  }

  function enterApp() {
    const splash = document.getElementById('splash');
    const app = document.getElementById('app');
    if (!splash || !app) return;

    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.classList.remove('active');
      splash.classList.add('hidden');
      app.classList.remove('hidden');
      document.dispatchEvent(new CustomEvent('lucy:entered'));
    }, 800);
  }

  async function boot() {
    try {
      await window.LucyKnowledge.load();
    } catch (err) {
      console.error('Knowledge load failed:', err);
    }
    populateTeam();
    runBootSequence();

    const enterBtn = document.getElementById('enterBtn');
    enterBtn.addEventListener('click', enterApp);

    // Keyboard shortcut: Enter or Space once progress completes
    document.addEventListener('keydown', (e) => {
      const splash = document.getElementById('splash');
      if (!splash.classList.contains('active') || splash.classList.contains('hidden')) return;
      if (enterBtn.classList.contains('hidden')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enterApp();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
