/**
 * PVA Anti-Burn-In Protection Engine
 * 1. Smooth Lissajous pixel shifting (prevents static bright subpixel polarization)
 * 2. Periodic full-screen dark phosphor sweep (resets liquid crystal retention)
 * 3. Progressive deep dimming after extended idle (instantly wakes on mouse movement)
 */
(function (global) {
  class PVAAntiBurnInEngine {
    constructor({ stageElement, sweepElement, onShiftUpdate, onDimChange } = {}) {
      this.stage = stageElement;
      this.sweep = sweepElement;
      this.onShiftUpdate = onShiftUpdate;
      this.onDimChange = onDimChange;

      this.config = {
        enabled: true,
        pixelShiftPx: 18,
        pixelShiftIntervalSec: 40,
        sweepIntervalMin: 5,
        deepDimAfterMin: 20,
        deepDimOpacity: 0.62,
        crtScanlines: true
      };

      this.stepIndex = 0;
      this.shiftTimer = null;
      this.sweepTimer = null;
      this.dimTimer = null;
      this.startedAt = Date.now();
      this.lastPointerMoveAt = Date.now();
      this.isDimmed = false;
      this.currentOffset = { x: 0, y: 0 };

      this._bindPointerWake();
    }

    _bindPointerWake() {
      const wake = () => {
        this.lastPointerMoveAt = Date.now();
        if (this.isDimmed) {
          this.isDimmed = false;
          this._applyBrightness(1);
        }
      };
      window.addEventListener('mousemove', wake, { passive: true });
      window.addEventListener('mousedown', wake, { passive: true });
    }

    _applyBrightness(factor) {
      if (this.stage) {
        this.stage.style.opacity = String(factor);
      }
      if (this.onDimChange) {
        this.onDimChange(factor < 0.99, factor);
      }
    }

    applyConfig(antiBurnInConfig) {
      this.config = { ...this.config, ...(antiBurnInConfig || {}) };
      document.body.classList.toggle('crt-scanlines-off', this.config.crtScanlines === false);
      this.restart();
    }

    restart() {
      this.stop();
      if (!this.config.enabled) {
        this._setShift(0, 0);
        this._applyBrightness(1);
        return;
      }

      const shiftMs = Math.max(10, Number(this.config.pixelShiftIntervalSec) || 40) * 1000;
      this.shiftTimer = setInterval(() => this._stepPixelShift(), shiftMs);

      const sweepMin = Number(this.config.sweepIntervalMin) || 0;
      if (sweepMin > 0) {
        this.sweepTimer = setInterval(() => this.triggerSweep(), sweepMin * 60 * 1000);
      }

      this.dimTimer = setInterval(() => this._checkDeepDim(), 5000);
    }

    _setShift(dx, dy) {
      this.currentOffset = { x: dx, y: dy };
      if (this.stage) {
        this.stage.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      }
      if (this.onShiftUpdate) {
        this.onShiftUpdate(dx, dy);
      }
    }

    _stepPixelShift() {
      this.stepIndex += 1;
      const amp = Math.max(4, Math.min(36, Number(this.config.pixelShiftPx) || 18));
      // Smooth non-repeating Lissajous orbit so pixels visit all quadrants evenly
      const t = this.stepIndex * 0.65;
      const dx = Math.round(Math.sin(t) * amp);
      const dy = Math.round(Math.cos(t * 0.72) * amp);
      this._setShift(dx, dy);
    }

    triggerSweep() {
      if (!this.sweep) return;
      this.sweep.classList.remove('active');
      void this.sweep.offsetWidth; // restart CSS animation cleanly
      this.sweep.classList.add('active');
    }

    _checkDeepDim() {
      const dimAfterMin = Number(this.config.deepDimAfterMin) || 0;
      if (dimAfterMin <= 0) return;
      const elapsedMin = (Date.now() - this.lastPointerMoveAt) / 60000;
      if (elapsedMin >= dimAfterMin && !this.isDimmed) {
        this.isDimmed = true;
        const opacity = Math.max(0.3, Math.min(0.95, Number(this.config.deepDimOpacity) || 0.62));
        this._applyBrightness(opacity);
      }
    }

    stop() {
      if (this.shiftTimer) clearInterval(this.shiftTimer);
      if (this.sweepTimer) clearInterval(this.sweepTimer);
      if (this.dimTimer) clearInterval(this.dimTimer);
      this.shiftTimer = null;
      this.sweepTimer = null;
      this.dimTimer = null;
    }
  }

  global.PVAAntiBurnInEngine = PVAAntiBurnInEngine;
})(window);
