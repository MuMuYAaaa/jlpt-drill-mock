(function (global) {
  'use strict';
  class PageMotion {
    constructor(element) {
      this.element = element;
      this.revision = 0;
      this.animations = new Set();
      this.previousInert = null;
      this.preference = global.matchMedia('(prefers-reduced-motion: reduce)');
      this.preference.addEventListener('change', () => {
        if (this.preference.matches) for (const animation of this.animations) animation.finish();
      });
    }
    cancel() {
      this.revision++;
      for (const animation of this.animations) animation.cancel();
      this.animations.clear();
      if (this.previousInert !== null) this.element.inert = this.previousInert;
      this.previousInert = null;
    }
    play(keyframes, duration) {
      const animation = this.element.animate(keyframes, { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
      this.animations.add(animation);
      return animation.finished.catch(() => {}).finally(() => {
        this.animations.delete(animation);
        animation.cancel();
      });
    }
    async swap(render, { kind = 'page', direction = 1, current = () => true } = {}) {
      this.cancel();
      const revision = this.revision, element = this.element;
      if (!current()) return false;
      const enabled = () => !this.preference.matches && typeof element.animate === 'function';
      const question = kind === 'question', compact = kind === 'section';
      const shift = question ? `translateX(${-direction * 8}px)` : 'translateY(-5px)';
      this.previousInert = element.inert;
      element.inert = true;
      try {
        if (enabled() && element.firstElementChild && !element.querySelector(':scope > .loading')) {
          await this.play([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: shift }], question || compact ? 65 : 85);
        }
        if (revision !== this.revision || !current()) return false;
        render();
        if (revision === this.revision && enabled()) {
          const from = question ? `translateX(${direction * 18}px)` : `translateY(${compact ? 7 : 12}px)`;
          void this.play([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], question || compact ? 190 : 240);
        }
        return true;
      } finally {
        if (revision === this.revision) {
          element.inert = this.previousInert;
          this.previousInert = null;
        }
      }
    }
  }
  global.PageMotion = PageMotion;
})(window);
