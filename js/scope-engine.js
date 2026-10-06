/**
 * VoltBridge - High-Performance Canvas 2D Scope & Spectrum Analyzer
 * Supports Superimposed waveforms, Split Channels, and FFT Harmonics bar chart.
 * Fully theme-adaptive (seamless Dark Mode and Light Mode switching).
 */

(function(root) {
  'use strict';

  const ScopeEngine = {};

  let canvas = null;
  let ctx = null;
  let currentMode = 'fft'; // 'superimposed', 'channels', 'fft'

  ScopeEngine.init = function(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  };

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    if (ctx) ctx.scale(dpr, dpr);
  }

  ScopeEngine.setMode = function(mode) {
    currentMode = mode;
  };

  ScopeEngine.getMode = function() {
    return currentMode;
  };

  /**
   * Theme configuration palette
   */
  function getTheme() {
    const isLight = document.body.classList.contains('light-theme');
    if (isLight) {
      return {
        isLight: true,
        bg: '#f8fafc',
        grid: '#e2e8f0',
        zeroLine: '#94a3b8',
        textMuted: '#64748b',
        textMain: '#0f172a',
        cursor: '#0284c7',
        cursorDot: '#0284c7',
        channelBg: '#ffffff',
        channelBorder: '#cbd5e1',
        channelCenter: '#cbd5e1',
        vs: '#0284c7',
        vo: '#059669',
        voGlow: 'rgba(5, 150, 105, 0.2)',
        io: '#d97706',
        is: '#e11d48',
        vt1: '#7c3aed',
        gatePulse: 'rgba(2, 132, 199, 0.45)',
        fftBarStart: '#10b981',
        fftBarEnd: '#047857',
        fftBarBorder: '#059669',
        fftPctText: '#0f172a',
        fftOrderFund: '#047857',
        fftOrderHarm: '#64748b'
      };
    } else {
      return {
        isLight: false,
        bg: '#060912',
        grid: '#141e33',
        zeroLine: '#22385c',
        textMuted: '#546887',
        textMain: '#cbd5e1',
        cursor: '#00d2ff',
        cursorDot: '#00d2ff',
        channelBg: '#080d19',
        channelBorder: '#18243e',
        channelCenter: '#22345a',
        vs: '#00d2ff',
        vo: '#05df72',
        voGlow: 'rgba(5, 223, 114, 0.5)',
        io: '#ffaa00',
        is: '#ff4071',
        vt1: '#b366ff',
        gatePulse: 'rgba(0, 210, 255, 0.7)',
        fftBarStart: '#05df72',
        fftBarEnd: '#085734',
        fftBarBorder: '#05df72',
        fftPctText: '#cbd5e1',
        fftOrderFund: '#05df72',
        fftOrderHarm: '#889bb8'
      };
    }
  }

  /**
   * Main render call
   */
  ScopeEngine.render = function(data, wtDeg, fftData) {
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const theme = getTheme();

    // Fill background completely based on active theme
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    if (currentMode === 'fft') {
      renderFFTMode(width, height, fftData, theme);
    } else if (currentMode === 'channels') {
      renderChannelsMode(width, height, data, wtDeg, theme);
    } else {
      renderSuperimposedMode(width, height, data, wtDeg, theme);
    }
  };

  // --------------------------------------------------------------------------
  // 1. SUPERIMPOSED MODE (Single Screen Overlay)
  // --------------------------------------------------------------------------
  function renderSuperimposedMode(w, h, data, wtDeg, theme) {
    const pad = { top: 25, bottom: 30, left: 50, right: 30 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;
    const zeroY = pad.top + ph / 2;

    // Background & Oscilloscope Grid for 1 full cycle (360 deg)
    drawGrid(pad.left, pad.top, pw, ph, zeroY, 1, theme);

    // Voltage scale
    const maxV = 450;
    const maxI = 25;
    const scaleV = (ph * 0.44) / maxV;
    const scaleI = (ph * 0.44) / maxI;

    const N = 360; // 1 full AC cycle

    // 1. AC Source Voltage vs (Cyan / Blue dashed)
    ctx.strokeStyle = theme.vs;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    drawWaveform(data.vs, N, pad.left, pw, zeroY, scaleV);
    ctx.setLineDash([]);

    // 2. Thyristor / Diode Voltage vt1 (Purple / Violet line)
    ctx.strokeStyle = theme.vt1;
    ctx.lineWidth = 1.3;
    drawWaveform(data.vt1, N, pad.left, pw, zeroY, scaleV);

    // 3. Source AC Current is (Rose / Magenta line)
    ctx.strokeStyle = theme.is;
    ctx.lineWidth = 1.4;
    drawWaveform(data.is, N, pad.left, pw, zeroY, scaleI);

    // 4. Output DC Voltage vo (Emerald thick glow)
    ctx.shadowColor = theme.voGlow;
    ctx.shadowBlur = theme.isLight ? 4 : 8;
    ctx.strokeStyle = theme.vo;
    ctx.lineWidth = 2.4;
    drawWaveform(data.vo, N, pad.left, pw, zeroY, scaleV);
    ctx.shadowBlur = 0;

    // 5. Output DC Current io (Amber solid)
    ctx.strokeStyle = theme.io;
    ctx.lineWidth = 2.0;
    drawWaveform(data.io, N, pad.left, pw, zeroY, scaleI);

    // Vertical Scrubber Line at wtDeg (0..360)
    const cursorFrac = (wtDeg % 360) / 360;
    const cursorX = pad.left + cursorFrac * pw;

    ctx.strokeStyle = theme.cursor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cursorX, pad.top);
    ctx.lineTo(cursorX, pad.top + ph);
    ctx.stroke();

    // Cursor Head Dot
    ctx.fillStyle = theme.cursorDot;
    ctx.beginPath();
    ctx.arc(cursorX, pad.top + 4, 4, 0, Math.PI * 2);
    ctx.fill();

    // Overlay Legends
    drawLegend(pad.left + 10, pad.top - 12, theme);
  }

  // --------------------------------------------------------------------------
  // 2. OSCILLOSCOPE CHANNELS (Split Stacked Traces)
  // --------------------------------------------------------------------------
  function renderChannelsMode(w, h, data, wtDeg, theme) {
    const pad = { top: 20, bottom: 25, left: 50, right: 30 };
    const numChannels = 3;
    const channelH = (h - pad.top - pad.bottom) / numChannels;
    const pw = w - pad.left - pad.right;
    const N = 360; // 1 full AC cycle

    const titles = [
      'CH1: AC Source Voltage (Vs)',
      'CH2: Output DC Voltage (Vo) & Load Current (Io)',
      'CH3: Switch Voltage (Vt1) & Gate Pulse'
    ];

    for (let c = 0; c < numChannels; c++) {
      const topY = pad.top + c * channelH;
      const zeroY = topY + channelH / 2;
      const subH = channelH - 8;

      // Channel border & grid
      ctx.fillStyle = theme.channelBg;
      ctx.fillRect(pad.left, topY, pw, channelH - 4);
      ctx.strokeStyle = theme.channelBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(pad.left, topY, pw, channelH - 4);

      // Centerline
      ctx.strokeStyle = theme.channelCenter;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY - 2);
      ctx.lineTo(pad.left + pw, zeroY - 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.font = '600 10px monospace';
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(titles[c], pad.left + 8, topY + 12);

      const scaleV = (subH * 0.42) / 450;
      const scaleI = (subH * 0.42) / 25;

      if (c === 0) {
        // Source voltages
        ctx.strokeStyle = theme.vs;
        ctx.lineWidth = 1.8;
        drawWaveform(data.vs, N, pad.left, pw, zeroY - 2, scaleV);
      } else if (c === 1) {
        // Output voltage & Current
        ctx.strokeStyle = theme.vo;
        ctx.lineWidth = 2.0;
        drawWaveform(data.vo, N, pad.left, pw, zeroY - 2, scaleV);

        ctx.strokeStyle = theme.io;
        ctx.lineWidth = 1.8;
        drawWaveform(data.io, N, pad.left, pw, zeroY - 2, scaleI);
      } else if (c === 2) {
        // Switch voltage & Gate pulses
        ctx.strokeStyle = theme.vt1;
        ctx.lineWidth = 1.6;
        drawWaveform(data.vt1, N, pad.left, pw, zeroY - 2, scaleV);

        // Gate pulses (digital pulse bars)
        ctx.fillStyle = theme.gatePulse;
        for (let i = 0; i < N; i++) {
          if (data.gatePulses[i]) {
            const px = pad.left + (i / N) * pw;
            ctx.fillRect(px - 1, topY + 8, 3, subH - 12);
          }
        }
      }

      // Channel Scrubber Cursor
      const cursorX = pad.left + ((wtDeg % 360) / 360) * pw;
      ctx.strokeStyle = theme.cursor;
      ctx.beginPath();
      ctx.moveTo(cursorX, topY);
      ctx.lineTo(cursorX, topY + channelH - 4);
      ctx.stroke();
    }
  }

  // --------------------------------------------------------------------------
  // 3. FFT HARMONICS MODE (Exact match to screenshot)
  // --------------------------------------------------------------------------
  function renderFFTMode(w, h, fftData, theme) {
    if (!fftData || !fftData.harmonics) return;

    const pad = { top: 40, bottom: 45, left: 60, right: 40 };
    const pw = w - pad.left - pad.right;
    const ph = h - pad.top - pad.bottom;

    // Header Title matching screenshot
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = theme.textMain;
    ctx.fillText('Harmonic Spectrum of AC Source Current i_s (FFT Decomposition)', pad.left, 24);

    ctx.font = '500 10px monospace';
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText('[% of Fundamental]', w - pad.right, 24);
    ctx.textAlign = 'left';

    // Grid lines for percentages (0%, 25%, 50%, 75%, 100%)
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = theme.textMuted;

    for (let p = 0; p <= 100; p += 25) {
      const y = pad.top + ph - (p / 100) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + pw, y);
      ctx.stroke();
      ctx.fillText(`${p}%`, pad.left - 35, y + 3);
    }

    // Filter odd harmonics matching screenshot: h=1, 3, 5, 7, 9, 11, 13, 15
    const oddHarmonics = fftData.harmonics.filter(h => h.order % 2 !== 0 && h.order <= 15);
    const numBars = oddHarmonics.length;
    const barSlotWidth = pw / numBars;
    const barWidth = Math.min(38, barSlotWidth * 0.45);

    oddHarmonics.forEach((hObj, idx) => {
      const x = pad.left + idx * barSlotWidth + (barSlotWidth - barWidth) / 2;
      const barHeight = Math.min(ph, (hObj.percent / 100) * ph);
      const y = pad.top + ph - barHeight;

      // Bar fill (Emerald neon with gradient)
      const grad = ctx.createLinearGradient(0, y, 0, pad.top + ph);
      grad.addColorStop(0, theme.fftBarStart);
      grad.addColorStop(1, theme.fftBarEnd);

      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Bar border & glow
      ctx.strokeStyle = theme.fftBarBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);

      // Percentage label on top of bar
      ctx.font = '700 9px monospace';
      ctx.fillStyle = theme.fftPctText;
      ctx.textAlign = 'center';
      const pctText = `${hObj.percent.toFixed(1)}%`;
      ctx.fillText(pctText, x + barWidth / 2, Math.max(pad.top + 12, y - 6));

      // X-Axis Harmonic Order Label (h=1, h=3, ...)
      ctx.fillStyle = hObj.order === 1 ? theme.fftOrderFund : theme.fftOrderHarm;
      ctx.font = '700 10px monospace';
      ctx.fillText(`h=${hObj.order}`, x + barWidth / 2, pad.top + ph + 18);
    });

    ctx.textAlign = 'left';
  }

  // --------------------------------------------------------------------------
  // HELPER DRAWING METHODS
  // --------------------------------------------------------------------------
  function drawGrid(x, y, w, h, zeroY, cycles, theme) {
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;

    // Horizontal grid lines
    const hDivs = 8;
    for (let i = 0; i <= hDivs; i++) {
      const gy = y + (i / hDivs) * h;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    // Vertical grid lines (every 90 degrees)
    const totalDeg = cycles * 360;
    const vSteps = cycles * 4; // every 90 deg
    ctx.font = '10px monospace';
    ctx.fillStyle = theme.textMuted;

    for (let j = 0; j <= vSteps; j++) {
      const gx = x + (j / vSteps) * w;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();

      const degVal = j * 90;
      ctx.fillText(`${degVal}°`, gx - 10, y + h + 15);
    }

    // Center Zero Line (Thicker)
    ctx.strokeStyle = theme.zeroLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, zeroY);
    ctx.lineTo(x + w, zeroY);
    ctx.stroke();

    // Voltage Zero indicator
    ctx.fillStyle = theme.textMuted;
    ctx.fillText('0 V', x - 28, zeroY + 3);
  }

  function drawWaveform(arr, N, x0, w, y0, scale) {
    if (!arr || arr.length === 0) return;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const px = x0 + (i / (N - 1)) * w;
      const py = y0 - arr[i] * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawLegend(x, y, theme) {
    const items = [
      { label: 'Vs (Source)', color: theme.vs, dashed: true },
      { label: 'Vo (Output)', color: theme.vo, width: 2.5 },
      { label: 'Io (Load Cur)', color: theme.io },
      { label: 'Is (Source Cur)', color: theme.is },
      { label: 'Vt1 (Switch)', color: theme.vt1 }
    ];

    ctx.font = '600 10px Inter, system-ui, sans-serif';
    let curX = x;

    items.forEach(it => {
      ctx.strokeStyle = it.color;
      ctx.lineWidth = it.width || 1.8;
      if (it.dashed) ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);

      ctx.beginPath();
      ctx.moveTo(curX, y - 3);
      ctx.lineTo(curX + 16, y - 3);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = theme.textMain;
      ctx.fillText(it.label, curX + 22, y);

      curX += ctx.measureText(it.label).width + 36;
    });
  }

  root.RectifierScopeEngine = ScopeEngine;

})(typeof window !== 'undefined' ? window : this);
