// The reader, opened at a page with a quote highlighted
export function readerLink(bookId, locator, quote) {
  const hl = quote ? `&hl=${encodeURIComponent(quote.slice(0, 600))}` : '';
  return `/book/${bookId}?locator=${locator}${hl}`;
}
