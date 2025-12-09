import warnings

WARNING_MSG = """
All future development of 'better-notion-mcp' has moved to 'engram-mcp'.
Please update your tools to use 'engram-mcp' instead.
"""

warnings.warn(WARNING_MSG, DeprecationWarning, stacklevel=2)
print(f"\033[93mWARNING: {WARNING_MSG}\033[0m")

try:
    from engram_mcp import *
except ImportError:
    pass
