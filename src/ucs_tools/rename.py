"""Safe batch renaming of UCS filenames.

Everything here is dry-run by default. Applying a plan writes an undo manifest so
any batch can be reversed. Only the *filename* is ever changed; audio bytes are
never read or written, and files are renamed in place (never moved).

The rename rules are format-only. ``fix-case`` corrects a CatID whose case does
not match the list (we know the correct case authoritatively). ``set-catid``
prepends a CatID that the user supplies. Nothing here guesses a category from the
sound itself.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field

from .catalog import Catalog, default_catalog
from .filename import parse
from .validate import AUDIO_EXTENSIONS

__all__ = ["RenameOp", "Plan", "plan_fix_case", "plan_set_catid", "apply_plan", "undo"]


@dataclass
class RenameOp:
    old_path: str
    new_name: str
    reason: str
    status: str = "planned"  # planned | renamed | skipped

    @property
    def new_path(self) -> str:
        return os.path.join(os.path.dirname(self.old_path), self.new_name)


@dataclass
class Plan:
    ops: list[RenameOp] = field(default_factory=list)

    def __len__(self) -> int:
        return len(self.ops)


def _blocked(src: str, dst: str) -> bool:
    """True if ``dst`` exists as a *different* file than ``src`` (a real
    collision). A case-only rename on a case-insensitive filesystem resolves to
    the same file, which is not a collision."""
    if not os.path.exists(dst):
        return False
    try:
        return not os.path.samefile(src, dst)
    except OSError:
        return True


def _iter_audio(root: str, exts: set[str], recursive: bool):
    for dirpath, _dirs, files in os.walk(root):
        for fname in sorted(files):
            if os.path.splitext(fname)[1].lower() in exts:
                yield os.path.join(dirpath, fname)
        if not recursive:
            break


def plan_fix_case(root: str, catalog: Catalog | None = None,
                  extensions: set[str] | None = None, recursive: bool = True) -> Plan:
    """Plan renames for files whose leading CatID is a real CatID written in the
    wrong case (e.g. ``GUNauto_...`` -> ``GUNAuto_...``)."""
    catalog = catalog or default_catalog()
    exts = extensions or AUDIO_EXTENSIONS
    ops: list[RenameOp] = []
    for path in _iter_audio(root, exts, recursive):
        fname = os.path.basename(path)
        name = parse(fname, catalog)
        if catalog.is_valid(name.catid):
            continue
        alt = catalog.match_case_insensitive(name.catid)
        if alt is None:
            continue
        new_name = alt.catid + fname[len(name.catid):]
        if new_name != fname:
            ops.append(RenameOp(path, new_name, f"CatID case {name.catid} -> {alt.catid}"))
    return Plan(ops)


def plan_set_catid(paths: list[str], catid: str, catalog: Catalog | None = None) -> Plan:
    """Plan prepending ``catid`` to files that do not already begin with a valid
    CatID. The CatID is validated against the list first."""
    catalog = catalog or default_catalog()
    if not catalog.is_valid(catid):
        raise ValueError(f"{catid!r} is not a valid UCS CatID")
    ops: list[RenameOp] = []
    for path in paths:
        fname = os.path.basename(path)
        name = parse(fname, catalog)
        if catalog.is_valid(name.catid):
            continue  # already UCS
        ops.append(RenameOp(path, f"{catid}_{fname}", f"prepend CatID {catid}"))
    return Plan(ops)


def apply_plan(plan: Plan, apply: bool = False, manifest_path: str | None = None) -> dict:
    """Execute (or preview) a plan.

    With ``apply=False`` (default) nothing is renamed; the plan is returned for
    preview. With ``apply=True`` renames run, targets that already exist are
    skipped (never overwritten), and an undo manifest is written.
    """
    done: list[RenameOp] = []
    for op in plan.ops:
        if not apply:
            op.status = "planned"
            continue
        if _blocked(op.old_path, op.new_path):
            op.status = "skipped"
            continue
        os.rename(op.old_path, op.new_path)
        op.status = "renamed"
        done.append(op)

    result = {
        "applied": apply,
        "planned": len(plan.ops),
        "renamed": sum(1 for o in plan.ops if o.status == "renamed"),
        "skipped": sum(1 for o in plan.ops if o.status == "skipped"),
        "ops": [asdict(o) for o in plan.ops],
    }
    if apply and done:
        manifest_path = manifest_path or _default_manifest_path(done[0].old_path)
        with open(manifest_path, "w", encoding="utf-8") as handle:
            json.dump({"renames": [{"from": o.old_path, "to": o.new_path} for o in done]},
                      handle, indent=2)
        result["undo_manifest"] = manifest_path
    return result


def undo(manifest_path: str) -> dict:
    """Reverse a previously applied plan using its undo manifest."""
    with open(manifest_path, encoding="utf-8") as handle:
        manifest = json.load(handle)
    reversed_count = skipped = 0
    for entry in manifest.get("renames", []):
        src, dst = entry["to"], entry["from"]
        if os.path.exists(src) and not _blocked(src, dst):
            os.rename(src, dst)
            reversed_count += 1
        else:
            skipped += 1
    return {"reversed": reversed_count, "skipped": skipped}


def _default_manifest_path(sample_path: str) -> str:
    return os.path.join(os.path.dirname(sample_path), "ucs-rename-undo.json")
