from ucs_tools.validate import Level, validate_name


def test_full_compliance():
    r = validate_name("GUNAuto_Uzi Bursts_TN_DORY.wav")
    assert r.catid_valid
    assert r.level is Level.FULL
    assert r.issues == []


def test_minimal_missing_blocks():
    r = validate_name("GUNAuto_Uzi Bursts.wav")
    assert r.catid_valid
    assert r.level is Level.MINIMAL
    assert any("missing" in i for i in r.issues)


def test_wrong_case_is_flagged_with_suggestion():
    r = validate_name("GUNauto_Uzi_TN_DORY.wav")
    assert not r.catid_valid
    assert r.level is Level.NON_UCS
    assert r.suggested_catid == "GUNAuto"


def test_non_ucs_name():
    r = validate_name("my cool sound 01.wav")
    assert not r.catid_valid
    assert r.level is Level.NON_UCS
