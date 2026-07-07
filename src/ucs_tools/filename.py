"""Parse and compose UCS filenames.

The UCS filename structure (from the official convention):

    CatID(-UserCategory)_(VendorCategory-)FXName_CreatorID_SourceID_UserData

- Underscores separate the blocks and are not used elsewhere (except that extra
  underscores are tolerated inside the trailing UserData block).
- The only hard requirement of UCS is a valid CatID at the head. The other three
  blocks (FXName, CreatorID, SourceID) are strongly encouraged but optional.
- ``-UserCategory`` is an optional tail on the CatID block. We disambiguate it
  from a hyphen that is simply part of an invalid CatID by checking the head
  against a catalog: ``GUNAuto-INT`` splits only because ``GUNAuto`` is a real
  CatID.
- ``VendorCategory-`` is an optional head on the FXName block. Because FXNames
  may themselves contain hyphens, this split is inherently ambiguous in the
  standard; we surface the structural interpretation and keep the raw block so
  callers can decide.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from .catalog import Catalog, default_catalog

__all__ = ["UCSName", "parse", "compose", "ComposeError"]


class ComposeError(ValueError):
    """A field would produce a filename that cannot round-trip (e.g. an
    underscore in a block that must not contain one)."""


@dataclass
class UCSName:
    """The parsed parts of a UCS filename."""

    catid: str
    fxname: str | None = None
    creator_id: str | None = None
    source_id: str | None = None
    user_category: str | None = None
    vendor_category: str | None = None
    user_data: str | None = None
    extension: str = ""
    fxname_raw: str | None = None  # block 2 before VendorCategory was split off

    @property
    def block_count(self) -> int:
        """How many of the underscore-separated blocks are present."""
        return len([b for b in (self.catid, self.fxname_raw, self.creator_id,
                                 self.source_id, self.user_data) if b is not None])


def parse(filename: str, catalog: Catalog | None = None) -> UCSName:
    """Parse a filename into its UCS parts (structural parse; does not validate
    the CatID against the list beyond disambiguating the UserCategory tail).

    Pass ``catalog`` to control which CatID list is used for that disambiguation;
    defaults to the bundled UCS v8.2.1 list.
    """
    catalog = catalog or default_catalog()
    stem, ext = _split_ext(filename)
    blocks = stem.split("_")

    catid_block = blocks[0]
    catid, user_category = _split_user_category(catid_block, catalog)

    fxname_raw = blocks[1] if len(blocks) >= 2 else None
    vendor_category, fxname = _split_vendor_category(fxname_raw)

    creator_id = blocks[2] if len(blocks) >= 3 else None
    source_id = blocks[3] if len(blocks) >= 4 else None
    # extra underscores are tolerated only inside UserData
    user_data = "_".join(blocks[4:]) if len(blocks) >= 5 else None

    return UCSName(
        catid=catid,
        fxname=fxname,
        creator_id=creator_id,
        source_id=source_id,
        user_category=user_category,
        vendor_category=vendor_category,
        user_data=user_data,
        extension=ext,
        fxname_raw=fxname_raw,
    )


def compose(
    catid: str,
    fxname: str,
    creator_id: str,
    source_id: str,
    *,
    user_category: str | None = None,
    vendor_category: str | None = None,
    user_data: str | None = None,
    extension: str = "",
) -> str:
    """Compose a compliant UCS filename from parts.

    Raises :class:`ComposeError` if any block that must not contain an underscore
    does (which would break parsing). Does not itself verify the CatID; use the
    catalog or :mod:`ucs_tools.validate` for that.
    """
    for label, value in (
        ("catid", catid), ("fxname", fxname), ("creator_id", creator_id),
        ("source_id", source_id), ("user_category", user_category),
        ("vendor_category", vendor_category),
    ):
        if value and "_" in value:
            raise ComposeError(f"{label} must not contain '_': {value!r}")
    if not catid:
        raise ComposeError("catid is required")

    head = catid + (f"-{user_category}" if user_category else "")
    fx_block = (f"{vendor_category}-" if vendor_category else "") + fxname
    parts = [head, fx_block, creator_id, source_id]
    if user_data:
        parts.append(user_data)
    return "_".join(parts) + (extension or "")


def _split_ext(filename: str) -> tuple[str, str]:
    base = os.path.basename(filename)
    stem, ext = os.path.splitext(base)
    return stem, ext


def _split_user_category(catid_block: str, catalog: Catalog) -> tuple[str, str | None]:
    """A valid CatID never contains '-', so a hyphen in the head block marks a
    UserCategory tail only when the part before it is a real CatID."""
    if "-" in catid_block:
        head, tail = catid_block.split("-", 1)
        if catalog.is_valid(head):
            return head, (tail or None)
    return catid_block, None


def _split_vendor_category(fxname_block: str | None) -> tuple[str | None, str | None]:
    if fxname_block is None:
        return None, None
    if "-" in fxname_block:
        vendor, fx = fxname_block.split("-", 1)
        return (vendor or None), fx
    return None, fxname_block
