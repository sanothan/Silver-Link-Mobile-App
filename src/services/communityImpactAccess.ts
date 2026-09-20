import { isAdmin } from './reportAccess';
import type { ReportViewer } from './reportAccess';

export class CommunityImpactAccessError extends Error {
  constructor(message = 'You are not allowed to view the community impact dashboard.') {
    super(message);
    this.name = 'CommunityImpactAccessError';
  }
}

/**
 * The dashboard aggregates every member and every request in the system, so it is an
 * administrator-only view. The role check is the same one the safety reports use, which
 * keeps a single idea of what "administrator" means across the app.
 */
export function canViewCommunityImpact(viewer: ReportViewer | null): boolean {
  return isAdmin(viewer);
}

/** Narrows the viewer to a signed-in administrator, so callers can rely on their uid. */
export function assertCanViewCommunityImpact(viewer: ReportViewer | null): asserts viewer is ReportViewer {
  if (!canViewCommunityImpact(viewer)) throw new CommunityImpactAccessError();
}
