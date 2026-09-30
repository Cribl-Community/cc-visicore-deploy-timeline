/**
 * Leader UI links (verified against a Cribl.Cloud 4.20 Leader). The app runs in
 * an iframe served from the Leader, so root-relative paths resolve to the Leader
 * UI; target=_blank opens a new tab.
 */
export const LEADER_TARGET = '_blank';
const product = (isFleet: boolean) => (isFleet ? 'edge' : 'stream');
export const groupUrl = (gid: string, isFleet = false) => `/${product(isFleet)}/m/${encodeURIComponent(gid)}`;
export const groupsListUrl = (isFleet = false) => `/${product(isFleet)}/m`;
export const diagnosticsUrl = '/global-settings/diagnostics';
