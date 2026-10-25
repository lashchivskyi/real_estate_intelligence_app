/** Remembers the visitor's language so the proxy can redirect `/` to it next time. */
export function setLangCookie(lang: string) {
  window.document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
}
