"""Validate filenames (and whole folders) against the UCS convention.

Two levels are reported, matching the standard:

- **CatID valid** is the only hard UCS requirement: the name begins with a real
  CatID from the list.
- **Full** additionally has the three recommended blocks (FXName, CreatorID,
  SourceID).

Validation is exact and structural. It never guesses a category from meaning.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import StrEnum

from .catalog import Catalog, default_catalog
from .filename import parse

__all__ = ["Level", "Result", "validate_name", "validate_tree", "AUDIO_EXTENSIONS"]

AUDIO_EXTENSIONS = {".wav", ".aif", ".aiff", ".flac", ".mp3", ".ogg", ".bwf", ".w64"}


class Level(StrEnum):
    FULL = "full"          # valid CatID + all recommended blocks
    MINIMAL = "minimal"    # valid CatID, but missing some recommended blocks
    NON_UCS = "non_ucs"    # does not begin with a valid CatID


@dataclass
class Result:
    path: str
    catid: str
    level: Level
    catid_valid: bool
    issues: list[str] = field(default_factory=list)
    suggested_catid: str | None = None

    @property
    def ok(self) -> bool:
        """UCS-compliant at least at the minimum (valid CatID) level."""
        return self.catid_valid


def validate_name(filename: str, catalog: Catalog | None = None) -> Result:
    """Validate a single filename."""
    catalog = catalog or default_catalog()
    name = parse(filename, catalog)
    issues: list[str] = []
    suggested = None

    catid_valid = catalog.is_valid(name.catid)
    if not catid_valid:
        alt = catalog.match_case_insensitive(name.catid)
        if alt is not None:
            suggested = alt.catid
            issues.append(
                f"CatID {name.catid!r} has the wrong case; the list uses "
                f"{alt.catid!r}"
            )
        else:
            issues.append(f"CatID {name.catid!r} is not in the UCS list")

    for label, value in (("FXName", name.fxname), ("CreatorID", name.creator_id),
                         ("SourceID", name.source_id)):
        if not value:
            issues.append(f"missing {label}")
        elif not value.strip():
            issues.append(f"empty {label}")

    if catid_valid:
        level = Level.FULL if not any(i.startswith("missing") or i.startswith("empty")
                                      for i in issues) else Level.MINIMAL
    else:
        level = Level.NON_UCS

    return Result(
        path=os.path.basename(filename),
        catid=name.catid,
        level=level,
        catid_valid=catid_valid,
        issues=issues,
        suggested_catid=suggested,
    )


def validate_tree(
    root: str,
    catalog: Catalog | None = None,
    extensions: set[str] | None = None,
    recursive: bool = True,
) -> list[Result]:
    """Validate every audio file under ``root``. Returns one Result per file."""
    catalog = catalog or default_catalog()
    exts = extensions or AUDIO_EXTENSIONS
    results: list[Result] = []
    for dirpath, _dirs, files in os.walk(root):
        for fname in sorted(files):
            if os.path.splitext(fname)[1].lower() in exts:
                res = validate_name(fname, catalog)
                res.path = os.path.join(dirpath, fname)
                results.append(res)
        if not recursive:
            break
    return results


def summarize(results: list[Result]) -> dict:
    """Counts by level for a batch of results."""
    counts = {level.value: 0 for level in Level}
    for r in results:
        counts[r.level.value] += 1
    counts["total"] = len(results)
    counts["compliant"] = sum(1 for r in results if r.catid_valid)
    return counts
