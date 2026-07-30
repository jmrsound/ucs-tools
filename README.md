![ucs-tools](https://raw.githubusercontent.com/jmrsound/ucs-tools/main/assets/banner.png)

# ucs-tools

A small standalone toolkit for the
[Universal Category System (UCS)](https://universalcategorysystem.com), the
public standard for naming sound-effects files. Describe a sound in the browser
to find likely categories, or use the exact command-line and Python tools to
parse, compose, validate, look up, and safely rename UCS filenames.

One piece of an open toolkit for post-production audio, built by a working
post-audio editor (J Murphy Ryan) who got tired of doing this by hand.

## What UCS is

The Universal Category System is a public-domain category list (82 categories,
753 subcategories) that gives every sound effect a consistent CatID and filename
structure, so libraries from different creators sort and search the same way. The
one hard rule is a valid CatID at the head of the filename:

```
CatID_FXName_CreatorID_SourceID
```

for example `GUNAuto_Uzi Bursts_TN_DORY.wav`, where `GUNAuto` is the CatID for
GUNS / AUTOMATIC. `ucs-tools` bundles the official **UCS v8.2.1** list and works
entirely against it.

## Try the category finder

**[Open UCS Category Finder](https://ucs-category-finder.openai.site)**

Describe a sound in ordinary language and it returns a short set of likely UCS
homes, with the public-list terms that caused each match. It loads all 753
subcategories into the browser and runs there: no account, upload, model, or
server-side classifier.

The finder suggests starting points rather than making an official
classification. The result stays inspectable, and the editor keeps the call.

## Install

```bash
pip install git+https://github.com/jmrsound/ucs-tools
```

Or from a checkout, which is the better route if you want to run the tests:

```bash
git clone https://github.com/jmrsound/ucs-tools
cd ucs-tools
pip install -e .
```

Either way you get the `ucs` command and the importable `ucs_tools` package. No
dependencies beyond the standard library. Python 3.11 or newer.

Not on PyPI yet.

## Commands

### validate

Check one file, or a whole tree, against the list:

```
ucs validate /path/to/library
```

It reports two levels: **valid CatID** (the one hard UCS requirement) versus
**full** (all four recommended blocks present), with a summary and a non-zero
exit code if anything fails, so it drops into a pre-delivery check or CI.

### parse

```
ucs parse "GUNAuto-INT_UZI 9mm-Rapid Fire_TN_DORY_WideMKH8020.wav"
```

Breaks the name into CatID, FXName, CreatorID, SourceID and the optional
UserCategory / VendorCategory / UserData blocks. The UserCategory tail is
disambiguated against the real list, so `GUNAuto-INT` splits only because
`GUNAuto` is a genuine CatID.

### compose

```
ucs compose --catid GUNAuto --fx "Uzi Bursts" --creator TN --source DORY --ext .wav
```

Builds a compliant filename from parts and refuses inputs that would not
round-trip (an underscore inside a block, for instance).

### lookup

```
ucs lookup GUNAuto
ucs lookup GUNS AUTOMATIC
```

CatID to Category / SubCategory and back, with the official explanation and
synonyms.

### rename

Dry-run by default. Nothing changes until you pass `--apply`, and every apply
writes an undo manifest.

```
ucs rename --fix-case /path/to/library            # preview case fixes
ucs rename --fix-case /path/to/library --apply    # do them, write undo manifest
ucs rename --undo /path/to/library/ucs-rename-undo.json
```

`--fix-case` corrects a CatID whose case does not match the list (the case is
part of the standard). `--set-catid AIRBlow file1.wav file2.wav` prepends a CatID
you supply to files that do not have one.

## Library

```python
from ucs_tools import parse, compose, default_catalog

name = parse("GUNAuto_Uzi Bursts_TN_DORY.wav")
name.catid            # "GUNAuto"
name.creator_id       # "TN"

cat = default_catalog()
cat.is_valid("GUNAuto")             # True
cat.get("GUNAuto").category_full    # "GUNS-AUTOMATIC"
```

## Browser app

The category finder lives in [`web/`](web/) and is intentionally separate from
the Python package:

```bash
cd web
npm install
npm test
npm run dev
```

It uses only the bundled public UCS v8.2.1 columns: Category, SubCategory, CatID,
CatShort, Explanations, and Synonyms.

## Example session

<!-- DEMO:START -->
A real run against a mixed folder of sound-effects files.

Validate the whole folder:

```
$ ucs validate ./sfx
ok  AIRBlow_Quick Puff.wav [minimal] missing CreatorID; missing SourceID
ok  DOORWood_Heavy Prison Slam_TN_LIB.wav [full]
BAD DOORwood_Creaky Hinge_TN_LIB.wav [non_ucs] CatID 'DOORwood' has the wrong case; the list uses 'DOORWood'
ok  GUNAuto_Uzi 9mm Bursts_TN_DORY.wav [full]
BAD scene 7 ambience raw.wav [non_ucs] CatID 'scene 7 ambience raw' is not in the UCS list

3/5 have a valid CatID (full=2, minimal=1, non-UCS=2)
```

Parse a fully-loaded name into its blocks:

```
$ ucs parse "GUNAuto-INT_UZI 9mm-Rapid Fire_TN_DORY_MKH8040.wav"
{
  "catid": "GUNAuto",
  "fxname": "Rapid Fire",
  "creator_id": "TN",
  "source_id": "DORY",
  "user_category": "INT",
  "vendor_category": "UZI 9mm",
  "user_data": "MKH8040"
}
```

Look a CatID up (or go the other way):

```
$ ucs lookup GUNAuto
GUNAuto  =  GUNS-AUTOMATIC
  Fully automatic capable weapons, even when firing singly. Machine guns.
```

Fix a wrong-case CatID, safely. Dry-run first, then apply, then it is
reversible, and the audio bytes are untouched (only the name changed):

```
$ ucs rename --fix-case ./sfx
  would DOORwood_Creaky Hinge_TN_LIB.wav  ->  DOORWood_Creaky Hinge_TN_LIB.wav

$ ucs rename --fix-case ./sfx --apply
  -> DOORwood_Creaky Hinge_TN_LIB.wav  ->  DOORWood_Creaky Hinge_TN_LIB.wav
1 renamed
undo manifest: ./sfx/ucs-rename-undo.json
```
<!-- DEMO:END -->

## Scope

The CLI and Python library remain **format-only**: exact string and structural
operations against the official list. They do not guess or assign categories.

The optional browser finder is a separate, explainable text lookup over the
public category names, explanations, and synonyms. It suggests several
candidates from a written description; it does not inspect audio, silently tag
files, learn from users, or depend on a hosted model.

## Safety

- `rename` is dry-run by default; `--apply` is required to change anything.
- Every applied batch writes an undo manifest, and `--undo` reverses it.
- Renames happen in place and only change the filename. Audio bytes are never
  read or written, so a rename cannot corrupt a file.
- A rename never overwrites an existing target; collisions are skipped and
  reported.

## The bundled list

The bundled data is the official UCS v8.2.1 English list (public domain). See
[`src/ucs_tools/data/PROVENANCE.md`](src/ucs_tools/data/PROVENANCE.md). To use a
different or newer list, pass `--catalog /path/to.csv` (any CSV with `CatID`,
`Category`, `SubCategory` columns).

## Roadmap

- Export a validation report to CSV / JSON.
- More rename rules (compose from a spreadsheet of fields).
- Optional bundled translations for non-English workflows.

## Credits

UCS is a public-domain standard created by Tim Nielsen and Justin Drury. This is
an independent tool that uses the public list; it is not affiliated with or
endorsed by the UCS project. Built by J Murphy Ryan, post audio.

<!-- RELATED-WORK: reserved; empty until the funnel is deliberately turned on -->

## License

MIT. See [LICENSE](LICENSE).

The bundled UCS category list is public domain and is not covered by that
licence — see [NOTICE](NOTICE) for attribution and
[`src/ucs_tools/data/PROVENANCE.md`](src/ucs_tools/data/PROVENANCE.md) for sourcing.
