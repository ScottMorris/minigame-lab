#!/usr/bin/env bash
# Builds the Rust simulation crates for wasm32-unknown-unknown.
#
# (c) Copyright 2026 Liminal HQ, Scott Morris
# SPDX-License-Identifier: Apache-2.0 OR MIT
set -euo pipefail
cd "$(dirname "$0")/.."

PROFILE="${WASM_PROFILE:-release}"
if [ "$PROFILE" = "release" ]; then FLAG="--release"; else FLAG=""; fi

cargo build --workspace --target wasm32-unknown-unknown $FLAG
echo "WASM workspace build complete."
