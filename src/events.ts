export class EventEmitter {
  private events: Record<string, Function[]> = {};

  on(event: string, callback: Function) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(cb => cb(...args));
    }
  }
}
