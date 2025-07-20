import type { 
  ConsentState, 
  ConsentConfig, 
  ConsentEvent,
  ConsentCategories 
} from './types';
import { createStorageAdapter, detectRegion } from './storage';
import { StateMachine } from '../util/state';
import { EventQueue } from '../util/queue';
import { logger } from '../util/logger';

/**
 * Default consent states by region
 */
const REGIONAL_DEFAULTS: Record<string, Partial<ConsentState>> = {
  EU: {
    status: 'pending',
    categories: {
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
    },
    method: 'explicit',
    legalBasis: 'consent',
  },
  US: {
    status: 'granted',
    categories: {
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
    },
    method: 'opt-out',
    legalBasis: 'legitimate_interest',
  },
  OTHER: {
    status: 'granted',
    categories: {
      necessary: true,
      analytics: true,
      marketing: false,
      preferences: true,
    },
    method: 'implicit',
    legalBasis: 'legitimate_interest',
  },
};

/**
 * Consent manager with state machine and persistence
 */
export class ConsentManager {
  private state: ConsentState;
  private config: ConsentConfig;
  private storage: ReturnType<typeof createStorageAdapter>;
  private listeners = new Set<(state: ConsentState) => void>();
  private eventQueue: EventQueue;
  
  constructor(config: ConsentConfig = {}) {
    this.config = config;
    
    // Setup storage
    this.storage = createStorageAdapter(
      config.storage || { type: 'cookie' }
    );
    
    // Initialize event queue for consent changes
    this.eventQueue = new EventQueue({
      maxSize: 10,
      debug: config.debug,
    });
    
    // Load or initialize state
    this.state = this.loadState();
    
    logger.info('Consent manager initialized', {
      status: this.state.status,
      storage: config.storage?.type || 'cookie',
    });
  }
  
  /**
   * Load consent state from storage or defaults
   */
  private loadState(): ConsentState {
    // Try loading from storage
    const stored = this.storage.get();
    if (stored) {
      logger.debug('Loaded consent from storage', stored);
      return stored;
    }
    
    // Use configured default
    if (this.config.defaultState) {
      return {
        ...this.config.defaultState,
        timestamp: Date.now(),
      };
    }
    
    // Use geographic defaults
    const region = 'OTHER'; // In real implementation, use detectRegion()
    const regionalDefault = this.config.geographicDefaults?.[region] ||
                          REGIONAL_DEFAULTS[region] ||
                          REGIONAL_DEFAULTS.OTHER;
    
    return {
      status: 'pending',
      categories: {
        necessary: true,
        analytics: false,
        marketing: false,
        preferences: false,
      },
      ...regionalDefault,
      timestamp: Date.now(),
    } as ConsentState;
  }
  
  /**
   * Get current consent state
   */
  getState(): Readonly<ConsentState> {
    return { ...this.state };
  }
  
  /**
   * Check if a specific category has consent
   */
  hasConsent(category: keyof ConsentCategories): boolean {
    if (this.state.status === 'denied') return false;
    if (this.state.status === 'granted') return true;
    return this.state.categories[category] || false;
  }
  
  /**
   * Check if any analytics tracking is allowed
   */
  canTrack(): boolean {
    return this.state.status === 'granted' || 
           this.state.status === 'partial' ||
           this.hasConsent('analytics');
  }
  
  /**
   * Process consent event
   */
  processEvent(event: ConsentEvent): void {
    const previousState = { ...this.state };
    
    switch (event.type) {
      case 'GRANT':
        this.state = {
          status: 'granted',
          categories: event.categories || {
            necessary: true,
            analytics: true,
            marketing: true,
            preferences: true,
          },
          timestamp: Date.now(),
          method: 'explicit',
          version: this.config.defaultState?.version,
          legalBasis: 'consent',
        };
        break;
        
      case 'DENY':
        this.state = {
          status: 'denied',
          categories: {
            necessary: true,
            analytics: false,
            marketing: false,
            preferences: false,
          },
          timestamp: Date.now(),
          method: 'explicit',
          version: this.config.defaultState?.version,
          legalBasis: 'consent',
        };
        break;
        
      case 'WITHDRAW':
        this.state = {
          ...previousState,
          status: 'denied',
          categories: {
            necessary: true,
            analytics: false,
            marketing: false,
            preferences: false,
          },
          timestamp: Date.now(),
          method: 'explicit',
        };
        break;
        
      case 'UPDATE':
        const hasAnyConsent = Object.values(event.categories).some(v => v);
        const hasAllConsent = Object.values(event.categories).every(v => v);
        
        this.state = {
          ...previousState,
          status: hasAllConsent ? 'granted' : hasAnyConsent ? 'partial' : 'denied',
          categories: {
            necessary: true,
            ...event.categories,
          },
          timestamp: Date.now(),
          method: 'explicit',
        };
        break;
        
      case 'RESET':
        this.storage.remove();
        this.state = this.loadState();
        break;
    }
    
    // Persist state
    this.storage.set(this.state);
    
    // Log change
    logger.info('Consent updated', {
      event: event.type,
      previousStatus: previousState.status,
      newStatus: this.state.status,
    });
    
    // Notify listeners
    this.notifyListeners(previousState);
  }
  
  /**
   * Subscribe to consent changes
   */
  subscribe(listener: (state: ConsentState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(previousState: ConsentState): void {
    const currentState = this.getState();
    
    // Call configured callback
    if (this.config.onConsentChange) {
      try {
        this.config.onConsentChange(currentState, previousState);
      } catch (error) {
        logger.error('Error in onConsentChange callback', error);
      }
    }
    
    // Call subscribed listeners
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        logger.error('Error in consent listener', error);
      }
    });
  }
  
  /**
   * Simple API for basic grant/deny
   */
  grant(categories?: ConsentCategories): void {
    this.processEvent({ type: 'GRANT', categories });
  }
  
  deny(): void {
    this.processEvent({ type: 'DENY' });
  }
  
  withdraw(): void {
    this.processEvent({ type: 'WITHDRAW' });
  }
  
  update(categories: ConsentCategories): void {
    this.processEvent({ type: 'UPDATE', categories });
  }
  
  reset(): void {
    this.processEvent({ type: 'RESET' });
  }
  
  /**
   * Get consent banner configuration
   */
  getBannerConfig() {
    return {
      required: this.config.requireExplicit || this.state.status === 'pending',
      categories: Object.keys(this.state.categories).filter(
        cat => cat !== 'necessary'
      ),
      canReject: true,
      privacyPolicy: '/privacy',
      cookiePolicy: '/cookies',
    };
  }
}