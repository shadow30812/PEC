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

  // --------------------------------------------------------------------------
  // 1. SINGLE-PHASE FULL-BRIDGE SVG
  // --------------------------------------------------------------------------
  function renderSinglePhaseBridge(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting } = opts;
    const isThyristor = deviceType === 'thyristor';
    const isSemi = deviceType === 'semi';

    // Bridge legs: T1(top left), T4(bottom left), T3(top right), T2(bottom right)
    // Conduction pairs
    const pair12 = (devices.T1 || devices.D1) && (devices.T2 || devices.D2);
    const pair34 = (devices.T3 || devices.D3) && (devices.T4 || devices.D4);
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

        <!-- Rail Lines -->
        <!-- Top DC Rail (+Vo) -->
        <line x1="220" y1="60" x2="590" y2="60" class="${wireClass(loadActive)}"/>
        <!-- Bottom DC Rail (-Vo / GND) -->
        <line x1="220" y1="300" x2="590" y2="300" class="${wireClass(loadActive)}"/>

        <!-- AC Source Connections -->
        <!-- Phase A Line to Left Leg (between T1 and T4) -->
        <path d="M 100 150 L 220 150" class="${wireClass(sourceActive)}"/>
        <!-- Neutral Line to Right Leg (between T3 and T2) -->
        <path d="M 100 210 L 150 210 L 150 210 L 320 210" class="${wireClass(sourceActive)}"/>

        <!-- Leg 1 Wires (Vertical connections) -->
        <line x1="220" y1="60" x2="220" y2="90" class="${wireClass(devices.T1 || devices.D1)}"/>
        <line x1="220" y1="150" x2="220" y2="122" class="${wireClass(devices.T1 || devices.D1)}"/>
        <line x1="220" y1="150" x2="220" y2="238" class="${wireClass(devices.T4 || devices.D4)}"/>
        <line x1="220" y1="270" x2="220" y2="300" class="${wireClass(devices.T4 || devices.D4)}"/>

        <!-- Leg 2 Wires (Vertical connections) -->
        <line x1="320" y1="60" x2="320" y2="90" class="${wireClass(devices.T3 || devices.D3)}"/>
        <line x1="320" y1="210" x2="320" y2="122" class="${wireClass(devices.T3 || devices.D3)}"/>
        <line x1="320" y1="210" x2="320" y2="238" class="${wireClass(devices.T2 || devices.D2)}"/>
        <line x1="320" y1="270" x2="320" y2="300" class="${wireClass(devices.T2 || devices.D2)}"/>

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
        ${renderSwitchSVG('T1', isSemi || isThyristor ? 'T1' : 'D1', isThyristor || isSemi, 220, 106, devices.T1 || devices.D1)}
        ${renderSwitchSVG('T4', isSemi ? 'D4' : (isThyristor ? 'T4' : 'D4'), isThyristor, 220, 254, devices.T4 || devices.D4)}
        ${renderSwitchSVG('T3', isSemi ? 'T3' : (isThyristor ? 'T3' : 'D3'), isThyristor || isSemi, 320, 106, devices.T3 || devices.D3)}
        ${renderSwitchSVG('T2', isSemi ? 'D2' : (isThyristor ? 'T2' : 'D2'), isThyristor, 320, 254, devices.T2 || devices.D2)}

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
        <g transform="translate(590, 180)">
          <!-- Top and Bottom connection lines -->
          <line x1="0" y1="-120" x2="0" y2="-55" class="${wireClass(loadActive)}"/>
          <line x1="0" y1="55" x2="0" y2="120" class="${wireClass(loadActive)}"/>
          
          <!-- Rail labels -->
          <text x="15" y="-115" font-size="11" font-weight="700" fill="var(--color-rose)">+ Vo (${vo.toFixed(1)} V)</text>
          <text x="15" y="125" font-size="11" font-weight="700" fill="var(--color-cyan)">- Vo (GND)</text>

          <!-- Load Box -->
          <rect x="-35" y="-55" width="70" height="110" rx="8" class="load-box-rect" fill="#0f1b33" stroke="${loadActive ? 'var(--color-cyan)' : 'var(--border-light)'}" stroke-width="1.8"/>
          <text x="0" y="-38" text-anchor="middle" font-size="11" font-weight="800" fill="var(--color-cyan)">${loadType} Load</text>

          <!-- Resistor Zigzag Symbol -->
          <path d="M 0 -26 L -6 -21 L 6 -14 L -6 -7 L 6 0 L 0 5" fill="none" stroke="var(--color-amber)" stroke-width="2"/>
          <text x="0" y="16" text-anchor="middle" font-size="9" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>

          ${loadType.includes('L') ? `
            <!-- Inductor Coils -->
            <path d="M -12 24 C -12 20 -4 20 -4 24 C -4 20 4 20 4 24 C 4 20 12 20 12 24" fill="none" stroke="var(--color-cyan)" stroke-width="2"/>
            <text x="0" y="36" text-anchor="middle" font-size="9" font-family="var(--font-mono)" fill="var(--text-muted)">L = ${L_mH} mH</text>
          ` : ''}

          <!-- Live Load Current Badge -->
          <g transform="translate(0, 48)">
            <rect x="-32" y="5" width="64" height="18" rx="4" fill="rgba(5, 223, 114, 0.15)" stroke="rgba(5, 223, 114, 0.35)"/>
            <text x="0" y="18" text-anchor="middle" font-size="10" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io >= 0 ? '+' : ''}${io.toFixed(2)} A</text>
          </g>
        </g>
      </svg>
    `;
  }

  // --------------------------------------------------------------------------
  // 2. SINGLE-PHASE HALF-WAVE SVG
  // --------------------------------------------------------------------------
  function renderSinglePhaseHalfWave(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, E_emf, deviceType, isFWDConducting } = opts;
    const isThyristor = deviceType === 'thyristor';
    const isConducting = devices.T1 || devices.D1;
    const loadActive = io > 0.05;

    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <!-- Top Rail with Switch -->
        <line x1="120" y1="80" x2="270" y2="80" class="${wireClass(isConducting)}"/>
        <line x1="330" y1="80" x2="580" y2="80" class="${wireClass(loadActive)}"/>

        <!-- Return / Bottom Rail -->
        <line x1="120" y1="280" x2="580" y2="280" class="${wireClass(loadActive)}"/>

        <!-- AC Source Symbol -->
        <g transform="translate(120, 180)">
          <circle cx="0" cy="0" r="24" class="ac-source-circle" fill="rgba(0, 210, 255, 0.15)" stroke="var(--color-cyan)" stroke-width="2"/>
          <path d="M -12 0 Q -6 -12 0 0 Q 6 12 12 0" fill="none" stroke="var(--color-cyan)" stroke-width="2.5"/>
          <line x1="0" y1="-24" x2="0" y2="-100" class="${wireClass(isConducting)}"/>
          <line x1="0" y1="24" x2="0" y2="100" class="${wireClass(loadActive)}"/>
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
        <g transform="translate(580, 180)">
          <line x1="0" y1="-100" x2="0" y2="-50" class="${wireClass(loadActive)}"/>
          <line x1="0" y1="50" x2="0" y2="100" class="${wireClass(loadActive)}"/>
          <rect x="-35" y="-50" width="70" height="100" rx="8" class="load-box-rect" fill="#0f1b33" stroke="${loadActive ? 'var(--color-cyan)' : 'var(--border-light)'}" stroke-width="1.8"/>
          <text x="0" y="-32" text-anchor="middle" font-size="11" font-weight="800" fill="var(--color-cyan)">${loadType} Load</text>
          <text x="0" y="-8" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>
          ${loadType.includes('L') ? `<text x="0" y="10" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">L = ${L_mH} mH</text>` : ''}
          <text x="15" y="-95" font-size="11" font-weight="700" fill="var(--color-rose)">+ Vo (${vo.toFixed(1)} V)</text>
          <text x="15" y="105" font-size="11" font-weight="700" fill="var(--color-cyan)">- Vo</text>
          <g transform="translate(0, 36)">
            <rect x="-30" y="0" width="60" height="16" rx="4" fill="rgba(5, 223, 114, 0.15)"/>
            <text x="0" y="12" text-anchor="middle" font-size="9" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io.toFixed(2)} A</text>
          </g>
        </g>
      </svg>
    `;
  }

  // --------------------------------------------------------------------------
  // 3. THREE-PHASE HALF-WAVE (3-PULSE STAR) SVG
  // --------------------------------------------------------------------------
  function renderThreePhaseHalfWave(opts) {
    const { devices, vo, io, vs, hasFWD, loadType, R, L_mH, deviceType } = opts;
    const isThyristor = deviceType === 'thyristor';
    const loadActive = io > 0.05;

    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <!-- Top Rail (+Vo) -->
        <line x1="220" y1="50" x2="590" y2="50" class="${wireClass(loadActive)}"/>
        <!-- Star Neutral Return Rail (-Vo) -->
        <line x1="60" y1="310" x2="590" y2="310" class="${wireClass(loadActive)}"/>

        <!-- 3 Phase Supply Lines -->
        <!-- Phase A -->
        <path d="M 60 110 L 220 110" class="${wireClass(devices.T1 || devices.D1)}"/>
        <!-- Phase B -->
        <path d="M 60 170 L 320 170" class="${wireClass(devices.T2 || devices.D2)}"/>
        <!-- Phase C -->
        <path d="M 60 230 L 420 230" class="${wireClass(devices.T3 || devices.D3)}"/>

        <!-- Phase Connections to Top Rail through Switches -->
        <line x1="220" y1="50" x2="220" y2="76" class="${wireClass(devices.T1 || devices.D1)}"/>
        <line x1="220" y1="110" x2="220" y2="108" class="${wireClass(devices.T1 || devices.D1)}"/>

        <line x1="320" y1="50" x2="320" y2="76" class="${wireClass(devices.T2 || devices.D2)}"/>
        <line x1="320" y1="170" x2="320" y2="108" class="${wireClass(devices.T2 || devices.D2)}"/>

        <line x1="420" y1="50" x2="420" y2="76" class="${wireClass(devices.T3 || devices.D3)}"/>
        <line x1="420" y1="230" x2="420" y2="108" class="${wireClass(devices.T3 || devices.D3)}"/>

        <!-- 3-Phase Sources (Left) -->
        <g transform="translate(60, 170)">
          <text x="-40" y="-55" font-size="11" font-weight="700" fill="var(--color-rose)">Ph A</text>
          <text x="-40" y="5" font-size="11" font-weight="700" fill="var(--color-amber)">Ph B</text>
          <text x="-40" y="65" font-size="11" font-weight="700" fill="var(--color-cyan)">Ph C</text>
          <text x="-40" y="145" font-size="11" font-weight="700" fill="var(--text-muted)">Neutral</text>
        </g>

        <!-- 3 Switches -->
        ${renderSwitchSVG('T1', isThyristor ? 'T1' : 'D1', isThyristor, 220, 92, devices.T1 || devices.D1)}
        ${renderSwitchSVG('T2', isThyristor ? 'T2' : 'D2', isThyristor, 320, 92, devices.T2 || devices.D2)}
        ${renderSwitchSVG('T3', isThyristor ? 'T3' : 'D3', isThyristor, 420, 92, devices.T3 || devices.D3)}

        <!-- Load Block -->
        <g transform="translate(590, 180)">
          <line x1="0" y1="-130" x2="0" y2="-55" class="${wireClass(loadActive)}"/>
          <line x1="0" y1="55" x2="0" y2="130" class="${wireClass(loadActive)}"/>
          <rect x="-35" y="-55" width="70" height="110" rx="8" class="load-box-rect" fill="#0f1b33" stroke="${loadActive ? 'var(--color-cyan)' : 'var(--border-light)'}" stroke-width="1.8"/>
          <text x="0" y="-38" text-anchor="middle" font-size="11" font-weight="800" fill="var(--color-cyan)">3-Phase HW</text>
          <text x="0" y="-12" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>
          <text x="0" y="12" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">L = ${L_mH} mH</text>
          <text x="15" y="-120" font-size="11" font-weight="700" fill="var(--color-rose)">+ Vo (${vo.toFixed(1)} V)</text>
          <text x="15" y="135" font-size="11" font-weight="700" fill="var(--color-cyan)">Neutral (GND)</text>
          <g transform="translate(0, 48)">
            <rect x="-30" y="0" width="60" height="16" rx="4" fill="rgba(5, 223, 114, 0.15)"/>
            <text x="0" y="12" text-anchor="middle" font-size="9" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io.toFixed(2)} A</text>
          </g>
        </g>
      </svg>
    `;
  }

  // --------------------------------------------------------------------------
  // 4. THREE-PHASE FULL-WAVE BRIDGE (6-PULSE) SVG
  // --------------------------------------------------------------------------
  function renderThreePhaseBridge(opts) {
    const { devices, vo, io, vs, loadType, R, L_mH, deviceType } = opts;
    const isThyristor = deviceType === 'thyristor';
    const loadActive = io > 0.05;

    containerEl.innerHTML = `
      <svg viewBox="0 0 740 360" width="100%" height="100%">
        <!-- Top DC Rail (+Vo) -->
        <line x1="180" y1="50" x2="610" y2="50" class="${wireClass(loadActive)}"/>
        <!-- Bottom DC Rail (-Vo) -->
        <line x1="180" y1="310" x2="610" y2="310" class="${wireClass(loadActive)}"/>

        <!-- Phase Lines from Left to Bridge Legs -->
        <!-- Phase A -> Leg 1 (x=210) -->
        <path d="M 50 140 L 210 140" class="${wireClass(devices.T1 || devices.D1 || devices.T4 || devices.D4)}"/>
        <!-- Phase B -> Leg 2 (x=330) -->
        <path d="M 50 180 L 330 180" class="${wireClass(devices.T3 || devices.D3 || devices.T6 || devices.D6)}"/>
        <!-- Phase C -> Leg 3 (x=450) -->
        <path d="M 50 220 L 450 220" class="${wireClass(devices.T5 || devices.D5 || devices.T2 || devices.D2)}"/>

        <!-- Phase Labels (Left) -->
        <g transform="translate(50, 0)">
          <text x="-40" y="145" font-size="11" font-weight="700" fill="var(--color-rose)">Phase A</text>
          <text x="-40" y="185" font-size="11" font-weight="700" fill="var(--color-amber)">Phase B</text>
          <text x="-40" y="225" font-size="11" font-weight="700" fill="var(--color-cyan)">Phase C</text>
        </g>

        <!-- Leg 1 Wires (Phase A: T1 top, T4 bottom) -->
        <line x1="210" y1="50" x2="210" y2="80" class="${wireClass(devices.T1 || devices.D1)}"/>
        <line x1="210" y1="140" x2="210" y2="114" class="${wireClass(devices.T1 || devices.D1)}"/>
        <line x1="210" y1="140" x2="210" y2="246" class="${wireClass(devices.T4 || devices.D4)}"/>
        <line x1="210" y1="280" x2="210" y2="310" class="${wireClass(devices.T4 || devices.D4)}"/>

        <!-- Leg 2 Wires (Phase B: T3 top, T6 bottom) -->
        <line x1="330" y1="50" x2="330" y2="80" class="${wireClass(devices.T3 || devices.D3)}"/>
        <line x1="330" y1="180" x2="330" y2="114" class="${wireClass(devices.T3 || devices.D3)}"/>
        <line x1="330" y1="180" x2="330" y2="246" class="${wireClass(devices.T6 || devices.D6)}"/>
        <line x1="330" y1="280" x2="330" y2="310" class="${wireClass(devices.T6 || devices.D6)}"/>

        <!-- Leg 3 Wires (Phase C: T5 top, T2 bottom) -->
        <line x1="450" y1="50" x2="450" y2="80" class="${wireClass(devices.T5 || devices.D5)}"/>
        <line x1="450" y1="220" x2="450" y2="114" class="${wireClass(devices.T5 || devices.D5)}"/>
        <line x1="450" y1="220" x2="450" y2="246" class="${wireClass(devices.T2 || devices.D2)}"/>
        <line x1="450" y1="280" x2="450" y2="310" class="${wireClass(devices.T2 || devices.D2)}"/>

        <!-- 6 Switches: T1, T3, T5 (Upper) and T4, T6, T2 (Lower) -->
        ${renderSwitchSVG('T1', isThyristor ? 'T1' : 'D1', isThyristor, 210, 97, devices.T1 || devices.D1)}
        ${renderSwitchSVG('T3', isThyristor ? 'T3' : 'D3', isThyristor, 330, 97, devices.T3 || devices.D3)}
        ${renderSwitchSVG('T5', isThyristor ? 'T5' : 'D5', isThyristor, 450, 97, devices.T5 || devices.D5)}

        ${renderSwitchSVG('T4', isThyristor ? 'T4' : 'D4', isThyristor, 210, 263, devices.T4 || devices.D4)}
        ${renderSwitchSVG('T6', isThyristor ? 'T6' : 'D6', isThyristor, 330, 263, devices.T6 || devices.D6)}
        ${renderSwitchSVG('T2', isThyristor ? 'T2' : 'D2', isThyristor, 450, 263, devices.T2 || devices.D2)}

        <!-- Load Block (Far Right) -->
        <g transform="translate(610, 180)">
          <line x1="0" y1="-130" x2="0" y2="-55" class="${wireClass(loadActive)}"/>
          <line x1="0" y1="55" x2="0" y2="130" class="${wireClass(loadActive)}"/>
          <rect x="-35" y="-55" width="70" height="110" rx="8" class="load-box-rect" fill="#0f1b33" stroke="${loadActive ? 'var(--color-cyan)' : 'var(--border-light)'}" stroke-width="1.8"/>
          <text x="0" y="-38" text-anchor="middle" font-size="11" font-weight="800" fill="var(--color-cyan)">6-Pulse Bridge</text>
          <text x="0" y="-12" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">R = ${R} Ω</text>
          <text x="0" y="12" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--text-muted)">L = ${L_mH} mH</text>
          <text x="15" y="-120" font-size="11" font-weight="700" fill="var(--color-rose)">+ Vo (${vo.toFixed(1)} V)</text>
          <text x="15" y="135" font-size="11" font-weight="700" fill="var(--color-cyan)">- Vo (GND)</text>
          <g transform="translate(0, 48)">
            <rect x="-30" y="0" width="60" height="16" rx="4" fill="rgba(5, 223, 114, 0.15)"/>
            <text x="0" y="12" text-anchor="middle" font-size="9" font-family="var(--font-mono)" font-weight="700" fill="var(--color-emerald)">i = ${io.toFixed(2)} A</text>
          </g>
        </g>
      </svg>
    `;
  }

  root.RectifierSchematicEngine = SchematicEngine;

})(typeof window !== 'undefined' ? window : this);
