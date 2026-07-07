"""ucs-tools: a format-only toolkit for the Universal Category System (UCS)."""

from .catalog import BUNDLED_VERSION, Catalog, Category, default_catalog
from .filename import UCSName, compose, parse

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "BUNDLED_VERSION",
    "Catalog",
    "Category",
    "default_catalog",
    "UCSName",
    "parse",
    "compose",
]
