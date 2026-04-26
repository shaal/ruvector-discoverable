# M2 (ripgrep) vs M3 (syn) — Cross-validation

Per-crate item-count comparison. Differences are expected and informative:

- **M2 > M3** — items captured by regex that the AST didn't see. Most common cause: items inside macros, code in `tests/`/`benches/`/`examples/` that ripgrep matched, or modules ripgrep saw but our `mod` resolver didn't link from `lib.rs`.
- **M3 > M2** — items the AST resolved that regex missed. Most common cause: items spanning multiple lines, items inside inline `mod { ... }` blocks ripgrep didn't classify, or `pub` qualifiers ripgrep mis-classified.

## Top 40 crates by absolute M2/M3 delta

| Crate | M2 (rg) | M3 (syn) | Δ |
|---|--:|--:|--:|
| `ruvllm` | 4192 | 1547 | -2645 |
| `prime-radiant` | 2386 | 737 | -1649 |
| `ruvector-postgres` | 2044 | 1001 | -1043 |
| `ruvector-mincut` | 1432 | 479 | -953 |
| `ruvector-graph` | 821 | 329 | -492 |
| `ruvector-attention` | 778 | 329 | -449 |
| `sona` | 575 | 154 | -421 |
| `ruvector-mincut-gated-transformer` | 675 | 260 | -415 |
| `ruvector-nervous-system` | 551 | 147 | -404 |
| `ruQu` | 617 | 216 | -401 |
| `ruvector-math` | 572 | 186 | -386 |
| `ruvllm-wasm` | 497 | 147 | -350 |
| `ruvector-core` | 570 | 224 | -346 |
| `ruvector-cnn` | 622 | 287 | -335 |
| `mcp-brain-server` | 570 | 262 | -308 |
| `ruvector-dag` | 424 | 196 | -228 |
| `ruvector-cli` | 227 | 0 | -227 |
| `ruvector-sparse-inference` | 399 | 177 | -222 |
| `rvlite` | 390 | 176 | -214 |
| `rvf-runtime` | 338 | 139 | -199 |
| `ruqu-core` | 448 | 262 | -186 |
| `ruvector-gnn` | 257 | 84 | -173 |
| `types` | 228 | 65 | -163 |
| `ruvector-graph-transformer` | 290 | 128 | -162 |
| `ruvector-wasm` | 233 | 75 | -158 |
| `qemu-swarm` | 247 | 92 | -155 |
| `cognitum-gate-kernel` | 214 | 63 | -151 |
| `net` | 215 | 65 | -150 |
| `ruvector-robotics` | 314 | 164 | -150 |
| `ruvector-fpga-transformer` | 340 | 191 | -149 |
| `fs` | 193 | 50 | -143 |
| `nucleus` | 185 | 45 | -140 |
| `cap` | 187 | 49 | -138 |
| `rvf-types` | 417 | 282 | -135 |
| `ruvector-attention-node` | 187 | 60 | -127 |
| `dma` | 154 | 31 | -123 |
| `ruvector-exotic-wasm` | 150 | 28 | -122 |
| `rvagent-core` | 240 | 118 | -122 |
| `ruvector-domain-expansion` | 209 | 90 | -119 |
| `vecgraph` | 165 | 47 | -118 |


**Totals.** M2: 33130 items. M3: 13655 items. Δ = -19475.
