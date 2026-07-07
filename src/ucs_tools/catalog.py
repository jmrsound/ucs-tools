"""The UCS category catalog: load the list, look CatIDs up, validate them.

The catalog is the source of truth for what a valid CatID is. Everything else in
this package (parsing, validation, renaming) defers to it. Lookups are exact
string matches only; there is deliberately no fuzzy or semantic matching here.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from importlib import resources

__all__ = ["Category", "Catalog", "default_catalog", "BUNDLED_VERSION"]

BUNDLED_VERSION = "8.2.1"
_BUNDLED_FILE = "ucs_v8.2.1.csv"


@dataclass(frozen=True)
class Category:
    """One UCS Category/SubCategory entry."""

    catid: str
    category: str
    subcategory: str
    cat_short: str = ""
    explanations: str = ""
    synonyms: tuple[str, ...] = ()

    @property
    def category_full(self) -> str:
        """The Category-SubCategory pair, e.g. ``GUNS-AUTOMATIC``."""
        return f"{self.category}-{self.subcategory}"


class Catalog:
    """An in-memory UCS category list keyed by CatID (case-sensitive)."""

    def __init__(self, entries: list[Category], version: str = "") -> None:
        self.version = version
        self._by_id: dict[str, Category] = {e.catid: e for e in entries}
        # exact reverse lookup on (CATEGORY, SUBCATEGORY), upper-cased
        self._by_pair: dict[tuple[str, str], Category] = {
            (e.category.upper(), e.subcategory.upper()): e for e in entries
        }

    def __len__(self) -> int:
        return len(self._by_id)

    def __contains__(self, catid: object) -> bool:
        return catid in self._by_id

    @property
    def categories(self) -> list[str]:
        """Sorted distinct top-level category names."""
        return sorted({e.category for e in self._by_id.values()})

    def all(self) -> list[Category]:
        return list(self._by_id.values())

    def is_valid(self, catid: str) -> bool:
        """True if ``catid`` is an exact CatID in the list (case-sensitive)."""
        return catid in self._by_id

    def get(self, catid: str) -> Category | None:
        """The entry for ``catid``, or None if it is not a valid CatID."""
        return self._by_id.get(catid)

    def match_case_insensitive(self, catid: str) -> Category | None:
        """Find an entry whose CatID equals ``catid`` ignoring case. Useful for
        reporting "you wrote GUNauto, the correct case is GUNAuto"."""
        low = catid.lower()
        for entry in self._by_id.values():
            if entry.catid.lower() == low:
                return entry
        return None

    def by_pair(self, category: str, subcategory: str) -> Category | None:
        """Reverse lookup: an exact Category + SubCategory pair to its entry."""
        return self._by_pair.get((category.upper(), subcategory.upper()))

    @classmethod
    def from_csv(cls, path: str, version: str = "") -> Catalog:
        """Load a catalog from a CSV with at least CatID, Category, SubCategory
        columns (CatShort, Explanations, Synonyms optional)."""
        entries: list[Category] = []
        with open(path, encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                catid = (row.get("CatID") or "").strip()
                if not catid:
                    continue
                syn = (row.get("Synonyms") or "").strip()
                entries.append(
                    Category(
                        catid=catid,
                        category=(row.get("Category") or "").strip(),
                        subcategory=(row.get("SubCategory") or "").strip(),
                        cat_short=(row.get("CatShort") or "").strip(),
                        explanations=(row.get("Explanations") or "").strip(),
                        synonyms=tuple(
                            s.strip() for s in syn.split(",") if s.strip()
                        ),
                    )
                )
        return cls(entries, version=version)


@lru_cache(maxsize=1)
def default_catalog() -> Catalog:
    """The bundled UCS v8.2.1 catalog (loaded once)."""
    with resources.as_file(
        resources.files("ucs_tools.data").joinpath(_BUNDLED_FILE)
    ) as path:
        return Catalog.from_csv(str(path), version=BUNDLED_VERSION)
