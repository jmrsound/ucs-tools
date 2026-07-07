import hashlib
import os

from ucs_tools.rename import apply_plan, plan_fix_case, plan_set_catid, undo


def _sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_fix_case_dry_run_then_apply_then_undo(tmp_path):
    # check the REAL on-disk name via listdir, since this filesystem may be
    # case-insensitive (where Path.exists() ignores case).
    def wavs():
        return sorted(n for n in os.listdir(tmp_path) if n.endswith(".wav"))

    f = tmp_path / "GUNauto_Uzi Bursts_TN_DORY.wav"
    f.write_bytes(b"RIFF....fake audio bytes....")
    before = _sha(f)

    plan = plan_fix_case(str(tmp_path))
    assert len(plan) == 1

    apply_plan(plan, apply=False)
    assert wavs() == ["GUNauto_Uzi Bursts_TN_DORY.wav"]  # dry run: unchanged

    result = apply_plan(plan, apply=True)
    assert result["renamed"] == 1
    assert wavs() == ["GUNAuto_Uzi Bursts_TN_DORY.wav"]  # case corrected on disk
    # audio bytes are byte-for-byte identical (only the name changed)
    assert _sha(tmp_path / "GUNAuto_Uzi Bursts_TN_DORY.wav") == before

    undo(result["undo_manifest"])
    assert wavs() == ["GUNauto_Uzi Bursts_TN_DORY.wav"]  # back to original case


def test_fix_case_leaves_correct_names_alone(tmp_path):
    (tmp_path / "GUNAuto_ok_TN_DORY.wav").write_bytes(b"x")
    assert len(plan_fix_case(str(tmp_path))) == 0


def test_set_catid_prepends_only_non_ucs(tmp_path):
    (tmp_path / "raw recording 3.wav").write_bytes(b"x")
    (tmp_path / "GUNAuto_already_TN_DORY.wav").write_bytes(b"x")
    files = [str(p) for p in tmp_path.iterdir()]
    plan = plan_set_catid(files, "AIRBlow")
    assert len(plan) == 1
    assert plan.ops[0].new_name == "AIRBlow_raw recording 3.wav"


def test_apply_skips_existing_target(tmp_path):
    # prepending AIRBlow to raw.wav would collide with an existing different file
    (tmp_path / "AIRBlow_raw.wav").write_bytes(b"existing target")
    raw = tmp_path / "raw.wav"
    raw.write_bytes(b"source")
    result = apply_plan(plan_set_catid([str(raw)], "AIRBlow"), apply=True)
    assert result["skipped"] == 1
    assert result["renamed"] == 0
    assert raw.read_bytes() == b"source"  # untouched
