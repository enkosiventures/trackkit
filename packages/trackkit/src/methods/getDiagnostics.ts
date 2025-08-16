import { getDiagnostics as diagnostics } from '../core/facade-singleton';

/**
 * Get diagnostics information from the analytics facade
 * @returns Diagnostics object containing provider and event information
 */
export const getDiagnostics = diagnostics;
export default getDiagnostics;