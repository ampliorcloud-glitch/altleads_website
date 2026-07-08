export class ResizeObserverPolyfill {
  constructor(callback) {
    this.callback = callback;
    this.elements = new Map();
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }
  observe(element) {
    this.elements.set(element, element.getBoundingClientRect());
    this.handleResize();
  }
  unobserve(element) {
    this.elements.delete(element);
  }
  disconnect() {
    this.elements.clear();
    window.removeEventListener('resize', this.handleResize);
  }
  handleResize() {
    const entries = [];
    for (const [element, rect] of this.elements.entries()) {
      const newRect = {
        width: window.innerWidth,
        height: window.innerHeight,
        top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth
      };
      entries.push({
        target: element,
        contentRect: newRect
      });
      this.elements.set(element, newRect);
    }
    if (entries.length > 0) {
      this.callback(entries, this);
    }
  }
}

try {
  Object.defineProperty(window, 'ResizeObserver', {
    value: ResizeObserverPolyfill,
    writable: false,
    configurable: false
  });
  window.__POLYFILL_ACTIVE = true;
} catch (e) {
  window.__POLYFILL_ACTIVE = e.message;
}
