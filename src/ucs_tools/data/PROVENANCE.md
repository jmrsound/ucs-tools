# Bundled data provenance

`ucs_v8.2.1.csv` is the English category list of the **Universal Category System
(UCS) version 8.2.1**, the standard for sound-effects categorization initiated by
Tim Nielsen and Justin Drury.

- Source: the official UCS resources at <https://universalcategorysystem.com>
  (the "UCS v8.2.1 Full List").
- Version: 8.2.1 (the final planned version of the list).
- License: the UCS is a public-domain initiative, freely usable without
  restriction.
- Contents: `Category, SubCategory, CatID, CatShort, Explanations, Synonyms`
  for all 753 subcategories across 82 categories.

The official distribution also includes translations into ~20 languages. Those
columns are intentionally omitted here to keep this a small, English, format-only
toolkit. If you need translations, get the full list from the source above.

To point the tools at a different or newer list, pass `--catalog /path/to.csv`
(any CSV with a `CatID` column plus `Category` and `SubCategory`).
