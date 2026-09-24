# Wails isolated to the desktop composition root

One Go module (`wyvern-drive`) with independent `cmd/desktop` and `cmd/wyvernd` roots sharing `internal/app`. Only the desktop root imports Wails; domain, repository, filesystem, config, and logging packages compile without Wails or frontend assets. The headless daemon builds with `CGO_ENABLED=0` and its dependency closure must contain no Wails package.
