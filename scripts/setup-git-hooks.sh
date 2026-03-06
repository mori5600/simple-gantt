#!/bin/sh

set -eu

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
	exit 0
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
