import { ArrowTopRightIcon } from '@radix-ui/react-icons';

export function safeOpenLibraryUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'openlibrary.org' || url.port || url.username || url.password) return null;
    if (!/^\/(?:works\/OL\d+W|books\/OL\d+M|authors\/OL\d+A)\/?$/.test(url.pathname)) return null;
    return `${url.origin}${url.pathname}`;
  } catch { return null; }
}

/** A reusable, text-only search result card. Links are supplied only after validation. */
export function ResultCard({ title, subtitle, metadata, href, index }: {
  title: string; subtitle?: string; metadata?: string; href?: string | null; index: number;
}) {
  return <article className="tool-book">
    <span className="tool-book-index">{String(index + 1).padStart(2, '0')}</span>
    <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}{metadata && <small>{metadata}</small>}
      {href && <div><a href={href} target="_blank" rel="noopener noreferrer">View on Open Library<ArrowTopRightIcon/></a></div>}
    </div>
  </article>;
}

export function BookResults({ value }: { value: { books: unknown[]; total?: unknown; source?: unknown } }) {
  const books = value.books.filter((book): book is Record<string, unknown> => !!book && typeof book === 'object' && !Array.isArray(book));
  return <div>
    <div className="tool-result-summary"><span>{typeof value.total === 'number' ? `${value.total.toLocaleString('en-US')} ${value.total === 1 ? 'match' : 'matches'}` : `${books.length} ${books.length === 1 ? 'result' : 'results'}`}</span><span>{value.source === 'Open Library' ? 'Open Library' : 'Search results'}</span></div>
    <div className="tool-books">{books.slice(0, 30).map((book, index) => <ResultCard key={index} index={index}
      title={typeof book.title === 'string' ? book.title : 'Untitled book'}
      subtitle={Array.isArray(book.authors) ? book.authors.filter((name): name is string => typeof name === 'string').join(' · ') : typeof book.author === 'string' ? book.author : undefined}
      metadata={typeof book.firstPublished === 'number' ? `First published ${book.firstPublished}` : typeof book.year === 'number' ? `Published ${book.year}` : undefined}
      href={safeOpenLibraryUrl(book.url)}/>)}
    </div>
    {!books.length && <p className="inline-note">No matching books this time. Try a title or an author.</p>}
  </div>;
}
