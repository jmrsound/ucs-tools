import pytest

from ucs_tools.filename import ComposeError, compose, parse


def test_parse_four_basic_blocks():
    # the official doc's example
    n = parse("GUNAuto_Uzi 9mm Rapid Fire Close Up Short Bursts_TN_DORY.wav")
    assert n.catid == "GUNAuto"
    assert n.fxname == "Uzi 9mm Rapid Fire Close Up Short Bursts"
    assert n.creator_id == "TN"
    assert n.source_id == "DORY"
    assert n.extension == ".wav"
    assert n.user_category is None


def test_parse_user_category_disambiguated_by_catalog():
    # GUNAuto is a real CatID, so -INT is a UserCategory tail
    n = parse("GUNAuto-INT_Uzi Bursts_TN_DORY.wav")
    assert n.catid == "GUNAuto"
    assert n.user_category == "INT"


def test_parse_hyphen_not_split_when_head_invalid():
    # NOTACAT is not a CatID, so the block stays whole (flagged later by validate)
    n = parse("NOTA-CAT_x_y_z.wav")
    assert n.catid == "NOTA-CAT"
    assert n.user_category is None


def test_parse_vendor_category_and_user_data():
    n = parse("GUNAuto_UZI 9mm-Rapid Fire_TN_DORY_WideStereoMKH8020.wav")
    assert n.vendor_category == "UZI 9mm"
    assert n.fxname == "Rapid Fire"
    assert n.user_data == "WideStereoMKH8020"


def test_parse_extra_underscores_go_to_userdata():
    n = parse("AIRBlow_Puff_TN_LIB_mic_close_perspective.wav")
    assert n.user_data == "mic_close_perspective"


def test_compose_round_trip():
    out = compose("GUNAuto", "Uzi Bursts", "TN", "DORY", extension=".wav")
    assert out == "GUNAuto_Uzi Bursts_TN_DORY.wav"
    n = parse(out)
    assert (n.catid, n.fxname, n.creator_id, n.source_id) == ("GUNAuto", "Uzi Bursts", "TN", "DORY")


def test_compose_with_optionals():
    out = compose("GUNAuto", "Bursts", "TN", "NONE",
                  user_category="EXT", vendor_category="UZI 9mm", user_data="416")
    assert out == "GUNAuto-EXT_UZI 9mm-Bursts_TN_NONE_416"


def test_compose_rejects_underscore_in_block():
    with pytest.raises(ComposeError):
        compose("GUNAuto", "bad_name", "TN", "DORY")
