"""Command-line interface for ucs-tools.

Subcommands: ``parse``, ``compose``, ``validate``, ``rename``, ``lookup``.
Everything is importable as a library too; this is a thin wrapper.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict

from . import __version__
from .catalog import Catalog, default_catalog
from .filename import ComposeError, compose, parse
from .rename import apply_plan, plan_fix_case, plan_set_catid, undo
from .validate import summarize, validate_name, validate_tree


def _load_catalog(path: str | None) -> Catalog:
    return Catalog.from_csv(path) if path else default_catalog()


def _cmd_parse(args) -> int:
    name = parse(args.filename, _load_catalog(args.catalog))
    print(json.dumps({k: v for k, v in asdict(name).items() if v not in (None, "")},
                     indent=2))
    return 0


def _cmd_compose(args) -> int:
    try:
        out = compose(
            args.catid, args.fx, args.creator, args.source,
            user_category=args.user_cat, vendor_category=args.vendor_cat,
            user_data=args.user_data, extension=args.ext or "",
        )
    except ComposeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    cat = _load_catalog(args.catalog)
    if not cat.is_valid(args.catid):
        print(f"warning: CatID {args.catid!r} is not in the UCS list", file=sys.stderr)
    print(out)
    return 0


def _cmd_validate(args) -> int:
    cat = _load_catalog(args.catalog)
    import os
    if os.path.isdir(args.path):
        results = validate_tree(args.path, cat, recursive=not args.no_recursive)
    else:
        results = [validate_name(args.path, cat)]
    if args.json:
        print(json.dumps({"results": [asdict(r) | {"level": r.level.value} for r in results],
                          "summary": summarize(results)}, indent=2, default=str))
    else:
        for r in results:
            flag = "ok " if r.catid_valid else "BAD"
            detail = f" [{r.level.value}]" + (f" {'; '.join(r.issues)}" if r.issues else "")
            print(f"{flag} {r.path}{detail}")
        s = summarize(results)
        print(f"\n{s['compliant']}/{s['total']} have a valid CatID "
              f"(full={s['full']}, minimal={s['minimal']}, non-UCS={s['non_ucs']})")
    # non-zero exit if anything is not at least CatID-valid
    return 0 if all(r.catid_valid for r in results) else 1


def _cmd_rename(args) -> int:
    cat = _load_catalog(args.catalog)
    if args.undo:
        print(json.dumps(undo(args.undo), indent=2))
        return 0
    if args.set_catid:
        plan = plan_set_catid(args.paths, args.set_catid, cat)
    elif args.fix_case:
        if not args.paths:
            print("error: fix-case needs a folder", file=sys.stderr)
            return 2
        plan = plan_fix_case(args.paths[0], cat, recursive=not args.no_recursive)
    else:
        print("error: choose --fix-case, --set-catid CATID, or --undo MANIFEST",
              file=sys.stderr)
        return 2

    result = apply_plan(plan, apply=args.apply, manifest_path=args.manifest)
    for op in result["ops"]:
        mark = {"renamed": "->", "skipped": "skip", "planned": "would"}[op["status"]]
        import os
        old = os.path.basename(op["old_path"])
        print(f"  {mark} {old}  ->  {op['new_name']}  ({op['reason']})")
    verb = "renamed" if args.apply else "planned (dry-run; pass --apply to execute)"
    print(f"\n{result['planned']} {verb}"
          + (f", {result['skipped']} skipped (target existed)" if result["skipped"] else ""))
    if result.get("undo_manifest"):
        print(f"undo manifest: {result['undo_manifest']}")
    return 0


def _cmd_lookup(args) -> int:
    cat = _load_catalog(args.catalog)
    if args.subcategory:  # reverse lookup: category + subcategory -> CatID
        entry = cat.by_pair(args.term, args.subcategory)
    else:
        entry = cat.get(args.term) or cat.match_case_insensitive(args.term)
    if entry is None:
        print(f"no match for {args.term!r}"
              + (f" / {args.subcategory!r}" if args.subcategory else ""), file=sys.stderr)
        return 1
    out = {
        "catid": entry.catid, "category": entry.category,
        "subcategory": entry.subcategory, "category_full": entry.category_full,
        "explanations": entry.explanations,
        "synonyms": list(entry.synonyms),
    }
    print(json.dumps(out, indent=2, ensure_ascii=False) if args.json
          else f"{entry.catid}  =  {entry.category_full}\n  {entry.explanations}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="ucs", description="Universal Category System filename toolkit."
    )
    p.add_argument("--version", action="version", version=f"ucs-tools {__version__}")
    sub = p.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--catalog", help="path to an alternate UCS category CSV")

    sp = sub.add_parser("parse", parents=[common], help="parse a UCS filename into its parts")
    sp.add_argument("filename")
    sp.set_defaults(func=_cmd_parse)

    sc = sub.add_parser("compose", parents=[common], help="compose a UCS filename from parts")
    sc.add_argument("--catid", required=True)
    sc.add_argument("--fx", required=True, help="FXName")
    sc.add_argument("--creator", required=True, help="CreatorID")
    sc.add_argument("--source", required=True, help="SourceID")
    sc.add_argument("--user-cat")
    sc.add_argument("--vendor-cat")
    sc.add_argument("--user-data")
    sc.add_argument("--ext", help="extension incl. dot, e.g. .wav")
    sc.set_defaults(func=_cmd_compose)

    sv = sub.add_parser("validate", parents=[common], help="validate a file or a folder tree")
    sv.add_argument("path")
    sv.add_argument("--json", action="store_true")
    sv.add_argument("--no-recursive", action="store_true")
    sv.set_defaults(func=_cmd_validate)

    sr = sub.add_parser("rename", parents=[common], help="dry-run batch rename (undo-able)")
    sr.add_argument("paths", nargs="*", help="folder (fix-case) or files (set-catid)")
    sr.add_argument("--fix-case", action="store_true", help="fix CatID case to match the list")
    sr.add_argument("--set-catid", metavar="CATID", help="prepend this CatID to non-UCS files")
    sr.add_argument("--undo", metavar="MANIFEST", help="reverse a prior apply via its manifest")
    sr.add_argument("--apply", action="store_true", help="execute (default is dry-run)")
    sr.add_argument("--manifest", help="path for the undo manifest")
    sr.add_argument("--no-recursive", action="store_true")
    sr.set_defaults(func=_cmd_rename)

    sl = sub.add_parser("lookup", parents=[common],
                        help="look up a CatID, or a Category SubCategory pair")
    sl.add_argument("term", help="a CatID, or a Category if a SubCategory follows")
    sl.add_argument("subcategory", nargs="?", help="reverse lookup: Category SubCategory -> CatID")
    sl.add_argument("--json", action="store_true")
    sl.set_defaults(func=_cmd_lookup)

    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
