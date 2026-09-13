import { isEmbedded } from './unlock';

export const DESK_SESSION = { user: { email: 'desk@majesticpermits.com' }, embedded: true };

export function deskHeaders() {
  if (typeof window === 'undefined' || !isEmbedded()) return {};
  return { 'x-majestic-desk': '1' };
}
