from ucs_tools.catalog import default_catalog


def test_bundled_catalog_shape():
    cat = default_catalog()
    assert len(cat) == 753
    assert len(cat.categories) == 82
    assert cat.version == "8.2.1"


def test_spec_examples_resolve():
    cat = default_catalog()
    assert cat.get("GUNAuto").category_full == "GUNS-AUTOMATIC"
    assert cat.get("DOORWood").category_full == "DOORS-WOOD"
    assert cat.get("AIRBlow").category == "AIR"


def test_exact_and_case_insensitive():
    cat = default_catalog()
    assert cat.is_valid("GUNAuto")
    assert not cat.is_valid("GUNauto")
    assert cat.match_case_insensitive("gunauto").catid == "GUNAuto"
    assert cat.match_case_insensitive("nope") is None


def test_reverse_pair_lookup():
    cat = default_catalog()
    assert cat.by_pair("GUNS", "AUTOMATIC").catid == "GUNAuto"
    assert cat.by_pair("guns", "automatic").catid == "GUNAuto"
    assert cat.by_pair("GUNS", "NONSENSE") is None
