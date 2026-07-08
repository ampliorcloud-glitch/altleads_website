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
      const newRect = element.getBoundingClientRect();
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
