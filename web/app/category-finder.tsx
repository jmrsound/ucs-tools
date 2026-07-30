"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { matchUcs, parseUcsCsv, type UcsCategory, type UcsMatch } from "./ucs";

const STARTER_QUERY = "A crowd applauding in a theater";
const EXAMPLES = [
  "A heavy metal security door slams shut",
  "A crowd applauding in a theater",
  "A small dog panting and whining",
  "A sci-fi machine powering down",
];

export function CategoryFinder() {
  const [catalog, setCatalog] = useState<UcsCategory[]>([]);
  const [query, setQuery] = useState(STARTER_QUERY);
  const [submittedQuery, setSubmittedQuery] = useState(STARTER_QUERY);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(new URL("ucs_v8.2.1.csv", document.baseURI))
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        return response.text();
      })
      .then((csv) => {
        if (!cancelled) setCatalog(parseUcsCsv(csv));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== textareaRef.current) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const matches = useMemo(
    () => (catalog.length ? matchUcs(submittedQuery, catalog, 6) : []),
    [catalog, submittedQuery],
  );
  const primary = matches[selectedIndex] ?? matches[0];
  const alternates = matches.filter((_, index) => index !== selectedIndex).slice(0, 4);
  const topCategories = new Set(catalog.map((entry) => entry.category)).size;

  const submit = (nextQuery = query) => {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setSubmittedQuery(trimmed);
    setSelectedIndex(0);
    setCopied("");
  };

  const useExample = (example: string) => {
    setQuery(example);
    submit(example);
  };

  const copyCatId = async (match: UcsMatch) => {
    await navigator.clipboard.writeText(match.entry.catid);
    setCopied(match.entry.catid);
    window.setTimeout(() => setCopied(""), 1400);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand" aria-label="UCS Tagger">
          <span className="brand-mark" aria-hidden="true">
            ⌁
          </span>
          <span>ucs-tagger</span>
        </div>
        <div className="catalog-state">
          <span className="state-dot" aria-hidden="true" />
          {catalog.length
            ? `UCS v8.2.1 · ${catalog.length} subcategories`
            : "Loading public UCS list"}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">UCS tagger</p>
        <h1>Describe a sound. Find its UCS home.</h1>
        <p className="hero-copy">
          Write what you hear in ordinary language. The finder checks the public UCS list
          and gives you a short, inspectable set of likely categories.
        </p>
      </section>

      <section className="finder" aria-label="UCS tagger">
        <div className="query-panel">
          <div className="query-label-row">
            <label className="query-label" htmlFor="sound-description">
              Sound description
            </label>
            <span className="shortcut">⌘ / Ctrl + Enter to find · / to focus</span>
          </div>
          <div className="query-box">
            <textarea
              ref={textareaRef}
              id="sound-description"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
              }}
              placeholder="e.g. A heavy wooden door creaks open, then slams shut"
              spellCheck
            />
            <button
              className="find-button"
              type="button"
              disabled={!query.trim() || !catalog.length}
              onClick={() => submit()}
            >
              Find category
            </button>
          </div>
          <div className="examples" aria-label="Example searches">
            <span className="examples-label">Try</span>
            {EXAMPLES.map((example) => (
              <button
                className="example-chip"
                key={example}
                type="button"
                onClick={() => useExample(example)}
              >
                {example.replace(/^A /, "")}
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <div className="empty-state">
            <div>
              <strong>The category list did not load.</strong>
              Refresh the page to try again.
            </div>
          </div>
        ) : !catalog.length ? (
          <LoadingResults />
        ) : primary ? (
          <div className="results" aria-live="polite">
            <article className="primary-result">
              <p className="section-label">Best lead for “{submittedQuery}”</p>
              <div className="catid-row">
                <span className="catid">{primary.entry.catid}</span>
                <button
                  className="copy-button"
                  type="button"
                  onClick={() => copyCatId(primary)}
                  aria-label={`Copy ${primary.entry.catid}`}
                >
                  {copied === primary.entry.catid ? "Copied" : "Copy CatID"}
                </button>
              </div>
              <h2 className="category-path">
                {primary.entry.category} <span aria-hidden="true">›</span>{" "}
                {primary.entry.subcategory}
              </h2>
              <p className="explanation">
                {primary.entry.explanations ||
                  `${primary.entry.category} sounds in the ${primary.entry.subcategory} subcategory.`}
              </p>
              {!!primary.reasons.length && (
                <>
                  <p className="reason-label">Why it surfaced</p>
                  <div className="reasons">
                    {primary.reasons.map((reason) => (
                      <span className="reason" key={`${reason.label}-${reason.value}`}>
                        {reason.label}: {reason.value}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </article>

            <aside className="alternates" aria-label="Other likely categories">
              <p className="section-label">Other likely homes</p>
              <div className="alternate-list">
                {alternates.map((match) => {
                  const actualIndex = matches.indexOf(match);
                  return (
                    <button
                      className="alternate"
                      type="button"
                      key={match.entry.catid}
                      onClick={() => setSelectedIndex(actualIndex)}
                    >
                      <span className="alternate-topline">
                        <span className="alternate-catid">{match.entry.catid}</span>
                        <span className="alternate-rank">
                          {String(actualIndex + 1).padStart(2, "0")}
                        </span>
                      </span>
                      <span className="alternate-path">
                        {match.entry.category} › {match.entry.subcategory}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </div>
        ) : (
          <div className="empty-state">
            <div>
              <strong>No useful lead yet.</strong>
              Add the source, action, material, or setting and try again.
            </div>
          </div>
        )}
      </section>

      <footer className="fine-print">
        <p>
          Suggestions are starting points, not official classifications. UCS was created by
          Tim Nielsen and Justin Drury. This independent demo uses the public UCS v8.2.1 list.
        </p>
        <p className="local-note">
          {catalog.length
            ? `${topCategories} categories · runs entirely in your browser`
            : "No account · no upload"}
        </p>
      </footer>
    </main>
  );
}

function LoadingResults() {
  return (
    <div className="skeleton-results" aria-label="Loading category suggestions">
      <div className="skeleton-main">
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-line big" />
        <div className="skeleton skeleton-line medium" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line medium" />
      </div>
      <div className="skeleton-side">
        <div className="skeleton skeleton-line medium" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
      </div>
    </div>
  );
}
