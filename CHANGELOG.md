# Changelog

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Standalone UCS Category Finder browser app: plain-language descriptions to a
  short list of likely UCS v8.2.1 categories, with visible match reasons and
  alternate candidates.
- Fully local browser execution against the bundled public UCS list; no account,
  upload, model, or server-side classifier.
- Responsive, keyboard-accessible demo UI and representative matcher tests.

## [0.1.0] - 2026-07-06

### Added
- Bundled official UCS v8.2.1 category list (753 subcategories, 82 categories),
  English columns, cited as public domain.
- `ucs parse`: parse a UCS filename into its blocks (CatID, FXName, CreatorID,
  SourceID, and the optional UserCategory / VendorCategory / UserData).
- `ucs compose`: build a compliant filename from parts, with round-trip safety
  checks.
- `ucs validate`: validate a file or a whole folder tree; reports CatID-valid
  (the hard requirement) versus full four-block compliance, with a summary and a
  non-zero exit code when anything fails.
- `ucs lookup`: CatID to Category/SubCategory (and the reverse), with the
  official explanation and synonyms.
- `ucs rename`: dry-run by default, `--apply` to execute, always writes an undo
  manifest, never touches audio bytes. Rules: `--fix-case` (correct a CatID's
  case to match the list) and `--set-catid` (prepend a user-supplied CatID).
- Importable as a library (`ucs_tools.parse`, `ucs_tools.compose`,
  `ucs_tools.default_catalog`, ...).
