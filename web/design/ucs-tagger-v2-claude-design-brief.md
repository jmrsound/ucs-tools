# Claude Design Brief — UCS Tagger Showcase v2

## Assignment

Redesign the existing public UCS Tagger at
`https://murphyryan.com/ucs-tagger/` as a polished, responsive, interactive
showcase for a working browser-local tool.

This is a design pass over a real product, not a speculative landing page.
Preserve the complete working surface and make it feel credible enough to
demonstrate directly to Tim Nielsen. Produce an implementation-ready handoff
with real HTML/CSS/interaction structure, not a screenshot-only concept.

The central product truth:

> A sound editor describes a sound in ordinary language. The tool searches the
> public UCS v8.2.1 category list in the browser and returns an inspectable best
> lead plus useful alternatives.

The matcher is helpful but not magical. The interface must make a strong
recommendation without pretending it is an official or infallible
classification.

## Existing Product

- Live surface: `https://murphyryan.com/ucs-tagger/`
- Source: `https://github.com/jmrsound/ucs-tools`
- Framework: React, rendered as a standalone Vite bundle
- Catalog: public UCS v8.2.1 CSV, 82 categories and 753 subcategories
- Runtime: entirely in the browser
- Privacy: no account, analytics, upload, model call, API request, saved search,
  or server-side classifier
- Relationship to other products: none. Do not mention or connect Spotsheet.

## Design Goal

Make the tool feel like a precise sound-editor utility that happens to be
beautiful enough to show off.

The desired first impression is:

- calm, exact, and made by someone who works in post audio;
- immediately interactive, with the query field as the obvious starting point;
- transparent about why a result surfaced;
- honest about ambiguity, with alternatives treated as part of the answer;
- local and private without making privacy copy feel defensive;
- compact enough to use repeatedly, but spacious enough for a live demo.

This is not a SaaS homepage. Do not add pricing, testimonials, feature grids,
signup prompts, social proof, waitlists, or a second marketing CTA.

## What Must Improve

1. Reduce the feeling of a generic large-hero web template. The tool should win
   the hierarchy, not the headline.
2. Turn the result into a clear taxonomy decision: CatID first, then
   Category › Subcategory, then the official explanation.
3. Make “why it surfaced” genuinely useful rather than ornamental metadata.
4. Give alternatives enough weight that a user can correct an imperfect best
   lead in one click.
5. Make the local-browser behavior legible at a glance.
6. Improve the demonstration rhythm: example → result → inspect → choose or
   copy.
7. Preserve a stable layout during CSV loading and result changes.

## Non-Goals

- Do not redesign or change the matcher.
- Do not invent confidence percentages, accuracy claims, or “AI certainty.”
- Do not add audio analysis, waveform upload, drag-and-drop, file renaming, or
  filename validation to this page.
- Do not add a backend, authentication, storage, telemetry, or analytics.
- Do not turn this into a general `ucs-tools` documentation site.
- Do not imitate a DAW, Soundminer, or Pro Tools chrome.
- Do not imply that a suggestion is an official UCS ruling.

## Do-Not-Drop Inventory

The current live page contains every item below. The new design must preserve
all of them:

- UCS Tagger wordmark/product identity
- Catalog state: loading and `UCS v8.2.1 · 753 subcategories`
- Plain-language sound-description textarea
- Primary `Find category` action
- keyboard instruction: Command/Control + Enter to run and `/` to focus
- four reliable example searches
- best-lead label that repeats the submitted query
- prominent CatID
- `Copy CatID` action and temporary copied confirmation
- Category › Subcategory path
- public UCS explanation
- inspectable match reasons with both reason label and matched value
- ranked alternatives with CatID, rank, category, and subcategory
- click an alternative to make it the selected primary result
- loading skeleton
- catalog-load error state
- no-useful-match state
- 82-category count
- “runs entirely in your browser” privacy statement
- attribution to Tim Nielsen and Justin Drury
- statement that suggestions are starting points, not official classifications

## Information Architecture

Design one focused application page with four vertical zones.

### 1. Compact utility masthead

- Left: `UCS TAGGER` wordmark in restrained type, no decorative logo symbol.
- Right: a compact catalog/runtime status line.
- Loaded state should read approximately:
  `UCS v8.2.1 · 753 subcategories · Local`
- “Local” may use a quiet status dot, but do not turn it into a badge.
- Keep this zone short. It should feel like tool chrome, not site navigation.

### 2. Intro plus query instrument

- One concise heading: `Describe a sound. Find its UCS home.`
- One supporting sentence at most.
- The query field is the visual winner on initial load.
- Use a generous textarea, but keep the overall unit compact enough that the
  top result is visible on a typical laptop without a long scroll.
- Put the action inside or immediately adjacent to the query instrument.
- Place keyboard guidance where it can be discovered without competing.
- Present examples as a restrained “Try:” row of text actions, not a farm of
  rounded marketing pills.
- Include the quiet line `Nothing you type leaves this browser.` near the
  query instrument.

### 3. Decision workspace

Use one unified result workspace, not a dashboard of disconnected cards.

Desktop:

- Primary result occupies roughly two thirds of the width.
- Alternatives occupy roughly one third.
- A subtle structural overlap or tuck between query instrument and result
  workspace should create one real depth relationship.

Primary result hierarchy:

1. `Best lead for “…”`
2. CatID
3. Category › Subcategory
4. Official explanation
5. “Why this lead” evidence
6. Copy action

The CatID must be the strongest typographic object after submission. The
Category › Subcategory path must be easy to read aloud during a demo.

Show each match reason as a compact evidence row or token with two visibly
different parts:

- reason type, such as `SUBCATEGORY`, `RELATED TERM`, or `DESCRIPTION`;
- matched value, such as `MACHINE` or `Sci-Fi`.

Do not make these look like celebratory badges. They are audit evidence.

Alternatives:

- Keep four visible on desktop.
- Each row includes rank, CatID, and Category › Subcategory.
- Rows must look selectable.
- Clicking one promotes it into the primary result without rerunning the query.
- The selected row state must remain obvious.
- Do not show a fake confidence percent or score bar.
- Label the section `Other likely homes` to reinforce that ambiguity is normal.

### 4. Quiet footer

- Attribution and caveat on the left.
- Catalog/category count plus local-runtime statement on the right.
- This is fine print, not a second content section.

## Required Interaction States

Create and visually specify all states below with the same geometry wherever
possible:

1. **Catalog loading**
   - Query is visible.
   - Action is disabled.
   - Result workspace renders an exact-size shimmer skeleton.
   - No layout shift when the catalog arrives.

2. **Ready with starter result**
   - Starter query: `A crowd applauding in a theater`
   - Primary CatID: `CRWDApls`
   - Path: `CROWDS › APPLAUSE`

3. **Edited but not submitted**
   - Query text may differ from the displayed result.
   - Action becomes ready.
   - Do not silently update results on every keystroke.

4. **Submitted result**
   - Update query label, primary result, reasons, and alternatives together.
   - No stale content flash.

5. **Alternative selected**
   - Alternative becomes the primary result.
   - Its prior row receives a persistent selected treatment or changes place
     cleanly.

6. **Copy confirmation**
   - Button text changes from `Copy CatID` to `Copied`.
   - No toast stack.

7. **No useful lead**
   - Ask for source, action, material, or setting.
   - Keep the query editable and action available.

8. **Catalog load failure**
   - Plain-language error and `Retry` action.
   - Do not show technical stack text.

9. **Mobile**
   - Single column.
   - Primary result before alternatives.
   - Copy action remains reachable beside or directly below CatID.
   - No horizontal scrolling.

## Reliable Demo Data

Use realistic current results in the design rather than lorem ipsum:

| Query | Best lead | Path |
|---|---|---|
| A crowd applauding in a theater | `CRWDApls` | CROWDS › APPLAUSE |
| A heavy metal security door slams shut | `DOORMetl` | DOORS › METAL |
| A sci-fi machine powering down | `SCIMach` | SCIFI › MACHINE |
| A heavy wooden front door opens | `DOORWood` | DOORS › WOOD |

For the crowd example, include the real explanation:

> Crowds where the applause is predominantly featured. Use CROWDS-CHEERING for
> recordings that are mainly vocals.

Example evidence may include:

- `RELATED TERM · Applaud`
- `CATEGORY · CROWDS`
- `RELATED TERM · Applauding`
- `DESCRIPTION · crowd`

## Visual Direction

Use the visual language of a disciplined metadata inspector, not a futuristic
audio toy.

- Ground: near-black charcoal.
- Surfaces: one step lighter, with steel-blue-gray borders.
- Accent: warm amber used only to rank the active action, CatID, focus, and
  selected evidence.
- Success/status: one restrained desaturated green used only for loaded/local
  state.
- Typography: one clean sans for interface and prose; one true monospace for
  CatIDs, rank, keyboard instructions, and runtime facts.
- Borders should do more work than shadows.
- Corners should be modest, not universally pill-shaped.
- Use spacing and rules to group information instead of wrapping every item in
  a card.
- The page may use a subtle technical grid or registration-line texture at very
  low contrast. It must never compete with text.

Suggested scale:

- Heading: 44–56 px desktop, 34–40 px mobile.
- Query: 19–24 px.
- CatID: 48–64 px desktop, 38–48 px mobile.
- Category path: 22–28 px.
- Body: 14–17 px.
- Metadata: 10–12 px, never below accessible legibility.

## Anti-AI-Slop Calibration

Apply these positions explicitly:

- **Gradient:** if used at all, use one low-delta amber family on one functional
  element only. Never use a gradient field behind the page.
- **Palette:** three committed colors maximum: charcoal/steel neutrals, amber,
  and one muted green status accent. Chroma ranks active information.
- **Hierarchy:** before submission the query instrument wins; after submission
  the CatID wins. The intro, examples, status, and footer are deliberately
  demoted.
- **Depth:** create one real depth relationship by letting the query instrument
  sit slightly above or overlap the unified result workspace. Do not float
  every section independently.
- **Theme device:** any audio/technical motif stays as near-invisible alignment
  texture. No literal waveform hero art.
- **Info lockup:** follow utility-app conventions. No manufactured urgency,
  launch language, “try free,” or marketing CTA.
- **Typeface count:** two roles only—sans and mono.

Hard bans for this surface:

- no emoji or generic line-icon decoration;
- no highlighted single word in the headline;
- no neon glow, bloom, sparkle, light streak, or energy swoosh;
- no distressed/grunge/brush texture;
- no starburst, seal, or promotional badge;
- no floating 3D product;
- no staccato three-word slogan;
- no literal sound cliché iconography;
- no fake app screenshot used as a visual prop;
- no arch, portal, or circle-frame device;
- no generic three-card feature row.

## Integration Contract

The handoff must give the implementation agent clear hooks for the existing
React behavior.

| Design surface | Existing runtime responsibility |
|---|---|
| Query textarea | controlled `query` value and focus ref |
| Find action | calls submit; disabled for empty query or unloaded catalog |
| Example action | sets query and submits that exact text |
| Catalog status | `catalog.length`, load error, category count |
| Primary result | selected `UcsMatch` |
| Copy action | clipboard write and 1.4-second copied state |
| Evidence list | `primary.reasons[]` label/value pairs |
| Alternatives | remaining ranked matches; click sets selected index |
| Loading | catalog request pending |
| Empty/error | existing deterministic branches |

Do not replace these with fake timers, generated data, or new API calls.

## Accessibility and Responsiveness

- Use semantic `main`, `header`, `section`, `article`, `aside`, and `footer`.
- Preserve visible label association with the textarea.
- Maintain clear keyboard focus rings in amber.
- All interactive targets must be at least 44 px on touch layouts.
- Preserve Command/Control + Enter and `/` focus behavior.
- Result changes remain in an `aria-live="polite"` region.
- Color cannot be the only selected-state indicator.
- Meet WCAG AA contrast for all body and control text.
- Respect reduced-motion preferences; shimmer may become a static pulse.
- Design desktop at 1440 × 1000 and mobile at 390 × 844, with a clean tablet
  interpolation.

## Deliverables

1. Production-quality responsive HTML/CSS/JS prototype.
2. Component and state inventory matching this brief.
3. Desktop and mobile views for loading, best-result, alternative-selected,
   no-match, and error states.
4. A small token block covering color, type, spacing, radius, border, shadow,
   and motion.
5. Handoff source whose markup can replace the current React render structure
   while preserving the runtime contract above.

## Acceptance Checklist

- The first viewport makes the tool usable immediately.
- The live product’s full do-not-drop inventory is present.
- The best lead feels decisive without looking infallible.
- Alternatives are clearly actionable, not buried.
- The interface never displays fake accuracy or confidence.
- Local/privacy truth is visible but quiet.
- Loading produces zero layout shift.
- The page reads as a professional sound-editor utility, not an AI-generated
  startup landing page.
- Nothing in the design depends on Spotsheet, a server model, or user tracking.
