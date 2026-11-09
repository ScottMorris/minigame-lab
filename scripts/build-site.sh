#!/usr/bin/env bash
# Assembles the Mini Game Lab Hub and all games into dist/ for deployment.
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT
set -euo pipefail
cd "$(dirname "$0")/.."

# 1. Build WASM crates
bash scripts/build-wasm.sh

# 2. Build Hub and all games
echo "Building Hub..."
bun run --cwd games/hub build

for game in cocoa-drop crystal-defender fizz-invaders gloop-slugger gumdrop-pacman pogo-panic fizz-pong defrag; do
  echo "Building $game..."
  bun run --cwd "games/$game" build
done

# 3. Assemble distribution directory
rm -rf dist
mkdir -p dist/games

cp -r games/hub/dist/* dist/

for game in cocoa-drop crystal-defender fizz-invaders gloop-slugger gumdrop-pacman pogo-panic fizz-pong defrag; do
  mkdir -p "dist/games/$game"
  cp -r "games/$game/dist/"* "dist/games/$game/"
done

touch dist/.nojekyll
echo "Site assembled successfully in dist/."
