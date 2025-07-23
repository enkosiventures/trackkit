import { getFacade } from '../core/facade-singleton';

/**
 * Identify a user with a unique identifier
 * @param userId - User identifier or null to clear
 */
export function identify(userId: string | null): void {
    getFacade().identify(userId);
}

export default identify;