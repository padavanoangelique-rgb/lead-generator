export function isEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("embed") === "1") return true;
    return window.parent !== window;
  } catch {
    return true;
  }
}
