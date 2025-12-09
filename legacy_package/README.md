# ⚠️ DEPRECIATED

**`better-notion-mcp` has been renamed to [Engram](https://pypi.org/project/engram-mcp/).**

This package exists only to help you migrate.
Installing this package (`pip install better-notion-mcp`) will automatically install the new `engram-mcp` package.

## Migration Guide

### 1. Uninstall old version
```bash
pip uninstall better-notion-mcp
# or
pipx uninstall better-notion-mcp
```

### 2. Install Engram
```bash
uv tool install engram-mcp
# or
pipx install engram-mcp
```

### 3. Update Configuration
Update your `claude_desktop_config.json` to use `engram-mcp` instead of `better-notion-mcp`.

For full documentation, visit [Engram on PyPI](https://pypi.org/project/engram-mcp/).
