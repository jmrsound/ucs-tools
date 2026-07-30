"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchUcs, parseUcsCsv, type MatchReason, type UcsCategory, type UcsMatch } from "./ucs";

const STARTER_QUERY = "A crowd applauding in a theater";

const EXAMPLES = [
  "A crowd applauding in a theater",
  "A heavy metal security door slams shut",
  "A sci-fi machine powering down",
  "A heavy wooden front door opens",
];

const PROMPTS = [
  { label: "Source", hint: "What object or creature made it — a door, a crowd, a motor." },
  { label: "Action", hint: "What happened to it — slams, opens, powers down, scrapes." },
  { label: "Material", hint: "What it is made of — metal, wood, glass, gravel." },
  { label: "Setting", hint: "Where it happened — a theatre, a street, a hangar." },
];

const RANKED_LIMIT = 5;
const SKELETON_WIDTHS = ["86%", "72%", "91%", "64%", "79%"];
const SKELETON_REASON_WIDTHS = ["74%", "58%", "66%", "48%"];

type CatalogState = "loading" | "ready" | "error";

/* Evidence is audit, not a trophy shelf: at most two rows of any one reason
   type, four total, strongest type first. Two types minimum whenever the data
   allows it — four RELATED TERM rows say nothing, while SUBCATEGORY / RELATED
   TERM / CATEGORY tells you the match came from more than one direction.
   Presentation only: matchUcs itself is untouched. */
const REASON_RANK: Record<string, number> = {
  "Exact CatID": 7,
  Subcategory: 6,
  "Related term": 5,
  Category: 4,
  "Description match": 2,
};

const REASON_DISPLAY: Record<string, string> = {
  "Description match": "Description",
};

function trimReasons(reasons: MatchReason[]): MatchReason[] {
  const ordered = reasons
    .map((reason, index) => ({ reason, index }))
    .sort(
      (left, right) =>
        (REASON_RANK[right.reason.label] ?? 1) - (REASON_RANK[left.reason.label] ?? 1) ||
        left.index - right.index,
    );

  const perType: Record<string, number> = {};
  const kept: MatchReason[] = [];
  for (const { reason } of ordered) {
    perType[reason.label] = (perType[reason.label] ?? 0) + 1;
    if (perType[reason.label] <= 2 && kept.length < 4) kept.push(reason);
  }
  return kept;
}

/* A one-row alternatives panel gives nobody anything to correct the lead with.
   When the query only touches one or two entries, fill the ranked list out
   deterministically and honestly: sibling subcategories of the top hit's
   category first — a sound that belongs in DOORS-METAL plausibly belongs in
   another DOORS subcategory — then the categories nearest the top hit by shared
   vocabulary. No score is invented; these are list positions, not match
   strengths. With the real 753-subcategory catalog tier one alone will almost
   always suffice, so this normally does nothing at all. */
const VOCAB_STOP = new Set([
  "and",
  "for",
  "from",
  "including",
  "into",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "with",
]);

function vocabulary(entry: UcsCategory): Set<string> {
  return new Set(
    [entry.category, entry.subcategory, ...entry.synonyms]
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 3 && !VOCAB_STOP.has(term)),
  );
}

function backfill(scored: UcsMatch[], catalog: UcsCategory[], limit: number): UcsMatch[] {
  if (scored.length === 0 || scored.length >= limit) return scored;

  const out = scored.slice();
  const taken = new Set(out.map((match) => match.entry.catid));
  const top = out[0].entry;

  for (const entry of catalog) {
    if (out.length >= limit) break;
    if (entry.category === top.category && !taken.has(entry.catid)) {
      out.push({ entry, score: 0, reasons: [] });
      taken.add(entry.catid);
    }
  }
  if (out.length >= limit) return out;

  // Vocabulary only — never the explanation, whose connectives ("including",
  // "sizes") make everything look related to everything. An entry sharing no
  // term is not a likely home, so the panel stays short rather than padding
  // itself with nonsense.
  const topTerms = vocabulary(top);
  const near = catalog
    .filter((entry) => !taken.has(entry.catid))
    .map((entry) => {
      let shared = 0;
      for (const term of vocabulary(entry)) if (topTerms.has(term)) shared += 1;
      return { entry, shared };
    })
    .filter((candidate) => candidate.shared > 0)
    .sort(
      (left, right) =>
        right.shared - left.shared || left.entry.catid.localeCompare(right.entry.catid),
    );

  for (const candidate of near) {
    if (out.length >= limit) break;
    out.push({ entry: candidate.entry, score: 0, reasons: [] });
  }
  return out;
}

export function CategoryFinder() {
  const [catalog, setCatalog] = useState<UcsCategory[]>([]);
  const [catalogState, setCatalogState] = useState<CatalogState>("loading");
  const [query, setQuery] = useState(STARTER_QUERY);
  const [submittedQuery, setSubmittedQuery] = useState(STARTER_QUERY);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [metaKey, setMetaKey] = useState("Ctrl");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const loadCatalog = useCallback(() => {
    setCatalogState("loading");
    let cancelled = false;
    fetch(new URL("ucs_v8.2.1.csv", document.baseURI))
      .then((response) => {
        if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
        return response.text();
      })
      .then((csv) => {
        if (cancelled) return;
        setCatalog(parseUcsCsv(csv));
        setCatalogState("ready");
      })
      .catch(() => {
        if (!cancelled) setCatalogState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => loadCatalog(), [loadCatalog]);

  useEffect(() => {
    const platform =
      typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent;
    if (/Mac|iPhone|iPad/.test(platform)) setMetaKey("⌘");
  }, []);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const ready = catalogState === "ready" && catalog.length > 0;

  const matches = useMemo(() => {
    if (!ready) return [];
    return backfill(matchUcs(submittedQuery, catalog, RANKED_LIMIT), catalog, RANKED_LIMIT);
  }, [catalog, ready, submittedQuery]);

  const primary = matches[selectedIndex] ?? matches[0];
  const hasResult = ready && !!primary;
  const showNoMatch = ready && !primary;
  const reasons = primary ? trimReasons(primary.reasons) : [];
  const categoryCount = useMemo(
    () => new Set(catalog.map((entry) => entry.category)).size,
    [catalog],
  );

  const submitDisabled = !ready || !query.trim();

  const submit = (nextQuery = query) => {
    const trimmed = nextQuery.trim();
    if (!trimmed || !ready) return;
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    setSelectedIndex(0);
    setCopied(false);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const typing =
        !!active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        const element = textareaRef.current;
        if (!element) return;
        element.focus();
        element.setSelectionRange(element.value.length, element.value.length);
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        submit();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const copyCatId = () => {
    if (!primary) return;
    const done = () => {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(primary.entry.catid).then(done, done);
    } else {
      done();
    }
  };

  const asideNote = hasResult
    ? "Click one to make it the shown lead."
    : catalogState === "error"
      ? "Waiting on the catalog."
      : "Ranked next-closest entries.";

  return (
    <div className="ucs-page">
      <header className="ucs-masthead">
        <div className="ucs-measure ucs-masthead-inner">
          <span className="ucs-wordmark">UCS Tagger</span>
          <div className="ucs-status" role="status">
            {catalogState === "loading" && (
              <>
                <span className="ucs-sk ucs-status-skeleton" aria-hidden="true" />
                <span>Loading catalog…</span>
              </>
            )}
            {ready && (
              <>
                <span>UCS v8.2.1</span>
                <span className="ucs-status-rule" aria-hidden="true" />
                <span>{catalog.length} subcategories</span>
                <span className="ucs-status-rule" aria-hidden="true" />
                <span className="ucs-status-local">
                  <span className="ucs-dot" aria-hidden="true" />
                  Local
                </span>
              </>
            )}
            {catalogState === "error" && (
              <span className="ucs-status-local ucs-status-error">
                <span className="ucs-dot" aria-hidden="true" />
                Catalog unavailable
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="ucs-measure ucs-main">
        <section className="ucs-intro" aria-labelledby="ucs-heading">
          <h1 className="ucs-h1" id="ucs-heading">
            Describe a sound. Find its UCS home.
          </h1>
          <p className="ucs-standfirst">
            Plain language in, a category to start from out — searched against the public
            UCS v8.2.1 list.
          </p>

          <div className="ucs-instrument">
            <div className="ucs-instrument-head">
              <label className="ucs-label" htmlFor="ucs-query">
                Sound description
              </label>
              <textarea
                className="ucs-query"
                id="ucs-query"
                ref={textareaRef}
                rows={3}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    submit();
                  }
                }}
                placeholder="A heavy metal security door slams shut"
                spellCheck
              />
            </div>

            <div className="ucs-actions">
              <button
                className="ucs-submit"
                type="button"
                disabled={submitDisabled}
                onClick={() => submit()}
              >
                {catalogState === "loading" ? "Loading catalog…" : "Find category"}
              </button>
              <span className="ucs-keys">
                <b>{metaKey} + Enter</b> to run · <b>/</b> to focus
              </span>
              <span className="ucs-privacy">Nothing you type leaves this browser.</span>
            </div>

            <div className="ucs-examples">
              <span className="ucs-examples-label">Try:</span>
              {EXAMPLES.map((example) => (
                <button
                  className="ucs-example"
                  key={example}
                  type="button"
                  onClick={() => submit(example)}
                >
                  <span>{example}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="ucs-workspace" aria-label="Result workspace">
          <div className="ucs-work">
            <article className="ucs-primary" aria-live="polite">
              {catalogState === "loading" && <PrimarySkeleton />}

              {catalogState === "error" && (
                <div>
                  <p className="ucs-state-label">Catalog did not load</p>
                  <p className="ucs-state-head">The UCS category list couldn&rsquo;t be reached.</p>
                  <p className="ucs-state-copy is-error">
                    Nothing is wrong with what you typed. The list is fetched once when the
                    page opens — try again, and it will search locally from there.
                  </p>
                  <button className="ucs-retry" type="button" onClick={() => loadCatalog()}>
                    Retry
                  </button>
                </div>
              )}

              {showNoMatch && (
                <div>
                  <p className="ucs-state-label is-quiet">
                    No useful lead for <b>&ldquo;{submittedQuery}&rdquo;</b>
                  </p>
                  <p className="ucs-state-head">
                    Nothing in the list matched closely enough to recommend.
                  </p>
                  <p className="ucs-state-copy">
                    Add what the sound <em>is</em>, what it <em>does</em>, what it&rsquo;s{" "}
                    <em>made of</em>, or where it happens. UCS categorises by source before
                    character.
                  </p>
                  <ul className="ucs-prompts">
                    {PROMPTS.map((prompt) => (
                      <li className="ucs-prompt" key={prompt.label}>
                        <span className="ucs-prompt-label">{prompt.label}</span>
                        <span className="ucs-prompt-hint">{prompt.hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasResult && (
                <div>
                  <p className="ucs-lead-label">
                    Best lead for <b>&ldquo;{submittedQuery}&rdquo;</b>
                  </p>

                  <div className="ucs-catid-row">
                    <span className="ucs-catid">{primary.entry.catid}</span>
                    <button
                      className={copied ? "ucs-copy is-copied" : "ucs-copy"}
                      type="button"
                      onClick={copyCatId}
                      aria-label={`Copy ${primary.entry.catid}`}
                    >
                      {copied ? "Copied" : "Copy CatID"}
                    </button>
                  </div>

                  <p className="ucs-path">
                    {primary.entry.category}
                    <i> › </i>
                    {primary.entry.subcategory}
                  </p>

                  <div className="ucs-explain">
                    <p className="ucs-explain-body">
                      {primary.entry.explanations ||
                        `${primary.entry.category} sounds in the ${primary.entry.subcategory} subcategory.`}
                    </p>
                    <p className="ucs-explain-source">Quoted from the public UCS list</p>
                  </div>

                  {reasons.length > 0 && (
                    <div>
                      <p className="ucs-why-label">Why this lead</p>
                      <ul className="ucs-reasons">
                        {reasons.map((reason) => (
                          <li className="ucs-reason" key={`${reason.label}-${reason.value}`}>
                            <span className="ucs-reason-label">
                              {REASON_DISPLAY[reason.label] ?? reason.label}
                            </span>
                            <span className="ucs-reason-value">{reason.value}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="ucs-reasons-note">
                        Terms from your description that appear in this entry. A match is
                        evidence, not a ruling.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </article>

            <aside className="ucs-aside" aria-label="Other likely homes">
              <div className="ucs-aside-head">
                <p className="ucs-aside-title">Other likely homes</p>
                <p className="ucs-aside-note">{asideNote}</p>
              </div>

              {catalogState === "loading" && <AlternatesSkeleton />}

              {hasResult && (
                <>
                  <ul className="ucs-alts">
                    {matches.map((match, index) => {
                      const selected = index === selectedIndex;
                      return (
                        <li key={match.entry.catid}>
                          <button
                            className={selected ? "ucs-alt is-selected" : "ucs-alt"}
                            type="button"
                            aria-current={selected ? "true" : "false"}
                            onClick={() => {
                              if (index === selectedIndex) return;
                              setSelectedIndex(index);
                              setCopied(false);
                            }}
                          >
                            <span className="ucs-alt-rank">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="ucs-alt-catid">{match.entry.catid}</span>
                            <span className="ucs-alt-path">
                              {match.entry.category}
                              <span> › </span>
                              <b>{match.entry.subcategory}</b>
                            </span>
                            {selected && <span className="ucs-alt-shown">Shown</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="ucs-aside-foot">
                    Ambiguity is normal — several categories can legitimately hold one sound.
                    Pick the one your library already uses.
                  </p>
                </>
              )}

              {catalogState === "loading" && (
                <p className="ucs-aside-foot">
                  Ambiguity is normal — several categories can legitimately hold one sound.
                  Pick the one your library already uses.
                </p>
              )}

              {showNoMatch && (
                <div className="ucs-aside-block">
                  <p>
                    No alternatives to rank yet. Once a description names a source, the
                    closest four appear here.
                  </p>
                </div>
              )}

              {catalogState === "error" && (
                <div className="ucs-aside-block">
                  <p>Alternatives come from the same local list, so they&rsquo;ll return with it.</p>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      <footer className="ucs-footer">
        <div className="ucs-measure ucs-footer-inner">
          <div className="ucs-footer-left">
            <p>
              Universal Category System by Tim Nielsen and Justin Drury. Suggestions here are
              starting points, not official classifications.
            </p>
            <p>Read the entry, then decide.</p>
          </div>
          <p className="ucs-footer-right">
            {ready ? `${categoryCount} categories · ${catalog.length} subcategories` : "Public UCS v8.2.1 list"}
            <br />
            Runs entirely in your browser
          </p>
        </div>
      </footer>
    </div>
  );
}

/* The skeletons reuse the real row markup so the box is identical by
   construction at every width — zero layout shift when the catalog lands. */

function PrimarySkeleton() {
  return (
    <div>
      <p className="ucs-sk-lead">
        <span className="ucs-sk" style={{ width: "min(268px, 74%)", height: "0.66em" }} />
      </p>
      <div className="ucs-catid-row">
        <span className="ucs-sk-catid">
          <span className="ucs-sk" style={{ width: "min(300px, 72%)", height: "0.78em" }} />
        </span>
        <span className="ucs-sk ucs-sk-copy" />
      </div>
      <p className="ucs-sk-path">
        <span className="ucs-sk" style={{ width: "min(272px, 66%)", height: "0.72em" }} />
      </p>
      <div className="ucs-explain">
        <p className="ucs-explain-body" style={{ minHeight: 0 }}>
          <span className="ucs-sk" style={{ width: "100%", height: "0.6em" }} />
          <br />
          <span className="ucs-sk" style={{ width: "100%", height: "0.6em" }} />
          <br />
          <span className="ucs-sk" style={{ width: "56%", height: "0.6em" }} />
        </p>
        <p className="ucs-explain-source">
          <span className="ucs-sk" style={{ width: "172px", height: "0.7em" }} />
        </p>
      </div>
      <div>
        <p className="ucs-sk-why">
          <span className="ucs-sk" style={{ width: "98px", height: "0.7em" }} />
        </p>
        <ul className="ucs-reasons">
          {SKELETON_REASON_WIDTHS.map((width) => (
            <li className="ucs-reason is-skeleton" key={width}>
              <span className="ucs-reason-label">
                <span className="ucs-sk" style={{ width: "86%", height: "0.7em" }} />
              </span>
              <span className="ucs-reason-value">
                <span className="ucs-sk" style={{ width, height: "0.66em" }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="ucs-sk-note">
          <span className="ucs-sk" style={{ width: "100%", height: "0.6em" }} />
          <br />
          <span className="ucs-sk" style={{ width: "42%", height: "0.6em" }} />
        </p>
      </div>
    </div>
  );
}

function AlternatesSkeleton() {
  return (
    <ul className="ucs-alts">
      {SKELETON_WIDTHS.map((width) => (
        <li key={width}>
          <div className="ucs-alt is-skeleton">
            <span className="ucs-alt-rank">
              <span className="ucs-sk" style={{ width: "100%", height: "0.7em" }} />
            </span>
            <span className="ucs-alt-catid">
              <span className="ucs-sk" style={{ width: "100%", height: "0.72em" }} />
            </span>
            <span className="ucs-alt-path">
              <span className="ucs-sk" style={{ width, height: "0.66em" }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
