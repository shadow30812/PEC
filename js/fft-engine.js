/**
 * RectifierLab - Discrete Fourier Transform (DFT) Engine
 * Harmonic decomposition of AC source current (i_s), THD, and Power Factor analysis.
 */

(function(root) {
  'use strict';

  const FFTEngine = {};

  /**
   * Performs Fourier analysis on a single-cycle current waveform buffer
   * @param {Float64Array} isArray - AC source current array
   * @param {number} pointsPerCycle - number of samples in one cycle (e.g. 360)
   * @param {number} maxHarmonic - highest harmonic order to compute (e.g. 15)
   * @returns {Object} harmonic magnitudes, percentages, THD, and displacement PF
   */
  FFTEngine.analyze = function(isArray, pointsPerCycle = 360, maxHarmonic = 15) {
    const N = Math.min(isArray.length, pointsPerCycle);
    const harmonics = [];

    let sumSqHarmonics = 0;
    let fundamentalMag = 0;
    let phi1 = 0;

    for (let h = 1; h <= maxHarmonic; h++) {
      let a_h = 0; // cos term
      let b_h = 0; // sin term

      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * h * n) / N;
        const val = isArray[n];
        a_h += val * Math.cos(angle);
        b_h += val * Math.sin(angle);
      }

      a_h = (2 / N) * a_h;
      b_h = (2 / N) * b_h;

      // Peak amplitude of h-th harmonic
      const mag = Math.sqrt(a_h * a_h + b_h * b_h);
      const rms = mag / Math.SQRT2;

      if (h === 1) {
        fundamentalMag = mag;
        phi1 = Math.atan2(a_h, b_h); // phase shift relative to fundamental sin(wt)
      } else {
        sumSqHarmonics += rms * rms;
      }

      harmonics.push({
        order: h,
        mag: parseFloat(mag.toFixed(3)),
        rms: parseFloat(rms.toFixed(3)),
        percent: 0 // Will compute below relative to fundamental
      });
    }

    // Compute percentage relative to fundamental
    const fundSafe = fundamentalMag > 0.001 ? fundamentalMag : 1;
    harmonics.forEach(h => {
      h.percent = parseFloat(((h.mag / fundSafe) * 100).toFixed(1));
    });

    // Total Harmonic Distortion (THD)
    const fundRms = fundamentalMag / Math.SQRT2;
    const thd = fundRms > 0.01 ? (Math.sqrt(sumSqHarmonics) / fundRms) * 100 : 0;

    // Displacement Power Factor cos(phi1)
    const cosPhi1 = Math.cos(phi1);

    return {
      harmonics,
      fundamentalMag: parseFloat(fundamentalMag.toFixed(2)),
      thd: parseFloat(Math.min(thd, 999).toFixed(1)),
      phi1Deg: parseFloat(((phi1 * 180) / Math.PI).toFixed(1)),
      cosPhi1: parseFloat(Math.max(0, Math.min(1, Math.abs(cosPhi1))).toFixed(3))
    };
  };

  root.RectifierFFTEngine = FFTEngine;

})(typeof window !== 'undefined' ? window : this);
