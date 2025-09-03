import { ensureNavigationSandbox } from '../providers/shared/navigationSandbox';
import { logger } from '../util/logger';

export class NavigationService {
  private unsub: (() => void) | null = null;
  start(onUrl: (url: string) => void) {
    if (typeof window === 'undefined' || this.unsub) return;
    const sandbox = ensureNavigationSandbox(window);
    this.unsub = sandbox.subscribe(onUrl);
    logger.info('Starting autotracking');
  }
  stop() { this.unsub?.(); this.unsub = null; logger.info('Autotracking stopped'); }
}