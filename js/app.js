/**
 * RectifierLab - Master Application Controller
 * Handles simulation state, DOM bindings, real-time animation clock, and UI interactions.
 */

(function() {
  'use strict';

  // Application State
  const state = {
    topology: '1p_full',       // '1p_full', '1p_half', '3p_half', '3p_full'
    deviceType: 'thyristor',    // 'diode', 'thyristor', 'semi'
    alphaDeg: 45,              // Firing angle 0..180
    hasFWD: false,             // Freewheeling diode toggle
    loadType: 'RL',            // 'R', 'RL', 'RLE'
    R: 20,                     // Ohms
    L_mH: 45,                  // mH
    E_emf: 24,                 // Volts
    Vs_rms: 230,               // Volts
    freq: 50,                  // Hz
    wtDeg: 248.5,              // Initial angle matching user screenshot!
    isPlaying: false,          // Playback running
    speed: 1.0,                // Speed multiplier
    scopeMode: 'fft',          // 'superimposed', 'channels', 'fft' (matches screenshot initially)
    isLightMode: false
  };

  let lastTimestamp = 0;
  let cachedSimulation = null;
  let cachedFFT = null;

  // DOM Element References
  const dom = {};

  function cacheDOMElements() {
    dom.body = document.body;
    dom.schematicContainer = document.getElementById('schematicContainer');
    dom.canvas = document.getElementById('oscilloscopeCanvas');
    dom.schematicBadge = document.getElementById('schematicBadge');
    dom.loopStatusText = document.getElementById('loopStatusText');
    
    // Playback
    dom.btnPlay = document.getElementById('btnPlay');
    dom.btnPlayText = document.getElementById('btnPlayText');
    dom.btnStepBack = document.getElementById('btnStepBack');
    dom.btnStepForward = document.getElementById('btnStepForward');
    dom.btnReset = document.getElementById('btnReset');
    dom.speedSlider = document.getElementById('speedSlider');
    dom.speedPresetBtns = document.querySelectorAll('.btn-speed');

    // Scrubber
    dom.wtSlider = document.getElementById('wtSlider');
    dom.wtValue = document.getElementById('wtValue');

    // Topology Controls
    dom.btnPhase1 = document.getElementById('btnPhase1');
    dom.btnPhase3 = document.getElementById('btnPhase3');
    dom.btnBridgeFull = document.getElementById('btnBridgeFull');
    dom.btnBridgeHalf = document.getElementById('btnBridgeHalf');
    dom.btnDeviceDiodes = document.getElementById('btnDeviceDiodes');
    dom.btnDeviceThyristors = document.getElementById('btnDeviceThyristors');
    dom.btnDeviceSemi = document.getElementById('btnDeviceSemi');

    // Firing Angle & FWD
    dom.alphaSlider = document.getElementById('alphaSlider');
    dom.alphaValue = document.getElementById('alphaValue');
    dom.alphaPresetBtns = document.querySelectorAll('.btn-alpha-preset');
    dom.btnToggleFWD = document.getElementById('btnToggleFWD');
    dom.fwdStatusText = document.getElementById('fwdStatusText');

    // Load Controls
    dom.btnLoadR = document.getElementById('btnLoadR');
    dom.btnLoadRL = document.getElementById('btnLoadRL');
    dom.btnLoadRLE = document.getElementById('btnLoadRLE');
    dom.sliderR = document.getElementById('sliderR');
    dom.valueR = document.getElementById('valueR');
    dom.sliderL = document.getElementById('sliderL');
    dom.valueL = document.getElementById('valueL');
    dom.sliderVs = document.getElementById('sliderVs');
    dom.valueVs = document.getElementById('valueVs');
    dom.sliderE = document.getElementById('sliderE');
    dom.valueE = document.getElementById('valueE');
    dom.groupSliderE = document.getElementById('groupSliderE');

    // Scope Tabs
    dom.scopeTabBtns = document.querySelectorAll('.scope-tab-btn');

    // KPI Badges
    dom.kpiVdc = document.getElementById('kpiVdc');
    dom.kpiVrms = document.getElementById('kpiVrms');
    dom.kpiIdc = document.getElementById('kpiIdc');
    dom.kpiIrms = document.getElementById('kpiIrms');
    dom.kpiPload = document.getElementById('kpiPload');
    dom.kpiSin = document.getElementById('kpiSin');
    dom.kpiPF = document.getElementById('kpiPF');
    dom.kpiCosPhi1 = document.getElementById('kpiCosPhi1');
    dom.kpiRF = document.getElementById('kpiRF');
    dom.kpiFF = document.getElementById('kpiFF');
    dom.kpiTHD = document.getElementById('kpiTHD');
    dom.kpiConductionMode = document.getElementById('kpiConductionMode');

    // Theory & Derivations
    dom.theoryHeadline = document.getElementById('theoryHeadline');
    dom.theoryDesc = document.getElementById('theoryDesc');
    dom.theoryFormulaMath = document.getElementById('theoryFormulaMath');
    dom.idealVdcValue = document.getElementById('idealVdcValue');

    // Header buttons
    dom.btnThemeToggle = document.getElementById('btnThemeToggle');
    dom.btnFullscreenStudio = document.getElementById('btnFullscreenStudio');
    dom.btnOpenTheory = document.getElementById('btnOpenTheory');
    dom.btnOpenDerivations = document.getElementById('btnOpenDerivations');
    dom.btnOpenPresets = document.getElementById('btnOpenPresets');

    // Modals
    dom.theoryModal = document.getElementById('theoryModal');
    dom.presetsModal = document.getElementById('presetsModal');
    dom.closeModalBtns = document.querySelectorAll('.btn-close-modal');
  }

  // Application Initialization
  function init() {
    cacheDOMElements();

    // Initialize Engines
    RectifierSchematicEngine.init('schematicContainer');
    RectifierScopeEngine.init('oscilloscopeCanvas');
    RectifierScopeEngine.setMode(state.scopeMode);

    bindEvents();
    recalculateFullSimulation();
    updateUI();

    // Start Animation Loop
    requestAnimationFrame(animationLoop);
  }

  // Recalculates full cycle waveforms and FFT
  function recalculateFullSimulation() {
    cachedSimulation = RectifierMathEngine.simulate({
      topology: state.topology,
      deviceType: state.deviceType,
      alphaDeg: state.alphaDeg,
      hasFWD: state.hasFWD,
      loadType: state.loadType,
      R: state.R,
      L_mH: state.L_mH,
      E_emf: state.E_emf,
      Vs_rms: state.Vs_rms,
      freq: state.freq,
      wtDeg: state.wtDeg
    });

    cachedFFT = RectifierFFTEngine.analyze(cachedSimulation.waveforms.is, 360, 15);
  }

  // Update Visuals (Schematic, Scope, KPIs, Labels)
  function updateUI() {
    if (!cachedSimulation) return;

    const inst = cachedSimulation.instantaneous;
    const metrics = cachedSimulation.metrics;
    const theory = cachedSimulation.theory;

    // 1. Schematic Update
    RectifierSchematicEngine.render(state, inst);

    // Update schematic header badges
    let topoLabel = '1-PHASE FULL-BRIDGE';
    if (state.topology === '1p_half') topoLabel = '1-PHASE HALF-WAVE';
    else if (state.topology === '3p_half') topoLabel = '3-PHASE HALF-WAVE (3-PULSE)';
    else if (state.topology === '3p_full') topoLabel = '3-PHASE FULL-BRIDGE (6-PULSE)';
    dom.schematicBadge.textContent = topoLabel;

    dom.loopStatusText.textContent = inst.loopName || 'Off';

    // 2. Oscilloscope / FFT Update
    RectifierScopeEngine.render(cachedSimulation.waveforms, state.wtDeg, cachedFFT);

    // 3. Scrubber Slider & Text
    dom.wtSlider.value = state.wtDeg.toFixed(1);
    dom.wtValue.textContent = `${state.wtDeg.toFixed(1)}°`;

    // 4. Telemetry KPI Badges
    dom.kpiVdc.textContent = metrics.Vdc.toFixed(1);
    dom.kpiVrms.textContent = `V_rms = ${metrics.Vrms.toFixed(1)} V`;

    dom.kpiIdc.textContent = metrics.Idc.toFixed(2);
    dom.kpiIrms.textContent = `I_rms = ${metrics.Irms.toFixed(2)} A`;

    dom.kpiPload.textContent = metrics.Pload.toFixed(1);
    dom.kpiSin.textContent = `S_in = ${metrics.Sin.toFixed(0)} VA`;

    dom.kpiPF.textContent = metrics.PF.toFixed(3);
    dom.kpiCosPhi1.textContent = `cos(φ1) = ${cachedFFT.cosPhi1.toFixed(3)}`;

    dom.kpiRF.textContent = metrics.RF.toFixed(3);
    dom.kpiFF.textContent = `Form Factor FF = ${metrics.FF.toFixed(2)}`;

    dom.kpiTHD.textContent = `${cachedFFT.thd.toFixed(1)}`;
    dom.kpiConductionMode.textContent = `⚠ ${metrics.conductionMode} Mode`;
    if (metrics.conductionMode === 'CCM') {
      dom.kpiConductionMode.className = 'telemetry-tag badge-emerald';
      dom.kpiConductionMode.textContent = '✓ CCM Mode';
    } else {
      dom.kpiConductionMode.className = 'telemetry-tag badge-amber';
    }

    // 5. Theory Banner
    dom.theoryHeadline.textContent = theory.description;
    dom.theoryFormulaMath.textContent = theory.formula;
    dom.idealVdcValue.textContent = `${theory.idealVdc.toFixed(1)} V`;

    // 6. Synchronize Control Buttons & Sliders
    syncControlElements();
  }

  function syncControlElements() {
    // Phase 1 vs 3
    const is3P = state.topology.startsWith('3p');
    dom.btnPhase1.classList.toggle('active', !is3P);
    dom.btnPhase3.classList.toggle('active', is3P);

    // Bridge vs Half
    const isFull = state.topology.endsWith('full');
    dom.btnBridgeFull.classList.toggle('active', isFull);
    dom.btnBridgeHalf.classList.toggle('active', !isFull);

    // Device setup
    dom.btnDeviceDiodes.classList.toggle('active', state.deviceType === 'diode');
    dom.btnDeviceThyristors.classList.toggle('active', state.deviceType === 'thyristor');
    dom.btnDeviceSemi.classList.toggle('active', state.deviceType === 'semi');

    // Alpha slider & presets
    dom.alphaSlider.value = state.alphaDeg;
    dom.alphaValue.textContent = `${state.alphaDeg}°`;
    dom.alphaPresetBtns.forEach(btn => {
      const bDeg = parseInt(btn.dataset.alpha, 10);
      btn.classList.toggle('active', bDeg === state.alphaDeg);
    });

    // FWD
    dom.btnToggleFWD.classList.toggle('connected', state.hasFWD);
    dom.fwdStatusText.textContent = state.hasFWD ? 'Connected' : 'Disconnected';

    // Load tabs
    dom.btnLoadR.classList.toggle('active', state.loadType === 'R');
    dom.btnLoadRL.classList.toggle('active', state.loadType === 'RL');
    dom.btnLoadRLE.classList.toggle('active', state.loadType === 'RLE');

    // Values
    dom.sliderR.value = state.R;
    dom.valueR.textContent = `${state.R} Ω`;
    dom.sliderL.value = state.L_mH;
    dom.valueL.textContent = `${state.L_mH} mH`;
    dom.sliderVs.value = state.Vs_rms;
    dom.valueVs.textContent = `${state.Vs_rms} V`;
    if (dom.sliderE) {
      dom.sliderE.value = state.E_emf;
      dom.valueE.textContent = `${state.E_emf} V`;
      const isRLE = state.loadType === 'RLE';
      dom.groupSliderE.style.opacity = isRLE ? '1' : '0.35';
      dom.groupSliderE.style.pointerEvents = isRLE ? 'auto' : 'none';
      dom.sliderE.disabled = !isRLE;
    }

    // Speed presets
    dom.speedPresetBtns.forEach(btn => {
      const spd = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', Math.abs(spd - state.speed) < 0.01);
    });

    // Scope Tabs
    dom.scopeTabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === state.scopeMode);
    });
  }

  // Animation Loop (60 FPS)
  function animationLoop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (state.isPlaying) {
      // 50Hz = 1 cycle per 20ms = 360 deg in 0.02s => 18,000 deg/sec at 1x
      // For comfortable visual studio inspection, 1.0x runs at ~180 deg/sec
      const degStep = 180 * state.speed * dt;
      state.wtDeg = (state.wtDeg + degStep) % 360;

      // Update instantaneous slice
      recalculateFullSimulation();
      updateUI();
    }

    requestAnimationFrame(animationLoop);
  }

  // Bind All UI Events
  function bindEvents() {
    // Play / Pause
    dom.btnPlay.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      dom.btnPlay.classList.toggle('playing', state.isPlaying);
      dom.btnPlayText.textContent = state.isPlaying ? 'Pause' : 'Run Real-Time';
    });

    // Step Backward & Forward
    dom.btnStepBack.addEventListener('click', () => {
      state.isPlaying = false;
      dom.btnPlay.classList.remove('playing');
      dom.btnPlayText.textContent = 'Run Real-Time';
      state.wtDeg = (state.wtDeg - 5 + 360) % 360;
      recalculateFullSimulation();
      updateUI();
    });

    dom.btnStepForward.addEventListener('click', () => {
      state.isPlaying = false;
      dom.btnPlay.classList.remove('playing');
      dom.btnPlayText.textContent = 'Run Real-Time';
      state.wtDeg = (state.wtDeg + 5) % 360;
      recalculateFullSimulation();
      updateUI();
    });

    // Reset
    dom.btnReset.addEventListener('click', () => {
      state.wtDeg = 0;
      recalculateFullSimulation();
      updateUI();
    });

    // Speed Slider & Presets
    dom.speedSlider.addEventListener('input', (e) => {
      state.speed = parseFloat(e.target.value);
      syncControlElements();
    });

    dom.speedPresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.speed = parseFloat(btn.dataset.speed);
        dom.speedSlider.value = state.speed;
        syncControlElements();
      });
    });

    // Angle Scrubber
    dom.wtSlider.addEventListener('input', (e) => {
      state.wtDeg = parseFloat(e.target.value);
      recalculateFullSimulation();
      updateUI();
    });

    // Topology: Phase 1 vs 3
    dom.btnPhase1.addEventListener('click', () => {
      state.topology = state.topology.endsWith('half') ? '1p_half' : '1p_full';
      recalculateFullSimulation();
      updateUI();
    });

    dom.btnPhase3.addEventListener('click', () => {
      state.topology = state.topology.endsWith('half') ? '3p_half' : '3p_full';
      recalculateFullSimulation();
      updateUI();
    });

    // Topology: Full-Bridge vs Half-Wave
    dom.btnBridgeFull.addEventListener('click', () => {
      state.topology = state.topology.startsWith('3p') ? '3p_full' : '1p_full';
      recalculateFullSimulation();
      updateUI();
    });

    dom.btnBridgeHalf.addEventListener('click', () => {
      state.topology = state.topology.startsWith('3p') ? '3p_half' : '1p_half';
      recalculateFullSimulation();
      updateUI();
    });

    // Device Setup
    dom.btnDeviceDiodes.addEventListener('click', () => {
      state.deviceType = 'diode';
      recalculateFullSimulation();
      updateUI();
    });

    dom.btnDeviceThyristors.addEventListener('click', () => {
      state.deviceType = 'thyristor';
      recalculateFullSimulation();
      updateUI();
    });

    dom.btnDeviceSemi.addEventListener('click', () => {
      state.deviceType = 'semi';
      state.topology = '1p_full'; // Semi-converter is standard on 1-phase full bridge
      recalculateFullSimulation();
      updateUI();
    });

    // Firing Angle Slider & Presets
    dom.alphaSlider.addEventListener('input', (e) => {
      state.alphaDeg = parseInt(e.target.value, 10);
      recalculateFullSimulation();
      updateUI();
    });

    dom.alphaPresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.alphaDeg = parseInt(btn.dataset.alpha, 10);
        recalculateFullSimulation();
        updateUI();
      });
    });

    // FWD Toggle
    dom.btnToggleFWD.addEventListener('click', () => {
      state.hasFWD = !state.hasFWD;
      recalculateFullSimulation();
      updateUI();
    });

    // Load Type Tabs
    dom.btnLoadR.addEventListener('click', () => {
      state.loadType = 'R';
      recalculateFullSimulation();
      updateUI();
    });
    dom.btnLoadRL.addEventListener('click', () => {
      state.loadType = 'RL';
      recalculateFullSimulation();
      updateUI();
    });
    dom.btnLoadRLE.addEventListener('click', () => {
      state.loadType = 'RLE';
      recalculateFullSimulation();
      updateUI();
    });

    // Parameter Sliders
    dom.sliderR.addEventListener('input', (e) => {
      state.R = parseInt(e.target.value, 10);
      recalculateFullSimulation();
      updateUI();
    });
    dom.sliderL.addEventListener('input', (e) => {
      state.L_mH = parseInt(e.target.value, 10);
      recalculateFullSimulation();
      updateUI();
    });
    dom.sliderVs.addEventListener('input', (e) => {
      state.Vs_rms = parseInt(e.target.value, 10);
      recalculateFullSimulation();
      updateUI();
    });
    if (dom.sliderE) {
      dom.sliderE.addEventListener('input', (e) => {
        state.E_emf = parseInt(e.target.value, 10);
        recalculateFullSimulation();
        updateUI();
      });
    }

    // Scope Tabs
    dom.scopeTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        state.scopeMode = btn.dataset.tab;
        RectifierScopeEngine.setMode(state.scopeMode);
        updateUI();
      });
    });

    // Theme Toggle (Light / Dark)
    dom.btnThemeToggle.addEventListener('click', () => {
      state.isLightMode = !state.isLightMode;
      dom.body.classList.toggle('light-theme', state.isLightMode);
      dom.btnThemeToggle.innerHTML = state.isLightMode ? '🌙 Dark Mode' : '☀️ Light Mode';
      updateUI();
    });

    // Full Screen Studio
    dom.btnFullscreenStudio.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Modals
    dom.btnOpenTheory.addEventListener('click', () => dom.theoryModal.classList.add('open'));
    dom.btnOpenDerivations.addEventListener('click', () => dom.theoryModal.classList.add('open'));
    dom.btnOpenPresets.addEventListener('click', () => dom.presetsModal.classList.add('open'));

    dom.closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.theoryModal.classList.remove('open');
        dom.presetsModal.classList.remove('open');
      });
    });

    // Preset Clicks
    document.querySelectorAll('.preset-item').forEach(item => {
      item.addEventListener('click', () => {
        applyPreset(item.dataset.preset);
        dom.presetsModal.classList.remove('open');
      });
    });
  }

  // Pre-configured engineering presets
  function applyPreset(presetKey) {
    switch (presetKey) {
      case 'industrial_dc_drive':
        state.topology = '1p_full';
        state.deviceType = 'thyristor';
        state.alphaDeg = 45;
        state.hasFWD = false;
        state.loadType = 'RL';
        state.R = 20;
        state.L_mH = 45;
        state.Vs_rms = 230;
        break;
      case 'battery_charger':
        state.topology = '1p_full';
        state.deviceType = 'semi';
        state.alphaDeg = 30;
        state.hasFWD = true;
        state.loadType = 'RLE';
        state.R = 8;
        state.L_mH = 20;
        state.E_emf = 48;
        state.Vs_rms = 110;
        break;
      case 'heater_control':
        state.topology = '1p_full';
        state.deviceType = 'thyristor';
        state.alphaDeg = 60;
        state.hasFWD = false;
        state.loadType = 'R';
        state.R = 15;
        state.L_mH = 0;
        state.Vs_rms = 230;
        break;
      case 'three_phase_smelter':
        state.topology = '3p_full';
        state.deviceType = 'thyristor';
        state.alphaDeg = 30;
        state.hasFWD = false;
        state.loadType = 'RL';
        state.R = 5;
        state.L_mH = 60;
        state.Vs_rms = 400;
        break;
      case 'three_phase_uncontrolled':
        state.topology = '3p_full';
        state.deviceType = 'diode';
        state.alphaDeg = 0;
        state.hasFWD = false;
        state.loadType = 'RL';
        state.R = 25;
        state.L_mH = 30;
        state.Vs_rms = 415;
        break;
      case 'classic_half_wave':
        state.topology = '1p_half';
        state.deviceType = 'diode';
        state.alphaDeg = 0;
        state.hasFWD = true;
        state.loadType = 'RL';
        state.R = 20;
        state.L_mH = 40;
        state.Vs_rms = 230;
        break;
    }

    recalculateFullSimulation();
    updateUI();
  }

  // Start when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
