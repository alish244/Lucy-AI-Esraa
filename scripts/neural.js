/* ==========================================================================
   Neural Canvas Visualization
   A pulsing, breathing circular neural network.
   States: idle | listening | thinking | speaking | error
   ========================================================================== */

(function () {
  'use strict';

  const PALETTE = {
    idle:      { ring: '#00e5ff', node: '#7c4dff', edge: 'rgba(0,229,255,0.35)', pulse: '#00e5ff' },
    listening: { ring: '#ff2d92', node: '#ff6bb5', edge: 'rgba(255,45,146,0.45)', pulse: '#ff2d92' },
    thinking:  { ring: '#7c4dff', node: '#00e5ff', edge: 'rgba(124,77,255,0.55)', pulse: '#7c4dff' },
    speaking:  { ring: '#36ffb0', node: '#00e5ff', edge: 'rgba(54,255,176,0.55)', pulse: '#36ffb0' },
    error:     { ring: '#ff3b5c', node: '#ff8fa2', edge: 'rgba(255,59,92,0.45)', pulse: '#ff3b5c' }
  };

  class NeuralRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.max(1, window.devicePixelRatio || 1);
      this.state = 'idle';
      this.frame = 0;
      this.pulses = [];
      this.nodes = [];
      this.rings = [
        { count: 10, radius: 0.38, speed: 0.0005, phase: 0 },
        { count: 16, radius: 0.60, speed: -0.0003, phase: 0.5 },
        { count: 24, radius: 0.82, speed: 0.0002, phase: 1.0 }
      ];
      this.resize();
      this.buildNodes();
      window.addEventListener('resize', () => { this.resize(); this.buildNodes(); });
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height);
      this.canvas.width = size * this.dpr;
      this.canvas.height = size * this.dpr;
      this.size = size;
    }

    buildNodes() {
      this.nodes = [];
      const cx = this.size / 2, cy = this.size / 2;
      this.rings.forEach((ring, ri) => {
        for (let i = 0; i < ring.count; i++) {
          const angle = (i / ring.count) * Math.PI * 2;
          this.nodes.push({
            ring: ri, ringRef: ring,
            baseAngle: angle,
            x: cx, y: cy,
            size: 2 + Math.random() * 2.2,
            energy: Math.random(),
            twinkleSpeed: 0.5 + Math.random() * 1.2
          });
        }
      });
    }

    setState(next) {
      if (!PALETTE[next]) return;
      if (next === this.state) return;
      this.state = next;
      // Burst a few pulses on state change
      for (let i = 0; i < 3; i++) this.emitPulse();
    }

    emitPulse() {
      if (this.nodes.length === 0) return;
      const n = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      this.pulses.push({ fromIdx: this.nodes.indexOf(n), t: 0, life: 60 + Math.random() * 40 });
      if (this.pulses.length > 40) this.pulses.shift();
    }

    loop() {
      this.frame++;
      const ctx = this.ctx;
      const s = this.size * this.dpr;
      const cx = s / 2, cy = s / 2;
      const palette = PALETTE[this.state];

      ctx.clearRect(0, 0, s, s);

      // Animate ring phases
      this.rings.forEach(r => { r.phase += r.speed * (this.state === 'thinking' ? 3 : this.state === 'listening' ? 2 : 1); });

      // Update node positions
      this.nodes.forEach(n => {
        const ring = n.ringRef;
        const radius = (ring.radius * s) / 2;
        const a = n.baseAngle + ring.phase;
        n.x = cx + Math.cos(a) * radius;
        n.y = cy + Math.sin(a) * radius;
        n.energy += 0.01 * n.twinkleSpeed * (this.state === 'speaking' ? 3 : 1);
      });

      // Draw ring guide arcs
      this.rings.forEach((r, i) => {
        const radius = (r.radius * s) / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = palette.edge;
        ctx.lineWidth = 1 * this.dpr;
        ctx.setLineDash([4 * this.dpr, 10 * this.dpr]);
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(this.frame * 0.02 + i);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      });

      // Draw connections between adjacent nodes on same ring and to inner/outer nearest
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = 0.6 * this.dpr;
      for (let i = 0; i < this.nodes.length; i++) {
        const a = this.nodes[i];
        for (let j = i + 1; j < this.nodes.length; j++) {
          const b = this.nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          const threshold = s * 0.18;
          if (dist < threshold) {
            const alpha = (1 - dist / threshold) * 0.35;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;

      // Draw nodes
      this.nodes.forEach(n => {
        const glow = 0.5 + 0.5 * Math.sin(n.energy);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size * this.dpr * (0.8 + 0.5 * glow), 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.size * 4 * this.dpr);
        grad.addColorStop(0, palette.node);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fill();
      });

      // Central core ring
      const coreRadius = s * 0.18;
      const coreGlow = 1 + Math.sin(this.frame * 0.03) * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * coreGlow, 0, Math.PI * 2);
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 1.6);
      coreGrad.addColorStop(0, palette.ring);
      coreGrad.addColorStop(0.6, 'rgba(0,0,0,0)');
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.globalAlpha = 0.45;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Draw pulses traveling outward
      for (let k = this.pulses.length - 1; k >= 0; k--) {
        const p = this.pulses[k];
        p.t++;
        if (p.t > p.life) { this.pulses.splice(k, 1); continue; }
        const fromNode = this.nodes[p.fromIdx];
        if (!fromNode) { this.pulses.splice(k, 1); continue; }
        const progress = p.t / p.life;
        const dx = fromNode.x - cx, dy = fromNode.y - cy;
        const px = cx + dx * progress;
        const py = cy + dy * progress;
        ctx.beginPath();
        ctx.arc(px, py, 3 * this.dpr, 0, Math.PI * 2);
        ctx.fillStyle = palette.pulse;
        ctx.globalAlpha = 1 - progress;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Occasionally emit pulses
      const emitChance =
        this.state === 'thinking' ? 0.4 :
        this.state === 'speaking' ? 0.6 :
        this.state === 'listening' ? 0.3 : 0.1;
      if (Math.random() < emitChance * 0.2) this.emitPulse();

      requestAnimationFrame(this.loop);
    }
  }

  // Expose globally
  window.LucyNeural = { Renderer: NeuralRenderer };
})();
