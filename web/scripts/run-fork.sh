#!/usr/bin/env bash
set -euo pipefail
# Run from web/. Only pinned upstream source is compiled, in disposable scratch.
basket_root=$(cd .. && pwd)
basket_fork="$basket_root/test/scratch/fork"
basket_upstream='https://raw.githubusercontent.com/identity-md-launches/launch-929-basket/b12f8ecdaac0acc13e47646441b4f312a2aab160'
mkdir -p "$basket_fork/src" "$basket_fork/test"
for basket_file in BaskVault.sol BaskMath.sol; do
  curl -fLsS "$basket_upstream/src/$basket_file" -o "$basket_fork/src/$basket_file"
done
curl -fLsS "$basket_upstream/foundry.toml" -o "$basket_fork/foundry.toml"
cp validation/WebsiteFork.t.sol "$basket_fork/test/WebsiteFork.t.sol"
cp "$basket_root/test/mocks/Mocks.sol" "$basket_fork/test/Mocks.sol"
export BASKET_FORK_BLOCK="${BASKET_FORK_BLOCK:-$(cast block-number --rpc-url https://rpc.mainnet.chain.robinhood.com)}"
forge test --root "$basket_fork" --use "${SOLC:-0.8.26}" --remappings "forge-std/=$basket_root/lib/forge-std/src/" -vv
