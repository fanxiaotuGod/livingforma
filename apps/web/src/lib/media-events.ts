export const MEDIA_STOP_EVENT = 'livingforma:stop-local-media';

/** Only explicit local user actions dispatch this event; never a business SSE event. */
export function stopLocalDevices(reason = 'Media stopped.') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MEDIA_STOP_EVENT, { detail: reason }));
  }
}
