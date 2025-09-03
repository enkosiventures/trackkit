import type { EventType, PageContext } from '../types';

export type DispatchItem = {
  id: string;
  type: EventType;
  run: () => Promise<void> | void;
  size?: number;
  createdAt?: number;
};

export class Dispatcher {
  enqueue(item: DispatchItem) {
    // pass-through immediate execution (will be replaced by batching/retry later)
    return Promise.resolve(item.run());
  }
  flush() { return Promise.resolve(); }
  stats() { return { dummy: true }; }
  destroy() {}
}