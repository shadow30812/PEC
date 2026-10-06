/**
 * RectifierLab - Parametric Vector Schematic Engine
 * Renders SVG schematics with switch states, glow effects, and animated current-flow loops.
 */

(function(root) {
  'use strict';

  const SchematicEngine = {};

  let containerEl = null;

  SchematicEngine.init = function(elementId) {
    containerEl = document.getElementById(elementId);
  };

  /**
   * Updates or re-renders the schematic
   */
  SchematicEngine.render = function(params, instState) {
    if (!containerEl) return;

    const {
      topology = '1p_full',
      deviceType = 'thyristor',
      hasFWD = false,
      loadType = 'RL',
      R = 20,
      L_mH = 45,
      E_emf = 24
    } = params;

    const {
      devices = {},
      vo = 0,
      io = 0,
      vs = 0,
      loopName = 'Off',
      isFWDConducting = false
    } = instState;

    if (topology === '1p_full') {
      renderSinglePhaseBridge({
        devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting
      });
    } else if (topology === '1p_half') {
      renderSinglePhaseHalfWave({
        devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting
      });
    } else if (topology === '3p_half') {
      renderThreePhaseHalfWave({
        devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting
      });
    } else if (topology === '3p_full') {
      renderThreePhaseBridge({
        devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting
      });
    }
  };

  // Helper to determine wire active class
  function wireClass(isActive) {
    return isActive ? 'wire-base wire-active' : 'wire-base';
  }

  // Helper to render a switch component (Thyristor / Diode)
  function renderSwitchSVG(id, label, isThyristor, x, y, isOn) {
    const rectClass = isOn ? 'device-rect device-on' : 'device-rect';
    const statusText = isOn ? 'ON' : 'OFF';
    const statusClass = isOn ? 'device-status-badge status-on' : 'device-status-badge status-off';
    const strokeColor = isOn ? 'var(--color-emerald)' : 'var(--text-muted)';
    const fillColor = isOn ? 'rgba(5, 223, 114, 0.25)' : 'none';

    return `
      <g id="switch-${id}" transform="translate(${x}, ${y})" class="circuit-switch" data-switch-id="${id}" style="cursor: pointer;">
        <rect x="-24" y="-32" width="48" height="64" class="${rectClass}"/>
        <text x="0" y="-18" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-muted)">${label}</text>
        
        <!-- Diode/Thyristor Symbol -->
        <g transform="translate(0, 0)">
          <!-- Triangle -->
          <polygon points="0,-10 -9,6 9,6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.8"/>
          <!-- Cathode bar -->
          <line x1="-10" y1="-10" x2="10" y2="-10" stroke="${strokeColor}" stroke-width="2"/>
          ${isThyristor ? `
            <!-- Gate line -->
            <path d="M 6,-10 L 14,-14" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="14" cy="-14" r="1.5" fill="${strokeColor}"/>
          ` : ''}
        </g>
        
        <text x="0" y="24" text-anchor="middle" class="${statusClass}">${statusText}</text>
      </g>
    `;
  }

  // Helper to render the Load block (R, RL, or RLE with battery)
  function renderLoadBlockSVG(opts) {
    const {
      x,
      loadType = 'RL',
      R = 20,
      L_mH = 45,
      E_emf = 24,
      vo = 0,
      io = 0,
      loadActive = false,
      topY = -120,
      botY = 120,
      topLabel = `+ Vo (${vo.toFixed(1)} V)`,
      botLabel = '- Vo (GND)'
    } = opts;

    const isR = loadType === 'R';
    const isRL = loadType === 'RL';
    const isRLE = loadType === 'RLE';

    return `
      <g transform="translate(${x}, 180)">
        <!-- Top and Bottom connection lines to rails -->
        <line x1="0" y1="${topY}" x2="0" y2="-62" class="${wireClass(loadActive)}"/>
        <line x1="0" y1="62" x2="0" y2="${botY}" class="${wireClass(loadActive)}"/>

        <!-- Terminal labels -->
        <text x="14" y="${topY + 10}" font-size="11" font-weight="700" fill="var(--color-rose)">${topLabel}</text>
        <text x="14" y="${botY - 2}" font-size="11" font-weight="700" fill="var(--color-cyan)">${botLabel}</text>

        <!-- Load Container Box -->
        <rect x="-37" y="-62" width="74" height="124" rx="8" class="load-box-rect" fill="#0f1b33" stroke="${loadActive ? 'var(--color-cyan)' : 'var(--border-light)'}" stroke-width="1.8"/>
        <text x="0" y="-46" text-anchor="middle" font-size="11" font-weight="800" fill="var(--color-cyan)">${loadType} Load</text>

        ${isR ? `
          <!-- R-Only Load Elements -->
          <path d="M 0 -34 L -6 -28 L 6 -20 L -6 -12 L 6 -4 L 0 2" fill="none" stroke="var(--color-amber)" stroke-width="2"/>
          <text x="0" y="16" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>
          <g transform="translate(0, 30)">
            <rect x="-31" y="0" width="62" height="18" rx="4" fill="rgba(5, 223, 114, 0.15)" stroke="rgba(5, 223, 114, 0.35)"/>
            <text x="0" y="13" text-anchor="middle" font-size="9.5" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io >= 0 ? '+' : ''}${io.toFixed(2)} A</text>
          </g>
        ` : ''}

        ${isRL ? `
          <!-- RL Load Elements -->
          <path d="M 0 -36 L -5 -31 L 5 -25 L -5 -19 L 5 -13 L 0 -9" fill="none" stroke="var(--color-amber)" stroke-width="1.8"/>
          <text x="0" y="-1" text-anchor="middle" font-size="9" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>

          <path d="M -10 10 C -10 6 -3 6 -3 10 C -3 6 4 6 4 10 C 4 6 11 6 11 10" fill="none" stroke="var(--color-cyan)" stroke-width="1.8"/>
          <text x="0" y="22" text-anchor="middle" font-size="9" font-family="var(--font-mono)" fill="var(--text-muted)">L = ${L_mH} mH</text>

          <g transform="translate(0, 31)">
            <rect x="-31" y="0" width="62" height="18" rx="4" fill="rgba(5, 223, 114, 0.15)" stroke="rgba(5, 223, 114, 0.35)"/>
            <text x="0" y="13" text-anchor="middle" font-size="9.5" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io >= 0 ? '+' : ''}${io.toFixed(2)} A</text>
          </g>
        ` : ''}

        ${isRLE ? `
          <!-- RLE Load Elements: Resistor + Inductor + DC Battery -->
          <path d="M 0 -38 L -4 -34 L 4 -29 L -4 -24 L 4 -19 L 0 -16" fill="none" stroke="var(--color-amber)" stroke-width="1.6"/>
          <text x="0" y="-8" text-anchor="middle" font-size="8.5" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>

          <path d="M -9 2 C -9 -1 -3 -1 -3 2 C -3 -1 3 -1 3 2 C 3 -1 9 -1 9 2" fill="none" stroke="var(--color-cyan)" stroke-width="1.6"/>
          <text x="0" y="11" text-anchor="middle" font-size="8.5" font-family="var(--font-mono)" fill="var(--text-muted)">L = ${L_mH} mH</text>

          <!-- DC Battery Symbol (E Back-EMF) -->
          <g transform="translate(0, 22)">
            <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--color-rose)" stroke-width="2"/>
            <text x="-15" y="3" font-size="8" font-weight="800" fill="var(--color-rose)">+</text>
            <line x1="-5" y1="4" x2="5" y2="4" stroke="var(--color-rose)" stroke-width="2.5"/>
            <text x="-14" y="9" font-size="9" font-weight="800" fill="var(--color-rose)">−</text>
            <text x="0" y="14" text-anchor="middle" font-size="8.5" font-family="var(--font-mono)" font-weight="700" fill="var(--color-rose)">E = ${E_emf} V</text>
          </g>

          <g transform="translate(0, 42)">
            <rect x="-31" y="0" width="62" height="15" rx="3" fill="rgba(5, 223, 114, 0.15)" stroke="rgba(5, 223, 114, 0.35)"/>
            <text x="0" y="11" text-anchor="middle" font-size="9" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io >= 0 ? '+' : ''}${io.toFixed(2)} A</text>
          </g>
        ` : ''}
      </g>
    `;
  }

  // --------------------------------------------------------------------------
  // 1. SINGLE-PHASE FULL-BRIDGE SVG
  // --------------------------------------------------------------------------
  function renderSinglePhaseBridge(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting } = opts;
    const isThyristor = deviceType === 'thyristor';
    const isSemi = deviceType === 'semi';

    // Bridge legs: T1(top left), T4(bottom left), T3(top right), T2(bottom right)
    const condTop1 = !!(devices.T1 || devices.D1);
    const condTop3 = !!(devices.T3 || devices.D3);
    const condTopAny = condTop1 || condTop3;

    const condBot4 = !!(devices.T4 || devices.D4);
    const condBot2 = !!(devices.T2 || devices.D2);
    const condBotAny = condBot4 || condBot2;

    const pair12 = condTop1 && condBot2;
    const pair34 = condTop3 && condBot4;
    const pairSemiFW = (devices.D2 && devices.D4) || isFWDConducting;

    const sourceActive = (pair12 || pair34) && !pairSemiFW;
    const loadActive = io > 0.05;

    // Build SVG
    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <defs>
          <radialGradient id="acGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#00d2ff" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#00d2ff" stop-opacity="0"/>
          </radialGradient>
        </defs>

        <!-- Segmented Top DC Rail (+Vo) -->
        <!-- 220 to 320: only active if Leg 1 (T1/D1) conducts -->
        <line x1="220" y1="60" x2="320" y2="60" class="${wireClass(condTop1)}"/>
        <!-- 320 to 440: active if either T1 or T3 conducts -->
        <line x1="320" y1="60" x2="440" y2="60" class="${wireClass(condTopAny)}"/>
        <!-- 440 to 590: active if load conducts (bridge or FWD) -->
        <line x1="440" y1="60" x2="590" y2="60" class="${wireClass(loadActive)}"/>

        <!-- Segmented Bottom DC Rail (-Vo / Return) -->
        <!-- 220 to 320: active only if current returns to Leg 1 (T4/D4) -->
        <line x1="220" y1="300" x2="320" y2="300" class="${wireClass(condBot4)}"/>
        <!-- 320 to 440: active if current returns through bridge (T4 or T2) -->
        <line x1="320" y1="300" x2="440" y2="300" class="${wireClass(condBotAny)}"/>
        <!-- 440 to 590: carries all load return current -->
        <line x1="440" y1="300" x2="590" y2="300" class="${wireClass(loadActive)}"/>

        <!-- AC Source Connections -->
        <!-- Phase A Line to Left Leg (between T1 and T4) -->
        <path d="M 100 150 L 220 150" class="${wireClass(sourceActive)}"/>
        <!-- Neutral Line to Right Leg (between T3 and T2) -->
        <path d="M 100 210 L 320 210" class="${wireClass(sourceActive)}"/>

        <!-- Leg 1 Wires (Vertical connections) -->
        <line x1="220" y1="60" x2="220" y2="90" class="${wireClass(condTop1)}"/>
        <line x1="220" y1="150" x2="220" y2="122" class="${wireClass(condTop1)}"/>
        <line x1="220" y1="150" x2="220" y2="238" class="${wireClass(condBot4)}"/>
        <line x1="220" y1="270" x2="220" y2="300" class="${wireClass(condBot4)}"/>

        <!-- Leg 2 Wires (Vertical connections) -->
        <line x1="320" y1="60" x2="320" y2="90" class="${wireClass(condTop3)}"/>
        <line x1="320" y1="210" x2="320" y2="122" class="${wireClass(condTop3)}"/>
        <line x1="320" y1="210" x2="320" y2="238" class="${wireClass(condBot2)}"/>
        <line x1="320" y1="270" x2="320" y2="300" class="${wireClass(condBot2)}"/>

        <!-- AC Source Symbol -->
        <g transform="translate(100, 180)">
          <circle cx="0" cy="0" r="24" class="ac-source-circle" fill="url(#acGlow)" stroke="var(--color-cyan)" stroke-width="2"/>
          <path d="M -12 0 Q -6 -12 0 0 Q 6 12 12 0" fill="none" stroke="var(--color-cyan)" stroke-width="2.5"/>
          <text x="0" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-main)">AC Source</text>
          <text x="0" y="52" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--color-cyan)">Vs = ${vs.toFixed(1)} V</text>
          <text x="5" y="-18" font-size="9" fill="var(--text-muted)">Phase A</text>
          <text x="5" y="24" font-size="9" fill="var(--text-muted)">Neutral (N)</text>
        </g>

        <!-- Switches: T1, T4, T3, T2 -->
        ${renderSwitchSVG('T1', isSemi || isThyristor ? 'T1' : 'D1', isThyristor || isSemi, 220, 106, condTop1)}
        ${renderSwitchSVG('T4', isSemi ? 'D4' : (isThyristor ? 'T4' : 'D4'), isThyristor, 220, 254, condBot4)}
        ${renderSwitchSVG('T3', isSemi ? 'T3' : (isThyristor ? 'T3' : 'D3'), isThyristor || isSemi, 320, 106, condTop3)}
        ${renderSwitchSVG('T2', isSemi ? 'D2' : (isThyristor ? 'T2' : 'D2'), isThyristor, 320, 254, condBot2)}

        <!-- Freewheeling Diode Branch (Optional) -->
        <g transform="translate(440, 180)" opacity="${hasFWD ? '1' : '0.25'}">
          <line x1="0" y1="-120" x2="0" y2="-20" class="${wireClass(isFWDConducting && hasFWD)}"/>
          <line x1="0" y1="20" x2="0" y2="120" class="${wireClass(isFWDConducting && hasFWD)}"/>
          <!-- Diode D_FW (Pointing upwards) -->
          <polygon points="0,-16 -8,8 8,8" fill="${isFWDConducting && hasFWD ? 'rgba(5, 223, 114, 0.4)' : 'none'}" stroke="${isFWDConducting && hasFWD ? 'var(--color-emerald)' : 'var(--text-dim)'}" stroke-width="1.8"/>
          <line x1="-9" y1="-16" x2="9" y2="-16" stroke="${isFWDConducting && hasFWD ? 'var(--color-emerald)' : 'var(--text-dim)'}" stroke-width="2"/>
          <text x="0" y="26" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-muted)">D_FW</text>
          <text x="0" y="40" text-anchor="middle" font-size="9" fill="${hasFWD ? 'var(--color-emerald)' : 'var(--text-dim)'}">${hasFWD ? (isFWDConducting ? 'CONDUCTING' : 'READY') : 'DISCONNECTED'}</text>
        </g>

        <!-- Load Block (Far Right) -->
        ${renderLoadBlockSVG({
          x: 590, loadType, R, L_mH, E_emf, vo, io, loadActive,
          topY: -120, botY: 120, topLabel: `+ Vo (${vo.toFixed(1)} V)`, botLabel: '- Vo (GND)'
        })}
      </svg>
    `;
  }

  // --------------------------------------------------------------------------
  // 2. SINGLE-PHASE HALF-WAVE SVG
  // --------------------------------------------------------------------------
  function renderSinglePhaseHalfWave(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting } = opts;
    const isThyristor = deviceType === 'thyristor';
    const isConducting = !!(devices.T1 || devices.D1);
    const loadActive = io > 0.05;

    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <!-- Segmented Top Rail with Switch -->
        <!-- Source to switch: active only when switch is conducting -->
        <line x1="120" y1="80" x2="270" y2="80" class="${wireClass(isConducting)}"/>
        <!-- Switch output to FWD branch: active only when switch is conducting -->
        <line x1="330" y1="80" x2="440" y2="80" class="${wireClass(isConducting)}"/>
        <!-- FWD branch to load: active if switch conducts OR FWD freewheels -->
        <line x1="440" y1="80" x2="580" y2="80" class="${wireClass(loadActive)}"/>

        <!-- Segmented Bottom Return Rail -->
        <!-- Source to FWD branch: active only when source supplies current -->
        <line x1="120" y1="280" x2="440" y2="280" class="${wireClass(isConducting)}"/>
        <!-- FWD branch to load: carries full load return current -->
        <line x1="440" y1="280" x2="580" y2="280" class="${wireClass(loadActive)}"/>

        <!-- AC Source Symbol -->
        <g transform="translate(120, 180)">
          <circle cx="0" cy="0" r="24" class="ac-source-circle" fill="rgba(0, 210, 255, 0.15)" stroke="var(--color-cyan)" stroke-width="2"/>
          <path d="M -12 0 Q -6 -12 0 0 Q 6 12 12 0" fill="none" stroke="var(--color-cyan)" stroke-width="2.5"/>
          <line x1="0" y1="-24" x2="0" y2="-100" class="${wireClass(isConducting)}"/>
          <line x1="0" y1="24" x2="0" y2="100" class="${wireClass(isConducting)}"/>
          <text x="0" y="38" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-main)">AC Source</text>
          <text x="0" y="52" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--color-cyan)">Vs = ${vs.toFixed(1)} V</text>
        </g>

        <!-- Switch T1 / D1 (Horizontal orientation) -->
        <g transform="translate(300, 80) rotate(90)">
          ${renderSwitchSVG('T1', isThyristor ? 'T1' : 'D1', isThyristor, 0, 0, isConducting)}
        </g>

        <!-- Freewheeling Diode Branch -->
        <g transform="translate(440, 180)" opacity="${hasFWD ? '1' : '0.25'}">
          <line x1="0" y1="-100" x2="0" y2="-20" class="${wireClass(isFWDConducting && hasFWD)}"/>
          <line x1="0" y1="20" x2="0" y2="100" class="${wireClass(isFWDConducting && hasFWD)}"/>
          <polygon points="0,-16 -8,8 8,8" fill="${isFWDConducting && hasFWD ? 'rgba(5, 223, 114, 0.4)' : 'none'}" stroke="${isFWDConducting && hasFWD ? 'var(--color-emerald)' : 'var(--text-dim)'}" stroke-width="1.8"/>
          <line x1="-9" y1="-16" x2="9" y2="-16" stroke="${isFWDConducting && hasFWD ? 'var(--color-emerald)' : 'var(--text-dim)'}" stroke-width="2"/>
          <text x="0" y="26" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text-muted)">D_FW</text>
          <text x="0" y="40" text-anchor="middle" font-size="9" fill="${hasFWD ? 'var(--color-emerald)' : 'var(--text-dim)'}">${hasFWD ? (isFWDConducting ? 'CONDUCTING' : 'READY') : 'DISCONNECTED'}</text>
        </g>

        <!-- Load Block -->
        ${renderLoadBlockSVG({
          x: 580, loadType, R, L_mH, E_emf, vo, io, loadActive,
          topY: -100, botY: 100, topLabel: `+ Vo (${vo.toFixed(1)} V)`, botLabel: '- Vo (Neutral)'
        })}
      </svg>
    `;
  }

  // --------------------------------------------------------------------------
  // 3. THREE-PHASE HALF-WAVE (3-PULSE STAR) SVG
  // --------------------------------------------------------------------------
  function renderThreePhaseHalfWave(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType } = opts;
    const isThyristor = deviceType === 'thyristor';
    const loadActive = io > 0.05;

    const cond1 = !!(devices.T1 || devices.D1);
    const cond2 = !!(devices.T2 || devices.D2);
    const cond3 = !!(devices.T3 || devices.D3);

    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <!-- Segmented Top Rail (+Vo) -->
        <!-- 220 to 320: active only if T1 conducts -->
        <line x1="220" y1="50" x2="320" y2="50" class="${wireClass(cond1)}"/>
        <!-- 320 to 420: active if T1 or T2 conducts -->
        <line x1="320" y1="50" x2="420" y2="50" class="${wireClass(cond1 || cond2)}"/>
        <!-- 420 to 590: active if any phase conducts into the load -->
        <line x1="420" y1="50" x2="590" y2="50" class="${wireClass(loadActive && (cond1 || cond2 || cond3))}"/>

        <!-- Star Neutral Return Rail (-Vo) -->
        <line x1="60" y1="310" x2="590" y2="310" class="${wireClass(loadActive)}"/>

        <!-- 3 Phase Supply Lines -->
        <!-- Phase A -->
        <path d="M 60 110 L 220 110" class="${wireClass(cond1)}"/>
        <!-- Phase B -->
        <path d="M 60 170 L 320 170" class="${wireClass(cond2)}"/>
        <!-- Phase C -->
        <path d="M 60 230 L 420 230" class="${wireClass(cond3)}"/>

        <!-- Phase Connections to Top Rail through Switches -->
        <line x1="220" y1="50" x2="220" y2="76" class="${wireClass(cond1)}"/>
        <line x1="220" y1="110" x2="220" y2="108" class="${wireClass(cond1)}"/>

        <line x1="320" y1="50" x2="320" y2="76" class="${wireClass(cond2)}"/>
        <line x1="320" y1="170" x2="320" y2="108" class="${wireClass(cond2)}"/>

        <line x1="420" y1="50" x2="420" y2="76" class="${wireClass(cond3)}"/>
        <line x1="420" y1="230" x2="420" y2="108" class="${wireClass(cond3)}"/>

        <!-- 3-Phase Sources (Left) -->
        <g transform="translate(60, 170)">
          <text x="-40" y="-55" font-size="11" font-weight="700" fill="var(--color-rose)">Ph A</text>
          <text x="-40" y="5" font-size="11" font-weight="700" fill="var(--color-amber)">Ph B</text>
          <text x="-40" y="65" font-size="11" font-weight="700" fill="var(--color-cyan)">Ph C</text>
          <text x="-40" y="145" font-size="11" font-weight="700" fill="var(--text-muted)">Neutral</text>
        </g>

        <!-- 3 Switches -->
        ${renderSwitchSVG('T1', isThyristor ? 'T1' : 'D1', isThyristor, 220, 92, cond1)}
        ${renderSwitchSVG('T2', isThyristor ? 'T2' : 'D2', isThyristor, 320, 92, cond2)}
        ${renderSwitchSVG('T3', isThyristor ? 'T3' : 'D3', isThyristor, 420, 92, cond3)}

        <!-- Load Block -->
        ${renderLoadBlockSVG({
          x: 590, loadType, R, L_mH, E_emf, vo, io, loadActive,
          topY: -130, botY: 130, topLabel: `+ Vo (${vo.toFixed(1)} V)`, botLabel: 'Neutral (GND)'
        })}
      </svg>
    `;
  }

  // --------------------------------------------------------------------------
  // 4. THREE-PHASE FULL-WAVE BRIDGE (6-PULSE) SVG
  // --------------------------------------------------------------------------
  function renderThreePhaseBridge(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType } = opts;
    const isThyristor = deviceType === 'thyristor';
    const loadActive = io > 0.05;

    // Upper devices (T1/D1, T3/D3, T5/D5)
    const condTop1 = !!(devices.T1 || devices.D1);
    const condTop3 = !!(devices.T3 || devices.D3);
    const condTop5 = !!(devices.T5 || devices.D5);

    // Lower devices (T4/D4, T6/D6, T2/D2)
    const condBot4 = !!(devices.T4 || devices.D4);
    const condBot6 = !!(devices.T6 || devices.D6);
    const condBot2 = !!(devices.T2 || devices.D2);

    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <!-- Segmented Top DC Rail (+Vo) -->
        <!-- 180 to 210: structural rail end, always inactive -->
        <line x1="180" y1="50" x2="210" y2="50" class="wire-base"/>
        <!-- 210 to 330: active only if T1 conducts -->
        <line x1="210" y1="50" x2="330" y2="50" class="${wireClass(condTop1)}"/>
        <!-- 330 to 450: active if T1 or T3 conducts -->
        <line x1="330" y1="50" x2="450" y2="50" class="${wireClass(condTop1 || condTop3)}"/>
        <!-- 450 to 610: active if any upper switch supplies the load -->
        <line x1="450" y1="50" x2="610" y2="50" class="${wireClass(loadActive && (condTop1 || condTop3 || condTop5))}"/>

        <!-- Segmented Bottom DC Rail (-Vo) -->
        <!-- 180 to 210: structural rail end, always inactive -->
        <line x1="180" y1="310" x2="210" y2="310" class="wire-base"/>
        <!-- 210 to 330: active only if return current reaches Leg 1 (T4/D4) -->
        <line x1="210" y1="310" x2="330" y2="310" class="${wireClass(condBot4)}"/>
        <!-- 330 to 450: active if return current reaches Leg 1 (T4) or Leg 2 (T6) -->
        <line x1="330" y1="310" x2="450" y2="310" class="${wireClass(condBot4 || condBot6)}"/>
        <!-- 450 to 610: carries return current from load to any active lower switch -->
        <line x1="450" y1="310" x2="610" y2="310" class="${wireClass(loadActive && (condBot4 || condBot6 || condBot2))}"/>

        <!-- Phase Lines from Left to Bridge Legs -->
        <!-- Phase A -> Leg 1 (x=210) -->
        <path d="M 50 140 L 210 140" class="${wireClass(condTop1 || condBot4)}"/>
        <!-- Phase B -> Leg 2 (x=330) -->
        <path d="M 50 180 L 330 180" class="${wireClass(condTop3 || condBot6)}"/>
        <!-- Phase C -> Leg 3 (x=450) -->
        <path d="M 50 220 L 450 220" class="${wireClass(condTop5 || condBot2)}"/>

        <!-- Phase Labels (Left) -->
        <g transform="translate(50, 0)">
          <text x="-40" y="145" font-size="11" font-weight="700" fill="var(--color-rose)">Phase A</text>
          <text x="-40" y="185" font-size="11" font-weight="700" fill="var(--color-amber)">Phase B</text>
          <text x="-40" y="225" font-size="11" font-weight="700" fill="var(--color-cyan)">Phase C</text>
        </g>

        <!-- Leg 1 Wires (Phase A: T1 top, T4 bottom) -->
        <line x1="210" y1="50" x2="210" y2="80" class="${wireClass(condTop1)}"/>
        <line x1="210" y1="140" x2="210" y2="114" class="${wireClass(condTop1)}"/>
        <line x1="210" y1="140" x2="210" y2="246" class="${wireClass(condBot4)}"/>
        <line x1="210" y1="280" x2="210" y2="310" class="${wireClass(condBot4)}"/>

        <!-- Leg 2 Wires (Phase B: T3 top, T6 bottom) -->
        <line x1="330" y1="50" x2="330" y2="80" class="${wireClass(condTop3)}"/>
        <line x1="330" y1="180" x2="330" y2="114" class="${wireClass(condTop3)}"/>
        <line x1="330" y1="180" x2="330" y2="246" class="${wireClass(condBot6)}"/>
        <line x1="330" y1="280" x2="330" y2="310" class="${wireClass(condBot6)}"/>

        <!-- Leg 3 Wires (Phase C: T5 top, T2 bottom) -->
        <line x1="450" y1="50" x2="450" y2="80" class="${wireClass(condTop5)}"/>
        <line x1="450" y1="220" x2="450" y2="114" class="${wireClass(condTop5)}"/>
        <line x1="450" y1="220" x2="450" y2="246" class="${wireClass(condBot2)}"/>
        <line x1="450" y1="280" x2="450" y2="310" class="${wireClass(condBot2)}"/>

        <!-- 6 Switches: T1, T3, T5 (Upper) and T4, T6, T2 (Lower) -->
        ${renderSwitchSVG('T1', isThyristor ? 'T1' : 'D1', isThyristor, 210, 97, condTop1)}
        ${renderSwitchSVG('T3', isThyristor ? 'T3' : 'D3', isThyristor, 330, 97, condTop3)}
        ${renderSwitchSVG('T5', isThyristor ? 'T5' : 'D5', isThyristor, 450, 97, condTop5)}

        ${renderSwitchSVG('T4', isThyristor ? 'T4' : 'D4', isThyristor, 210, 263, condBot4)}
        ${renderSwitchSVG('T6', isThyristor ? 'T6' : 'D6', isThyristor, 330, 263, condBot6)}
        ${renderSwitchSVG('T2', isThyristor ? 'T2' : 'D2', isThyristor, 450, 263, condBot2)}

        <!-- Load Block (Far Right) -->
        ${renderLoadBlockSVG({
          x: 610, loadType, R, L_mH, E_emf, vo, io, loadActive,
          topY: -130, botY: 130, topLabel: `+ Vo (${vo.toFixed(1)} V)`, botLabel: '- Vo (GND)'
        })}
      </svg>
    `;
  }

  root.RectifierSchematicEngine = SchematicEngine;

})(typeof window !== 'undefined' ? window : this);
