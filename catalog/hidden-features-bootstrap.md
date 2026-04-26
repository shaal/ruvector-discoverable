# Hidden Features — ADR-orphan crates (M2 bootstrap)

*These crates exist on disk but are referenced by no ADR.*
*Sorted by public-item count — biggest hidden surfaces first. Priority targets for M3.*

## `ruqu-core` — 448 public items (0 NAPI, 0 WASM)
*crates/ruqu-core*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `BackendType` | `crates/ruqu-core/src/backend.rs:21` |
| `struct` | `CircuitAnalysis` | `crates/ruqu-core/src/backend.rs:44` |
| `fn` | `analyze_circuit` | `crates/ruqu-core/src/backend.rs:93` |
| `struct` | `ScalingInfo` | `crates/ruqu-core/src/backend.rs:319` |
| `fn` | `scaling_report` | `crates/ruqu-core/src/backend.rs:336` |
| `struct` | `RoutingResult` | `crates/ruqu-core/src/benchmark.rs:28` |
| `struct` | `RoutingBenchmark` | `crates/ruqu-core/src/benchmark.rs:42` |
| `fn` | `planner_win_rate_vs_naive` | `crates/ruqu-core/src/benchmark.rs:50` |
| `fn` | `median_speedup_vs_naive` | `crates/ruqu-core/src/benchmark.rs:63` |
| `fn` | `run_routing_benchmark` | `crates/ruqu-core/src/benchmark.rs:133` |
| `struct` | `EntanglementBudgetBenchmark` | `crates/ruqu-core/src/benchmark.rs:296` |
| `fn` | `run_entanglement_benchmark` | `crates/ruqu-core/src/benchmark.rs:306` |
| `struct` | `DecoderBenchmarkResult` | `crates/ruqu-core/src/benchmark.rs:389` |
| `fn` | `run_decoder_benchmark` | `crates/ruqu-core/src/benchmark.rs:399` |
| `struct` | `CertificationBenchmark` | `crates/ruqu-core/src/benchmark.rs:486` |
| `fn` | `run_certification_benchmark` | `crates/ruqu-core/src/benchmark.rs:497` |
| `struct` | `FullBenchmarkReport` | `crates/ruqu-core/src/benchmark.rs:597` |
| `fn` | `run_full_benchmark` | `crates/ruqu-core/src/benchmark.rs:606` |
| `fn` | `format_report` | `crates/ruqu-core/src/benchmark.rs:630` |
| `enum` | `GateClass` | `crates/ruqu-core/src/circuit_analyzer.rs:23` |
| `fn` | `classify_gate` | `crates/ruqu-core/src/circuit_analyzer.rs:48` |
| `fn` | `is_clifford_circuit` | `crates/ruqu-core/src/circuit_analyzer.rs:98` |
| `fn` | `count_non_clifford` | `crates/ruqu-core/src/circuit_analyzer.rs:113` |
| `fn` | `entanglement_pairs` | `crates/ruqu-core/src/circuit_analyzer.rs:143` |
| `fn` | `is_nearest_neighbor` | `crates/ruqu-core/src/circuit_analyzer.rs:164` |

_... +423 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-robotics` — 314 public items (0 NAPI, 0 WASM)
*crates/ruvector-robotics*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `DistanceMetric` | `crates/ruvector-robotics/src/bridge/config.rs:7` |
| `struct` | `BridgeConfig` | `crates/ruvector-robotics/src/bridge/config.rs:16` |
| `fn` | `new` | `crates/ruvector-robotics/src/bridge/config.rs:40` |
| `enum` | `ConversionError` | `crates/ruvector-robotics/src/bridge/converters.rs:14` |
| `fn` | `point_cloud_to_vectors` | `crates/ruvector-robotics/src/bridge/converters.rs:35` |
| `fn` | `point_cloud_to_vectors_with_intensity` | `crates/ruvector-robotics/src/bridge/converters.rs:43` |
| `fn` | `vectors_to_point_cloud` | `crates/ruvector-robotics/src/bridge/converters.rs:63` |
| `fn` | `robot_state_to_vector` | `crates/ruvector-robotics/src/bridge/converters.rs:84` |
| `fn` | `vector_to_robot_state` | `crates/ruvector-robotics/src/bridge/converters.rs:93` |
| `fn` | `pose_to_vector` | `crates/ruvector-robotics/src/bridge/converters.rs:109` |
| `fn` | `occupancy_grid_to_vectors` | `crates/ruvector-robotics/src/bridge/converters.rs:122` |
| `fn` | `scene_graph_to_adjacency` | `crates/ruvector-robotics/src/bridge/converters.rs:144` |
| `struct` | `GaussianSplat` | `crates/ruvector-robotics/src/bridge/gaussian.rs:15` |
| `struct` | `GaussianSplatCloud` | `crates/ruvector-robotics/src/bridge/gaussian.rs:35` |
| `fn` | `len` | `crates/ruvector-robotics/src/bridge/gaussian.rs:43` |
| `fn` | `is_empty` | `crates/ruvector-robotics/src/bridge/gaussian.rs:47` |
| `struct` | `GaussianConfig` | `crates/ruvector-robotics/src/bridge/gaussian.rs:54` |
| `fn` | `gaussians_from_cloud` | `crates/ruvector-robotics/src/bridge/gaussian.rs:78` |
| `fn` | `to_viewer_json` | `crates/ruvector-robotics/src/bridge/gaussian.rs:144` |
| `enum` | `IndexError` | `crates/ruvector-robotics/src/bridge/indexing.rs:60` |
| `struct` | `SpatialIndex` | `crates/ruvector-robotics/src/bridge/indexing.rs:123` |
| `fn` | `new` | `crates/ruvector-robotics/src/bridge/indexing.rs:132` |
| `fn` | `with_metric` | `crates/ruvector-robotics/src/bridge/indexing.rs:141` |
| `fn` | `insert_point_cloud` | `crates/ruvector-robotics/src/bridge/indexing.rs:150` |
| `fn` | `insert_vectors` | `crates/ruvector-robotics/src/bridge/indexing.rs:159` |

_... +289 more — see `catalog/inventory-bootstrap.json`_


## `qemu-swarm` — 247 public items (0 NAPI, 0 WASM)
*crates/ruvix/qemu-swarm*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `ClusterStatus` | `crates/ruvix/qemu-swarm/src/cluster.rs:24` |
| `struct` | `ClusterConfig` | `crates/ruvix/qemu-swarm/src/cluster.rs:49` |
| `fn` | `new` | `crates/ruvix/qemu-swarm/src/cluster.rs:92` |
| `fn` | `builder` | `crates/ruvix/qemu-swarm/src/cluster.rs:101` |
| `fn` | `from_file` | `crates/ruvix/qemu-swarm/src/cluster.rs:106` |
| `fn` | `from_swarm_config` | `crates/ruvix/qemu-swarm/src/cluster.rs:112` |
| `fn` | `generate_node_configs` | `crates/ruvix/qemu-swarm/src/cluster.rs:139` |
| `struct` | `NodeOverrides` | `crates/ruvix/qemu-swarm/src/cluster.rs:191` |
| `struct` | `ClusterConfigBuilder` | `crates/ruvix/qemu-swarm/src/cluster.rs:206` |
| `fn` | `new` | `crates/ruvix/qemu-swarm/src/cluster.rs:212` |
| `fn` | `name` | `crates/ruvix/qemu-swarm/src/cluster.rs:219` |
| `fn` | `node_count` | `crates/ruvix/qemu-swarm/src/cluster.rs:225` |
| `fn` | `topology` | `crates/ruvix/qemu-swarm/src/cluster.rs:231` |
| `fn` | `kernel_path` | `crates/ruvix/qemu-swarm/src/cluster.rs:237` |
| `fn` | `dtb_path` | `crates/ruvix/qemu-swarm/src/cluster.rs:243` |
| `fn` | `cpus_per_node` | `crates/ruvix/qemu-swarm/src/cluster.rs:249` |
| `fn` | `memory_per_node` | `crates/ruvix/qemu-swarm/src/cluster.rs:255` |
| `fn` | `enable_gdb` | `crates/ruvix/qemu-swarm/src/cluster.rs:261` |
| `fn` | `work_dir` | `crates/ruvix/qemu-swarm/src/cluster.rs:267` |
| `fn` | `startup_delay` | `crates/ruvix/qemu-swarm/src/cluster.rs:273` |
| `fn` | `build` | `crates/ruvix/qemu-swarm/src/cluster.rs:279` |
| `struct` | `QemuCluster` | `crates/ruvix/qemu-swarm/src/cluster.rs:300` |
| `fn` | `new` | `crates/ruvix/qemu-swarm/src/cluster.rs:322` |
| `fn` | `config` | `crates/ruvix/qemu-swarm/src/cluster.rs:364` |
| `fn` | `status` | `crates/ruvix/qemu-swarm/src/cluster.rs:369` |

_... +222 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-core` — 240 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-core*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `SegmentType` | `crates/rvAgent/rvagent-core/src/agi_container.rs:19` |
| `fn` | `from_u8` | `crates/rvAgent/rvagent-core/src/agi_container.rs:35` |
| `mod` | `agi_tags` | `crates/rvAgent/rvagent-core/src/agi_container.rs:57` |
| `const` | `TOOL_REGISTRY` | `crates/rvAgent/rvagent-core/src/agi_container.rs:58` |
| `const` | `AGENT_PROMPTS` | `crates/rvAgent/rvagent-core/src/agi_container.rs:59` |
| `const` | `SKILL_LIBRARY` | `crates/rvAgent/rvagent-core/src/agi_container.rs:60` |
| `const` | `ORCHESTRATOR` | `crates/rvAgent/rvagent-core/src/agi_container.rs:61` |
| `const` | `MIDDLEWARE_CONFIG` | `crates/rvAgent/rvagent-core/src/agi_container.rs:62` |
| `struct` | `ToolDefinition` | `crates/rvAgent/rvagent-core/src/agi_container.rs:67` |
| `struct` | `AgentPrompt` | `crates/rvAgent/rvagent-core/src/agi_container.rs:76` |
| `struct` | `SkillDefinition` | `crates/rvAgent/rvagent-core/src/agi_container.rs:84` |
| `struct` | `OrchestratorConfig` | `crates/rvAgent/rvagent-core/src/agi_container.rs:93` |
| `struct` | `AgentNode` | `crates/rvAgent/rvagent-core/src/agi_container.rs:101` |
| `struct` | `AgiContainerBuilder` | `crates/rvAgent/rvagent-core/src/agi_container.rs:135` |
| `fn` | `new` | `crates/rvAgent/rvagent-core/src/agi_container.rs:141` |
| `fn` | `with_tools` | `crates/rvAgent/rvagent-core/src/agi_container.rs:148` |
| `fn` | `with_prompts` | `crates/rvAgent/rvagent-core/src/agi_container.rs:159` |
| `fn` | `with_skills` | `crates/rvAgent/rvagent-core/src/agi_container.rs:170` |
| `fn` | `with_orchestrator` | `crates/rvAgent/rvagent-core/src/agi_container.rs:181` |
| `fn` | `build` | `crates/rvAgent/rvagent-core/src/agi_container.rs:202` |
| `fn` | `parse` | `crates/rvAgent/rvagent-core/src/agi_container.rs:228` |
| `struct` | `ParsedContainer` | `crates/rvAgent/rvagent-core/src/agi_container.rs:334` |
| `enum` | `ContainerError` | `crates/rvAgent/rvagent-core/src/agi_container.rs:343` |
| `struct` | `Arena` | `crates/rvAgent/rvagent-core/src/arena.rs:15` |
| `fn` | `new` | `crates/rvAgent/rvagent-core/src/arena.rs:23` |

_... +215 more — see `catalog/inventory-bootstrap.json`_


## `types` — 228 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/types*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `CapHandle` | `crates/ruvix/crates/types/src/capability.rs:13` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:19` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:26` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:33` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:40` |
| `struct` | `CapRights` | `crates/ruvix/crates/types/src/capability.rs:57` |
| `const` | `READ` | `crates/ruvix/crates/types/src/capability.rs:61` |
| `const` | `WRITE` | `crates/ruvix/crates/types/src/capability.rs:64` |
| `const` | `GRANT` | `crates/ruvix/crates/types/src/capability.rs:67` |
| `const` | `REVOKE` | `crates/ruvix/crates/types/src/capability.rs:70` |
| `const` | `EXECUTE` | `crates/ruvix/crates/types/src/capability.rs:73` |
| `const` | `PROVE` | `crates/ruvix/crates/types/src/capability.rs:77` |
| `const` | `GRANT_ONCE` | `crates/ruvix/crates/types/src/capability.rs:81` |
| `const` | `NONE` | `crates/ruvix/crates/types/src/capability.rs:84` |
| `const` | `ALL` | `crates/ruvix/crates/types/src/capability.rs:87` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:92` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:99` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:106` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:113` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:120` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:127` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:134` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:141` |
| `struct` | `Capability` | `crates/ruvix/crates/types/src/capability.rs:188` |
| `const` | `fn` | `crates/ruvix/crates/types/src/capability.rs:212` |

_... +203 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-cli` — 227 public items (0 NAPI, 0 WASM)
*crates/ruvector-cli*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `create_database` | `crates/ruvector-cli/src/cli/commands.rs:18` |
| `fn` | `insert_vectors` | `crates/ruvector-cli/src/cli/commands.rs:37` |
| `fn` | `search_vectors` | `crates/ruvector-cli/src/cli/commands.rs:105` |
| `fn` | `show_info` | `crates/ruvector-cli/src/cli/commands.rs:143` |
| `fn` | `run_benchmark` | `crates/ruvector-cli/src/cli/commands.rs:169` |
| `fn` | `export_database` | `crates/ruvector-cli/src/cli/commands.rs:223` |
| `fn` | `import_from_external` | `crates/ruvector-cli/src/cli/commands.rs:253` |
| `fn` | `format_search_results` | `crates/ruvector-cli/src/cli/format.rs:8` |
| `fn` | `format_stats` | `crates/ruvector-cli/src/cli/format.rs:36` |
| `fn` | `format_error` | `crates/ruvector-cli/src/cli/format.rs:47` |
| `fn` | `format_success` | `crates/ruvector-cli/src/cli/format.rs:52` |
| `fn` | `format_warning` | `crates/ruvector-cli/src/cli/format.rs:57` |
| `fn` | `format_info` | `crates/ruvector-cli/src/cli/format.rs:62` |
| `fn` | `export_json` | `crates/ruvector-cli/src/cli/format.rs:67` |
| `fn` | `export_csv` | `crates/ruvector-cli/src/cli/format.rs:73` |
| `fn` | `format_graph_node` | `crates/ruvector-cli/src/cli/format.rs:96` |
| `fn` | `format_graph_relationship` | `crates/ruvector-cli/src/cli/format.rs:116` |
| `fn` | `format_graph_table` | `crates/ruvector-cli/src/cli/format.rs:143` |
| `fn` | `format_graph_stats` | `crates/ruvector-cli/src/cli/format.rs:165` |
| `enum` | `GraphCommands` | `crates/ruvector-cli/src/cli/graph.rs:13` |
| `fn` | `create_graph` | `crates/ruvector-cli/src/cli/graph.rs:152` |
| `fn` | `execute_query` | `crates/ruvector-cli/src/cli/graph.rs:181` |
| `fn` | `run_shell` | `crates/ruvector-cli/src/cli/graph.rs:224` |
| `fn` | `import_graph` | `crates/ruvector-cli/src/cli/graph.rs:298` |
| `fn` | `export_graph` | `crates/ruvector-cli/src/cli/graph.rs:353` |

_... +202 more — see `catalog/inventory-bootstrap.json`_


## `net` — 215 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/net*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `HARDWARE_TYPE_ETHERNET` | `crates/ruvix/crates/net/src/arp.rs:30` |
| `const` | `PROTOCOL_TYPE_IPV4` | `crates/ruvix/crates/net/src/arp.rs:33` |
| `enum` | `ArpOperation` | `crates/ruvix/crates/net/src/arp.rs:38` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:51` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:62` |
| `struct` | `ArpPacket` | `crates/ruvix/crates/net/src/arp.rs:73` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:98` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:115` |
| `fn` | `parse` | `crates/ruvix/crates/net/src/arp.rs:141` |
| `fn` | `serialize` | `crates/ruvix/crates/net/src/arp.rs:187` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:208` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:215` |
| `struct` | `ArpCacheEntry` | `crates/ruvix/crates/net/src/arp.rs:222` |
| `enum` | `ArpEntryState` | `crates/ruvix/crates/net/src/arp.rs:235` |
| `const` | `ARP_CACHE_TIMEOUT` | `crates/ruvix/crates/net/src/arp.rs:245` |
| `const` | `ARP_CACHE_MAX_ENTRIES` | `crates/ruvix/crates/net/src/arp.rs:248` |
| `struct` | `ArpCache` | `crates/ruvix/crates/net/src/arp.rs:255` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:265` |
| `const` | `fn` | `crates/ruvix/crates/net/src/arp.rs:276` |
| `fn` | `resolve` | `crates/ruvix/crates/net/src/arp.rs:288` |
| `fn` | `lookup` | `crates/ruvix/crates/net/src/arp.rs:306` |
| `fn` | `insert` | `crates/ruvix/crates/net/src/arp.rs:322` |
| `fn` | `mark_pending` | `crates/ruvix/crates/net/src/arp.rs:363` |
| `fn` | `process_reply` | `crates/ruvix/crates/net/src/arp.rs:403` |
| `fn` | `remove` | `crates/ruvix/crates/net/src/arp.rs:412` |

_... +190 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-middleware` — 204 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-middleware*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `FilesystemMiddleware` | `crates/rvAgent/rvagent-middleware/src/filesystem.rs:13` |
| `fn` | `new` | `crates/rvAgent/rvagent-middleware/src/filesystem.rs:19` |
| `fn` | `with_cwd` | `crates/rvAgent/rvagent-middleware/src/filesystem.rs:23` |
| `enum` | `ApprovalDecision` | `crates/rvAgent/rvagent-middleware/src/hitl.rs:10` |
| `struct` | `HumanInTheLoopMiddleware` | `crates/rvAgent/rvagent-middleware/src/hitl.rs:20` |
| `fn` | `new` | `crates/rvAgent/rvagent-middleware/src/hitl.rs:26` |
| `fn` | `should_interrupt` | `crates/rvAgent/rvagent-middleware/src/hitl.rs:31` |
| `struct` | `HnswMiddlewareConfig` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:36` |
| `struct` | `EntryMetadata` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:109` |
| `struct` | `SearchResult` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:122` |
| `struct` | `HnswStats` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:626` |
| `struct` | `HnswMiddleware` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:640` |
| `fn` | `new` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:647` |
| `fn` | `default_config` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:656` |
| `fn` | `set_enabled` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:661` |
| `fn` | `is_enabled` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:666` |
| `fn` | `stats` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:671` |
| `fn` | `add_skill` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:676` |
| `fn` | `add_memory` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:681` |
| `fn` | `search_skills` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:686` |
| `fn` | `search_memory` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:691` |
| `fn` | `retrieve_skill_tools` | `crates/rvAgent/rvagent-middleware/src/hnsw.rs:696` |
| `mod` | `filesystem` | `crates/rvAgent/rvagent-middleware/src/lib.rs:11` |
| `mod` | `hitl` | `crates/rvAgent/rvagent-middleware/src/lib.rs:12` |
| `mod` | `hnsw` | `crates/rvAgent/rvagent-middleware/src/lib.rs:13` |

_... +179 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-mcp` — 201 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-mcp*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `McpClient` | `crates/rvAgent/rvagent-mcp/src/client.rs:12` |
| `fn` | `new` | `crates/rvAgent/rvagent-mcp/src/client.rs:19` |
| `fn` | `is_initialized` | `crates/rvAgent/rvagent-mcp/src/client.rs:27` |
| `fn` | `initialize` | `crates/rvAgent/rvagent-mcp/src/client.rs:32` |
| `fn` | `ping` | `crates/rvAgent/rvagent-mcp/src/client.rs:54` |
| `fn` | `list_tools` | `crates/rvAgent/rvagent-mcp/src/client.rs:69` |
| `fn` | `call_tool` | `crates/rvAgent/rvagent-mcp/src/client.rs:91` |
| `fn` | `read_resource` | `crates/rvAgent/rvagent-mcp/src/client.rs:116` |
| `fn` | `list_resources` | `crates/rvAgent/rvagent-mcp/src/client.rs:137` |
| `fn` | `close` | `crates/rvAgent/rvagent-mcp/src/client.rs:158` |
| `enum` | `ToolGroup` | `crates/rvAgent/rvagent-mcp/src/groups.rs:11` |
| `fn` | `tools` | `crates/rvAgent/rvagent-mcp/src/groups.rs:34` |
| `fn` | `all` | `crates/rvAgent/rvagent-mcp/src/groups.rs:90` |
| `fn` | `all_tools` | `crates/rvAgent/rvagent-mcp/src/groups.rs:105` |
| `fn` | `as_str` | `crates/rvAgent/rvagent-mcp/src/groups.rs:113` |
| `struct` | `ToolFilter` | `crates/rvAgent/rvagent-mcp/src/groups.rs:155` |
| `fn` | `all` | `crates/rvAgent/rvagent-mcp/src/groups.rs:164` |
| `fn` | `from_groups` | `crates/rvAgent/rvagent-mcp/src/groups.rs:172` |
| `fn` | `from_group_names` | `crates/rvAgent/rvagent-mcp/src/groups.rs:184` |
| `fn` | `is_allowed` | `crates/rvAgent/rvagent-mcp/src/groups.rs:190` |
| `fn` | `count` | `crates/rvAgent/rvagent-mcp/src/groups.rs:195` |
| `fn` | `allows_all` | `crates/rvAgent/rvagent-mcp/src/groups.rs:204` |
| `fn` | `allowed_tools` | `crates/rvAgent/rvagent-mcp/src/groups.rs:209` |
| `mod` | `client` | `crates/rvAgent/rvagent-mcp/src/lib.rs:15` |
| `mod` | `groups` | `crates/rvAgent/rvagent-mcp/src/lib.rs:16` |

_... +176 more — see `catalog/inventory-bootstrap.json`_


## `fs` — 193 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/fs*

| Kind | Name | File:Line |
|---|---|---|
| `trait` | `BlockDevice` | `crates/ruvix/crates/fs/src/block.rs:18` |
| `struct` | `NullBlockDevice` | `crates/ruvix/crates/fs/src/block.rs:115` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/block.rs:129` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/block.rs:139` |
| `struct` | `MemoryBlockDevice` | `crates/ruvix/crates/fs/src/block.rs:199` |
| `fn` | `new` | `crates/ruvix/crates/fs/src/block.rs:218` |
| `fn` | `from_data` | `crates/ruvix/crates/fs/src/block.rs:238` |
| `fn` | `from_data_read_only` | `crates/ruvix/crates/fs/src/block.rs:252` |
| `fn` | `data` | `crates/ruvix/crates/fs/src/block.rs:266` |
| `fn` | `data_mut` | `crates/ruvix/crates/fs/src/block.rs:271` |
| `fn` | `set_read_only` | `crates/ruvix/crates/fs/src/block.rs:276` |
| `struct` | `MemoryBlockDeviceMut` | `crates/ruvix/crates/fs/src/block.rs:323` |
| `fn` | `new` | `crates/ruvix/crates/fs/src/block.rs:333` |
| `fn` | `from_data` | `crates/ruvix/crates/fs/src/block.rs:344` |
| `fn` | `set_read_only` | `crates/ruvix/crates/fs/src/block.rs:357` |
| `fn` | `data` | `crates/ruvix/crates/fs/src/block.rs:363` |
| `type` | `FsResult` | `crates/ruvix/crates/fs/src/error.rs:9` |
| `enum` | `FsError` | `crates/ruvix/crates/fs/src/error.rs:13` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/error.rs:120` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/error.rs:161` |
| `struct` | `Fat32BootSector` | `crates/ruvix/crates/fs/src/fat32.rs:49` |
| `fn` | `parse` | `crates/ruvix/crates/fs/src/fat32.rs:78` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/fat32.rs:145` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/fat32.rs:151` |
| `const` | `fn` | `crates/ruvix/crates/fs/src/fat32.rs:157` |

_... +168 more — see `catalog/inventory-bootstrap.json`_


## `cap` — 187 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/cap*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AuditResult` | `crates/ruvix/crates/cap/src/audit.rs:13` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:40` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:55` |
| `struct` | `AuditEntry` | `crates/ruvix/crates/cap/src/audit.rs:71` |
| `struct` | `AuditFlags` | `crates/ruvix/crates/cap/src/audit.rs:93` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:111` |
| `struct` | `AuditConfig` | `crates/ruvix/crates/cap/src/audit.rs:118` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:139` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:152` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:160` |
| `struct` | `CapabilityAuditor` | `crates/ruvix/crates/cap/src/audit.rs:176` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:191` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:202` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:213` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:220` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/audit.rs:227` |
| `fn` | `audit_entry` | `crates/ruvix/crates/cap/src/audit.rs:232` |
| `fn` | `audit` | `crates/ruvix/crates/cap/src/audit.rs:292` |
| `fn` | `needs_attention` | `crates/ruvix/crates/cap/src/audit.rs:339` |
| `struct` | `InitialCapability` | `crates/ruvix/crates/cap/src/boot.rs:18` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/boot.rs:39` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/boot.rs:58` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/boot.rs:71` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/boot.rs:85` |
| `const` | `fn` | `crates/ruvix/crates/cap/src/boot.rs:100` |

_... +162 more — see `catalog/inventory-bootstrap.json`_


## `nucleus` — 185 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/nucleus*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `CheckpointConfig` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:18` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:33` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:45` |
| `struct` | `Checkpoint` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:63` |
| `fn` | `create` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:94` |
| `fn` | `create` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:139` |
| `fn` | `to_bytes` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:276` |
| `fn` | `from_bytes` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:310` |
| `struct` | `ReplayEngine` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:369` |
| `fn` | `new` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:383` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:395` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:402` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:409` |
| `fn` | `set_current_time` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:414` |
| `fn` | `replay_record` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:421` |
| `fn` | `replay_log` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:457` |
| `fn` | `verify_state` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:479` |
| `struct` | `ReplayResult` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:545` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/checkpoint.rs:562` |
| `struct` | `GraphNode` | `crates/ruvix/crates/nucleus/src/graph_store.rs:24` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/graph_store.rs:37` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/graph_store.rs:48` |
| `struct` | `GraphEdge` | `crates/ruvix/crates/nucleus/src/graph_store.rs:59` |
| `const` | `fn` | `crates/ruvix/crates/nucleus/src/graph_store.rs:72` |
| `fn` | `weight` | `crates/ruvix/crates/nucleus/src/graph_store.rs:83` |

_... +160 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-a2a` — 184 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-a2a*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `ARTIFACT_KIND_VERSION` | `crates/rvAgent/rvagent-a2a/src/artifact_types.rs:29` |
| `enum` | `ArtifactKind` | `crates/rvAgent/rvagent-a2a/src/artifact_types.rs:42` |
| `fn` | `supported_versions` | `crates/rvAgent/rvagent-a2a/src/artifact_types.rs:105` |
| `fn` | `negotiate_version` | `crates/rvAgent/rvagent-a2a/src/artifact_types.rs:111` |
| `fn` | `to_a2a_artifact` | `crates/rvAgent/rvagent-a2a/src/artifact_types.rs:133` |
| `fn` | `from_a2a_artifact` | `crates/rvAgent/rvagent-a2a/src/artifact_types.rs:201` |
| `struct` | `GlobalBudget` | `crates/rvAgent/rvagent-a2a/src/budget.rs:30` |
| `enum` | `OverflowPolicy` | `crates/rvAgent/rvagent-a2a/src/budget.rs:53` |
| `fn` | `from_str_loose` | `crates/rvAgent/rvagent-a2a/src/budget.rs:105` |
| `enum` | `BudgetError` | `crates/rvAgent/rvagent-a2a/src/budget.rs:117` |
| `struct` | `BudgetSnapshot` | `crates/rvAgent/rvagent-a2a/src/budget.rs:130` |
| `struct` | `BudgetLedger` | `crates/rvAgent/rvagent-a2a/src/budget.rs:156` |
| `fn` | `new` | `crates/rvAgent/rvagent-a2a/src/budget.rs:162` |
| `fn` | `try_consume` | `crates/rvAgent/rvagent-a2a/src/budget.rs:184` |
| `fn` | `snapshot` | `crates/rvAgent/rvagent-a2a/src/budget.rs:279` |
| `struct` | `A2aClient` | `crates/rvAgent/rvagent-a2a/src/client.rs:41` |
| `struct` | `A2aClientBuilder` | `crates/rvAgent/rvagent-a2a/src/client.rs:54` |
| `fn` | `new` | `crates/rvAgent/rvagent-a2a/src/client.rs:62` |
| `fn` | `http` | `crates/rvAgent/rvagent-a2a/src/client.rs:68` |
| `fn` | `strict_verify` | `crates/rvAgent/rvagent-a2a/src/client.rs:77` |
| `fn` | `build` | `crates/rvAgent/rvagent-a2a/src/client.rs:85` |
| `fn` | `new` | `crates/rvAgent/rvagent-a2a/src/client.rs:105` |
| `fn` | `builder` | `crates/rvAgent/rvagent-a2a/src/client.rs:111` |
| `fn` | `with_http` | `crates/rvAgent/rvagent-a2a/src/client.rs:118` |
| `fn` | `fetch_card` | `crates/rvAgent/rvagent-a2a/src/client.rs:137` |

_... +159 more — see `catalog/inventory-bootstrap.json`_


## `boot` — 182 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/boot*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `BootAttestation` | `crates/ruvix/crates/boot/src/attestation.rs:17` |
| `const` | `SIZE` | `crates/ruvix/crates/boot/src/attestation.rs:42` |
| `fn` | `new` | `crates/ruvix/crates/boot/src/attestation.rs:46` |
| `fn` | `with_metadata` | `crates/ruvix/crates/boot/src/attestation.rs:65` |
| `fn` | `hash` | `crates/ruvix/crates/boot/src/attestation.rs:86` |
| `fn` | `to_bytes` | `crates/ruvix/crates/boot/src/attestation.rs:104` |
| `fn` | `from_bytes` | `crates/ruvix/crates/boot/src/attestation.rs:119` |
| `fn` | `verify` | `crates/ruvix/crates/boot/src/attestation.rs:164` |
| `struct` | `AttestationEntry` | `crates/ruvix/crates/boot/src/attestation.rs:189` |
| `enum` | `AttestationEntryType` | `crates/ruvix/crates/boot/src/attestation.rs:215` |
| `struct` | `AttestationFlags` | `crates/ruvix/crates/boot/src/attestation.rs:241` |
| `const` | `NONE` | `crates/ruvix/crates/boot/src/attestation.rs:245` |
| `const` | `HIGH_PRIORITY` | `crates/ruvix/crates/boot/src/attestation.rs:248` |
| `const` | `DEADLINE_DRIVEN` | `crates/ruvix/crates/boot/src/attestation.rs:251` |
| `const` | `DEEP_PROOF` | `crates/ruvix/crates/boot/src/attestation.rs:254` |
| `const` | `DURING_ROLLBACK` | `crates/ruvix/crates/boot/src/attestation.rs:257` |
| `const` | `fn` | `crates/ruvix/crates/boot/src/attestation.rs:262` |
| `const` | `fn` | `crates/ruvix/crates/boot/src/attestation.rs:269` |
| `const` | `SIZE` | `crates/ruvix/crates/boot/src/attestation.rs:276` |
| `fn` | `new` | `crates/ruvix/crates/boot/src/attestation.rs:280` |
| `fn` | `with_flags` | `crates/ruvix/crates/boot/src/attestation.rs:300` |
| `fn` | `hash` | `crates/ruvix/crates/boot/src/attestation.rs:321` |
| `enum` | `BootStage` | `crates/ruvix/crates/boot/src/boot_loader.rs:17` |
| `const` | `fn` | `crates/ruvix/crates/boot/src/boot_loader.rs:41` |
| `struct` | `BootConfig` | `crates/ruvix/crates/boot/src/boot_loader.rs:55` |

_... +157 more — see `catalog/inventory-bootstrap.json`_


## `bcm2711` — 170 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/bcm2711*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `Function` | `crates/ruvix/crates/bcm2711/src/gpio.rs:160` |
| `enum` | `Pull` | `crates/ruvix/crates/bcm2711/src/gpio.rs:182` |
| `enum` | `EdgeDetect` | `crates/ruvix/crates/bcm2711/src/gpio.rs:195` |
| `enum` | `GpioError` | `crates/ruvix/crates/bcm2711/src/gpio.rs:208` |
| `struct` | `Gpio` | `crates/ruvix/crates/bcm2711/src/gpio.rs:220` |
| `const` | `fn` | `crates/ruvix/crates/bcm2711/src/gpio.rs:229` |
| `const` | `unsafe` | `crates/ruvix/crates/bcm2711/src/gpio.rs:239` |
| `fn` | `set_function` | `crates/ruvix/crates/bcm2711/src/gpio.rs:262` |
| `fn` | `get_function` | `crates/ruvix/crates/bcm2711/src/gpio.rs:293` |
| `fn` | `set_pull` | `crates/ruvix/crates/bcm2711/src/gpio.rs:332` |
| `fn` | `get_pull` | `crates/ruvix/crates/bcm2711/src/gpio.rs:364` |
| `fn` | `write` | `crates/ruvix/crates/bcm2711/src/gpio.rs:395` |
| `fn` | `read` | `crates/ruvix/crates/bcm2711/src/gpio.rs:430` |
| `fn` | `set_edge_detect` | `crates/ruvix/crates/bcm2711/src/gpio.rs:455` |
| `fn` | `event_detected` | `crates/ruvix/crates/bcm2711/src/gpio.rs:506` |
| `fn` | `clear_event` | `crates/ruvix/crates/bcm2711/src/gpio.rs:527` |
| `fn` | `toggle` | `crates/ruvix/crates/bcm2711/src/gpio.rs:548` |
| `const` | `IRQ_TIMER1` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:153` |
| `const` | `IRQ_TIMER3` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:156` |
| `const` | `IRQ_USB` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:159` |
| `const` | `IRQ_AUX` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:162` |
| `const` | `IRQ_GPIO0` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:165` |
| `const` | `IRQ_GPIO1` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:168` |
| `const` | `IRQ_GPIO2` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:171` |
| `const` | `IRQ_GPIO3` | `crates/ruvix/crates/bcm2711/src/interrupt.rs:174` |

_... +145 more — see `catalog/inventory-bootstrap.json`_


## `vecgraph` — 165 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/vecgraph*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `CoherenceConfig` | `crates/ruvix/crates/vecgraph/src/coherence.rs:22` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:57` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:70` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:78` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:86` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:94` |
| `fn` | `min_threshold_f32` | `crates/ruvix/crates/vecgraph/src/coherence.rs:102` |
| `struct` | `CoherenceTracker` | `crates/ruvix/crates/vecgraph/src/coherence.rs:109` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:133` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:147` |
| `fn` | `advance_epoch` | `crates/ruvix/crates/vecgraph/src/coherence.rs:153` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:161` |
| `fn` | `create_initial_meta` | `crates/ruvix/crates/vecgraph/src/coherence.rs:171` |
| `fn` | `on_entry_added` | `crates/ruvix/crates/vecgraph/src/coherence.rs:180` |
| `fn` | `on_entry_removed` | `crates/ruvix/crates/vecgraph/src/coherence.rs:187` |
| `fn` | `on_entry_mutated` | `crates/ruvix/crates/vecgraph/src/coherence.rs:196` |
| `fn` | `would_violate_threshold` | `crates/ruvix/crates/vecgraph/src/coherence.rs:222` |
| `fn` | `average_coherence_f32` | `crates/ruvix/crates/vecgraph/src/coherence.rs:229` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:236` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/coherence.rs:243` |
| `fn` | `apply_decay` | `crates/ruvix/crates/vecgraph/src/coherence.rs:259` |
| `struct` | `GraphNode` | `crates/ruvix/crates/vecgraph/src/graph_store.rs:44` |
| `const` | `SIZE` | `crates/ruvix/crates/vecgraph/src/graph_store.rs:69` |
| `const` | `fn` | `crates/ruvix/crates/vecgraph/src/graph_store.rs:74` |
| `struct` | `EdgeEntry` | `crates/ruvix/crates/vecgraph/src/graph_store.rs:90` |

_... +140 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-tiny-dancer-core` — 158 public items (0 NAPI, 0 WASM)
*crates/ruvector-tiny-dancer-core*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `API_VERSION` | `crates/ruvector-tiny-dancer-core/src/api.rs:31` |
| `struct` | `AdminServerConfig` | `crates/ruvector-tiny-dancer-core/src/api.rs:35` |
| `struct` | `AdminServerState` | `crates/ruvector-tiny-dancer-core/src/api.rs:59` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-core/src/api.rs:68` |
| `fn` | `router` | `crates/ruvector-tiny-dancer-core/src/api.rs:78` |
| `fn` | `metrics` | `crates/ruvector-tiny-dancer-core/src/api.rs:83` |
| `fn` | `uptime` | `crates/ruvector-tiny-dancer-core/src/api.rs:88` |
| `struct` | `AdminServer` | `crates/ruvector-tiny-dancer-core/src/api.rs:94` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-core/src/api.rs:100` |
| `fn` | `build_router` | `crates/ruvector-tiny-dancer-core/src/api.rs:107` |
| `fn` | `serve` | `crates/ruvector-tiny-dancer-core/src/api.rs:132` |
| `fn` | `record_routing_metrics` | `crates/ruvector-tiny-dancer-core/src/api.rs:575` |
| `fn` | `record_error` | `crates/ruvector-tiny-dancer-core/src/api.rs:598` |
| `fn` | `record_circuit_breaker_trip` | `crates/ruvector-tiny-dancer-core/src/api.rs:604` |
| `enum` | `CircuitState` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:10` |
| `struct` | `CircuitBreaker` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:20` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:35` |
| `fn` | `with_timeout` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:48` |
| `fn` | `is_closed` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:55` |
| `fn` | `record_success` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:80` |
| `fn` | `record_failure` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:95` |
| `fn` | `state` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:116` |
| `fn` | `failure_count` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:121` |
| `fn` | `success_count` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:126` |
| `fn` | `reset` | `crates/ruvector-tiny-dancer-core/src/circuit_breaker.rs:131` |

_... +133 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-wasm` — 158 public items (0 NAPI, 48 WASM)
*crates/rvAgent/rvagent-wasm*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `WasmStateBackend` | `crates/rvAgent/rvagent-wasm/src/backends.rs:19` |
| `fn` | `new` | `crates/rvAgent/rvagent-wasm/src/backends.rs:26` |
| `fn` | `read_file` | `crates/rvAgent/rvagent-wasm/src/backends.rs:33` |
| `fn` | `write_file` | `crates/rvAgent/rvagent-wasm/src/backends.rs:41` |
| `fn` | `edit_file` | `crates/rvAgent/rvagent-wasm/src/backends.rs:66` |
| `fn` | `delete_file` | `crates/rvAgent/rvagent-wasm/src/backends.rs:80` |
| `fn` | `list_files` | `crates/rvAgent/rvagent-wasm/src/backends.rs:88` |
| `fn` | `file_exists` | `crates/rvAgent/rvagent-wasm/src/backends.rs:95` |
| `fn` | `clear` | `crates/rvAgent/rvagent-wasm/src/backends.rs:100` |
| `fn` | `file_count` | `crates/rvAgent/rvagent-wasm/src/backends.rs:105` |
| `fn` | `to_json` | `crates/rvAgent/rvagent-wasm/src/backends.rs:110` |
| `fn` | `from_json` | `crates/rvAgent/rvagent-wasm/src/backends.rs:115` |
| `struct` | `WasmFetchBackend` | `crates/rvAgent/rvagent-wasm/src/backends.rs:130` |
| `fn` | `new` | `crates/rvAgent/rvagent-wasm/src/backends.rs:140` |
| `fn` | `with_auth` | `crates/rvAgent/rvagent-wasm/src/backends.rs:148` |
| `fn` | `fetch_file` | `crates/rvAgent/rvagent-wasm/src/backends.rs:154` |
| `fn` | `put_file` | `crates/rvAgent/rvagent-wasm/src/backends.rs:182` |
| `enum` | `WasmBackendError` | `crates/rvAgent/rvagent-wasm/src/backends.rs:257` |
| `const` | `MAX_PATH_LENGTH` | `crates/rvAgent/rvagent-wasm/src/backends.rs:294` |
| `const` | `MAX_FILE_SIZE` | `crates/rvAgent/rvagent-wasm/src/backends.rs:297` |
| `const` | `MAX_FILES` | `crates/rvAgent/rvagent-wasm/src/backends.rs:300` |
| `struct` | `JsModelProvider` | `crates/rvAgent/rvagent-wasm/src/bridge.rs:27` |
| `fn` | `new` | `crates/rvAgent/rvagent-wasm/src/bridge.rs:38` |
| `fn` | `complete` | `crates/rvAgent/rvagent-wasm/src/bridge.rs:51` |
| `fn` | `to_js_value` | `crates/rvAgent/rvagent-wasm/src/bridge.rs:75` |

_... +133 more — see `catalog/inventory-bootstrap.json`_


## `dma` — 154 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/dma*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `DmaBufferFlags` | `crates/ruvix/crates/dma/src/buffer.rs:7` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:23` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:35` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:47` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:59` |
| `struct` | `DmaBuffer` | `crates/ruvix/crates/dma/src/buffer.rs:76` |
| `fn` | `new` | `crates/ruvix/crates/dma/src/buffer.rs:106` |
| `fn` | `with_alignment` | `crates/ruvix/crates/dma/src/buffer.rs:123` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:157` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:163` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:169` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:175` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:181` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:187` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:193` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:199` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:205` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:211` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:217` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:223` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:229` |
| `const` | `fn` | `crates/ruvix/crates/dma/src/buffer.rs:235` |
| `fn` | `slice` | `crates/ruvix/crates/dma/src/buffer.rs:249` |
| `fn` | `invalidate_cache` | `crates/ruvix/crates/dma/src/buffer.rs:268` |
| `fn` | `clean_cache` | `crates/ruvix/crates/dma/src/buffer.rs:278` |

_... +129 more — see `catalog/inventory-bootstrap.json`_


## `sched` — 133 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/sched*

| Kind | Name | File:Line |
|---|---|---|
| `type` | `SchedResult` | `crates/ruvix/crates/sched/src/error.rs:6` |
| `enum` | `SchedError` | `crates/ruvix/crates/sched/src/error.rs:10` |
| `use` | `error` | `crates/ruvix/crates/sched/src/lib.rs:71` |
| `use` | `novelty` | `crates/ruvix/crates/sched/src/lib.rs:72` |
| `use` | `partition` | `crates/ruvix/crates/sched/src/lib.rs:73` |
| `use` | `priority` | `crates/ruvix/crates/sched/src/lib.rs:74` |
| `use` | `scheduler` | `crates/ruvix/crates/sched/src/lib.rs:75` |
| `use` | `task` | `crates/ruvix/crates/sched/src/lib.rs:76` |
| `use` | `ruvix_types` | `crates/ruvix/crates/sched/src/lib.rs:79` |
| `use` | `ruvix_cap` | `crates/ruvix/crates/sched/src/lib.rs:82` |
| `const` | `DEFAULT_MAX_TASKS_PER_PARTITION` | `crates/ruvix/crates/sched/src/lib.rs:85` |
| `const` | `DEFAULT_MAX_PARTITIONS` | `crates/ruvix/crates/sched/src/lib.rs:88` |
| `const` | `DEFAULT_TIME_QUANTUM_US` | `crates/ruvix/crates/sched/src/lib.rs:91` |
| `const` | `DEFAULT_NOVELTY_DECAY` | `crates/ruvix/crates/sched/src/lib.rs:94` |
| `const` | `DEFAULT_RISK_WEIGHT` | `crates/ruvix/crates/sched/src/lib.rs:97` |
| `enum` | `PreemptionBoundary` | `crates/ruvix/crates/sched/src/lib.rs:105` |
| `struct` | `Instant` | `crates/ruvix/crates/sched/src/lib.rs:122` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:128` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:135` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:142` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:153` |
| `struct` | `Duration` | `crates/ruvix/crates/sched/src/lib.rs:167` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:173` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:180` |
| `const` | `fn` | `crates/ruvix/crates/sched/src/lib.rs:187` |

_... +108 more — see `catalog/inventory-bootstrap.json`_


## `proof` — 132 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/proof*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AttestationBuilder` | `crates/ruvix/crates/proof/src/attestation.rs:15` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:31` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:43` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:50` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:57` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:64` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:71` |
| `fn` | `from_token` | `crates/ruvix/crates/proof/src/attestation.rs:78` |
| `fn` | `build` | `crates/ruvix/crates/proof/src/attestation.rs:141` |
| `struct` | `WitnessEntry` | `crates/ruvix/crates/proof/src/attestation.rs:161` |
| `struct` | `WitnessLog` | `crates/ruvix/crates/proof/src/attestation.rs:172` |
| `fn` | `new` | `crates/ruvix/crates/proof/src/attestation.rs:186` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:198` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:205` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/attestation.rs:212` |
| `fn` | `append` | `crates/ruvix/crates/proof/src/attestation.rs:217` |
| `fn` | `get` | `crates/ruvix/crates/proof/src/attestation.rs:246` |
| `fn` | `latest` | `crates/ruvix/crates/proof/src/attestation.rs:253` |
| `fn` | `clear` | `crates/ruvix/crates/proof/src/attestation.rs:262` |
| `fn` | `serialize_attestation` | `crates/ruvix/crates/proof/src/attestation.rs:271` |
| `fn` | `deserialize_attestation` | `crates/ruvix/crates/proof/src/attestation.rs:296` |
| `fn` | `create_and_log_attestation` | `crates/ruvix/crates/proof/src/attestation.rs:331` |
| `struct` | `ProofCacheConfig` | `crates/ruvix/crates/proof/src/cache.rs:15` |
| `struct` | `CacheEntry` | `crates/ruvix/crates/proof/src/cache.rs:36` |
| `const` | `fn` | `crates/ruvix/crates/proof/src/cache.rs:55` |

_... +107 more — see `catalog/inventory-bootstrap.json`_


## `rvm-types` — 128 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-types*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `PhysAddr` | `crates/rvm/crates/rvm-types/src/addr.rs:9` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:14` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:20` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:26` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:32` |
| `struct` | `VirtAddr` | `crates/rvm/crates/rvm-types/src/addr.rs:40` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:45` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:51` |
| `struct` | `GuestPhysAddr` | `crates/rvm/crates/rvm-types/src/addr.rs:59` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:64` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:70` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/addr.rs:76` |
| `struct` | `CapRights` | `crates/rvm/crates/rvm-types/src/capability.rs:19` |
| `enum` | `CapType` | `crates/rvm/crates/rvm-types/src/capability.rs:40` |
| `struct` | `CapabilityId` | `crates/rvm/crates/rvm-types/src/capability.rs:64` |
| `const` | `ROOT` | `crates/rvm/crates/rvm-types/src/capability.rs:68` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:72` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:78` |
| `struct` | `CapToken` | `crates/rvm/crates/rvm-types/src/capability.rs:88` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:102` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:113` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:119` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:125` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:131` |
| `const` | `fn` | `crates/rvm/crates/rvm-types/src/capability.rs:137` |

_... +103 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-backends` — 126 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-backends*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AnthropicClient` | `crates/rvAgent/rvagent-backends/src/anthropic.rs:137` |
| `fn` | `new` | `crates/rvAgent/rvagent-backends/src/anthropic.rs:148` |
| `type` | `BackendRef` | `crates/rvAgent/rvagent-backends/src/composite.rs:12` |
| `struct` | `CompositeBackend` | `crates/rvAgent/rvagent-backends/src/composite.rs:18` |
| `fn` | `new` | `crates/rvAgent/rvagent-backends/src/composite.rs:27` |
| `fn` | `add_route` | `crates/rvAgent/rvagent-backends/src/composite.rs:34` |
| `struct` | `FilesystemBackend` | `crates/rvAgent/rvagent-backends/src/filesystem.rs:32` |
| `fn` | `new` | `crates/rvAgent/rvagent-backends/src/filesystem.rs:40` |
| `fn` | `with_options` | `crates/rvAgent/rvagent-backends/src/filesystem.rs:51` |
| `fn` | `cwd` | `crates/rvAgent/rvagent-backends/src/filesystem.rs:62` |
| `fn` | `virtual_mode` | `crates/rvAgent/rvagent-backends/src/filesystem.rs:67` |
| `fn` | `resolve_path` | `crates/rvAgent/rvagent-backends/src/filesystem.rs:75` |
| `struct` | `GeminiClient` | `crates/rvAgent/rvagent-backends/src/gemini.rs:125` |
| `fn` | `new` | `crates/rvAgent/rvagent-backends/src/gemini.rs:133` |
| `mod` | `anthropic` | `crates/rvAgent/rvagent-backends/src/lib.rs:22` |
| `mod` | `composite` | `crates/rvAgent/rvagent-backends/src/lib.rs:23` |
| `mod` | `filesystem` | `crates/rvAgent/rvagent-backends/src/lib.rs:24` |
| `mod` | `gemini` | `crates/rvAgent/rvagent-backends/src/lib.rs:25` |
| `mod` | `local_shell` | `crates/rvAgent/rvagent-backends/src/lib.rs:26` |
| `mod` | `protocol` | `crates/rvAgent/rvagent-backends/src/lib.rs:27` |
| `mod` | `rvf_store` | `crates/rvAgent/rvagent-backends/src/lib.rs:28` |
| `mod` | `sandbox` | `crates/rvAgent/rvagent-backends/src/lib.rs:29` |
| `mod` | `security` | `crates/rvAgent/rvagent-backends/src/lib.rs:30` |
| `mod` | `state` | `crates/rvAgent/rvagent-backends/src/lib.rs:31` |
| `mod` | `store` | `crates/rvAgent/rvagent-backends/src/lib.rs:32` |

_... +101 more — see `catalog/inventory-bootstrap.json`_


## `region` — 121 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/region*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AppendOnlyRegion` | `crates/ruvix/crates/region/src/append_only.rs:22` |
| `fn` | `new` | `crates/ruvix/crates/region/src/append_only.rs:49` |
| `fn` | `append` | `crates/ruvix/crates/region/src/append_only.rs:73` |
| `fn` | `read` | `crates/ruvix/crates/region/src/append_only.rs:112` |
| `fn` | `read_all` | `crates/ruvix/crates/region/src/append_only.rs:137` |
| `const` | `fn` | `crates/ruvix/crates/region/src/append_only.rs:144` |
| `const` | `fn` | `crates/ruvix/crates/region/src/append_only.rs:151` |
| `const` | `fn` | `crates/ruvix/crates/region/src/append_only.rs:158` |
| `const` | `fn` | `crates/ruvix/crates/region/src/append_only.rs:165` |
| `const` | `fn` | `crates/ruvix/crates/region/src/append_only.rs:172` |
| `fn` | `fill_ratio` | `crates/ruvix/crates/region/src/append_only.rs:179` |
| `const` | `fn` | `crates/ruvix/crates/region/src/append_only.rs:190` |
| `fn` | `as_slice` | `crates/ruvix/crates/region/src/append_only.rs:202` |
| `fn` | `append_u64` | `crates/ruvix/crates/region/src/append_only.rs:208` |
| `fn` | `append_u32` | `crates/ruvix/crates/region/src/append_only.rs:213` |
| `fn` | `read_u64` | `crates/ruvix/crates/region/src/append_only.rs:218` |
| `fn` | `read_u32` | `crates/ruvix/crates/region/src/append_only.rs:228` |
| `trait` | `MemoryBacking` | `crates/ruvix/crates/region/src/backing.rs:16` |
| `struct` | `HeapBacking` | `crates/ruvix/crates/region/src/backing.rs:42` |
| `fn` | `new` | `crates/ruvix/crates/region/src/backing.rs:50` |
| `struct` | `MmapBacking` | `crates/ruvix/crates/region/src/backing.rs:110` |
| `fn` | `new` | `crates/ruvix/crates/region/src/backing.rs:118` |
| `struct` | `StaticBacking` | `crates/ruvix/crates/region/src/backing.rs:188` |
| `const` | `fn` | `crates/ruvix/crates/region/src/backing.rs:195` |
| `fn` | `as_slice` | `crates/ruvix/crates/region/src/backing.rs:203` |

_... +96 more — see `catalog/inventory-bootstrap.json`_


## `physmem` — 111 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/physmem*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `PhysAddr` | `crates/ruvix/crates/physmem/src/addr.rs:35` |
| `const` | `NULL` | `crates/ruvix/crates/physmem/src/addr.rs:39` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:57` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:82` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:98` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:120` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:139` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:156` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:173` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:192` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:211` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:232` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:253` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:273` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:297` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:327` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/addr.rs:352` |
| `struct` | `BuddyAllocator` | `crates/ruvix/crates/physmem/src/allocator.rs:55` |
| `fn` | `new` | `crates/ruvix/crates/physmem/src/allocator.rs:194` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/allocator.rs:219` |
| `fn` | `init` | `crates/ruvix/crates/physmem/src/allocator.rs:243` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/allocator.rs:299` |
| `const` | `fn` | `crates/ruvix/crates/physmem/src/allocator.rs:306` |
| `fn` | `free_page_count` | `crates/ruvix/crates/physmem/src/allocator.rs:313` |
| `fn` | `used_pages` | `crates/ruvix/crates/physmem/src/allocator.rs:324` |

_... +86 more — see `catalog/inventory-bootstrap.json`_


## `queue` — 108 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/queue*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `MessageDescriptor` | `crates/ruvix/crates/queue/src/descriptor.rs:24` |
| `const` | `SIZE` | `crates/ruvix/crates/queue/src/descriptor.rs:37` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/descriptor.rs:41` |
| `fn` | `is_valid` | `crates/ruvix/crates/queue/src/descriptor.rs:52` |
| `fn` | `to_bytes` | `crates/ruvix/crates/queue/src/descriptor.rs:58` |
| `fn` | `from_bytes` | `crates/ruvix/crates/queue/src/descriptor.rs:65` |
| `struct` | `DescriptorValidator` | `crates/ruvix/crates/queue/src/descriptor.rs:82` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/descriptor.rs:91` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/descriptor.rs:99` |
| `fn` | `validate_policy` | `crates/ruvix/crates/queue/src/descriptor.rs:111` |
| `fn` | `validate_bounds` | `crates/ruvix/crates/queue/src/descriptor.rs:133` |
| `fn` | `validate` | `crates/ruvix/crates/queue/src/descriptor.rs:156` |
| `struct` | `PrioritizedDescriptor` | `crates/ruvix/crates/queue/src/descriptor.rs:181` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/descriptor.rs:191` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/descriptor.rs:200` |
| `struct` | `QueueConfig` | `crates/ruvix/crates/queue/src/kernel_queue.rs:16` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/kernel_queue.rs:33` |
| `const` | `fn` | `crates/ruvix/crates/queue/src/kernel_queue.rs:43` |
| `fn` | `validate` | `crates/ruvix/crates/queue/src/kernel_queue.rs:52` |
| `fn` | `required_memory` | `crates/ruvix/crates/queue/src/kernel_queue.rs:67` |
| `struct` | `KernelQueue` | `crates/ruvix/crates/queue/src/kernel_queue.rs:98` |
| `fn` | `new` | `crates/ruvix/crates/queue/src/kernel_queue.rs:130` |
| `fn` | `new_heap` | `crates/ruvix/crates/queue/src/kernel_queue.rs:158` |
| `fn` | `send` | `crates/ruvix/crates/queue/src/kernel_queue.rs:194` |
| `fn` | `send_descriptor` | `crates/ruvix/crates/queue/src/kernel_queue.rs:227` |

_... +83 more — see `catalog/inventory-bootstrap.json`_


## `dtb` — 102 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/dtb*

| Kind | Name | File:Line |
|---|---|---|
| `type` | `DtbResult` | `crates/ruvix/crates/dtb/src/error.rs:6` |
| `enum` | `DtbError` | `crates/ruvix/crates/dtb/src/error.rs:10` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:103` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:109` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:115` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:121` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:130` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:136` |
| `const` | `fn` | `crates/ruvix/crates/dtb/src/error.rs:148` |
| `const` | `FDT_HEADER_SIZE` | `crates/ruvix/crates/dtb/src/header.rs:6` |
| `struct` | `FdtHeader` | `crates/ruvix/crates/dtb/src/header.rs:12` |
| `fn` | `parse` | `crates/ruvix/crates/dtb/src/header.rs:45` |
| `fn` | `validate` | `crates/ruvix/crates/dtb/src/header.rs:92` |
| `fn` | `structure_block` | `crates/ruvix/crates/dtb/src/header.rs:155` |
| `fn` | `strings_block` | `crates/ruvix/crates/dtb/src/header.rs:163` |
| `fn` | `get_string` | `crates/ruvix/crates/dtb/src/header.rs:170` |
| `use` | `error` | `crates/ruvix/crates/dtb/src/lib.rs:68` |
| `use` | `header` | `crates/ruvix/crates/dtb/src/lib.rs:69` |
| `use` | `node` | `crates/ruvix/crates/dtb/src/lib.rs:70` |
| `use` | `parser` | `crates/ruvix/crates/dtb/src/lib.rs:71` |
| `use` | `property` | `crates/ruvix/crates/dtb/src/lib.rs:72` |
| `const` | `FDT_MAGIC` | `crates/ruvix/crates/dtb/src/lib.rs:75` |
| `const` | `FDT_VERSION` | `crates/ruvix/crates/dtb/src/lib.rs:78` |
| `const` | `FDT_MIN_VERSION` | `crates/ruvix/crates/dtb/src/lib.rs:81` |
| `enum` | `FdtToken` | `crates/ruvix/crates/dtb/src/lib.rs:86` |

_... +77 more — see `catalog/inventory-bootstrap.json`_


## `rvm-coherence` — 102 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-coherence*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AdaptiveCoherenceEngine` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:31` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:47` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:59` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:65` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:71` |
| `fn` | `tick` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:79` |
| `fn` | `record_computation` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:102` |
| `fn` | `record_budget_exceeded` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:108` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:115` |
| `fn` | `reset` | `crates/rvm/crates/rvm-coherence/src/adaptive.rs:123` |
| `struct` | `BackendMinCutResult` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:44` |
| `trait` | `MinCutBackend` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:104` |
| `struct` | `BuiltinMinCut` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:127` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:134` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:143` |
| `fn` | `inner_mut` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:148` |
| `struct` | `RuVectorMinCut` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:180` |
| `const` | `fn` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:190` |
| `trait` | `CoherenceBackend` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:225` |
| `struct` | `BuiltinCoherence` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:246` |
| `struct` | `SpectralCoherence` | `crates/rvm/crates/rvm-coherence/src/bridge.rs:274` |
| `enum` | `CoherenceDecision` | `crates/rvm/crates/rvm-coherence/src/engine.rs:38` |
| `struct` | `CoherenceEngine` | `crates/rvm/crates/rvm-coherence/src/engine.rs:85` |
| `type` | `DefaultCoherenceEngine` | `crates/rvm/crates/rvm-coherence/src/engine.rs:105` |
| `type` | `RuVectorCoherenceEngine` | `crates/rvm/crates/rvm-coherence/src/engine.rs:110` |

_... +77 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-crv` — 96 public items (0 NAPI, 0 WASM)
*crates/ruvector-crv*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `CrvError` | `crates/ruvector-crv/src/error.rs:7` |
| `type` | `CrvResult` | `crates/ruvector-crv/src/error.rs:38` |
| `mod` | `error` | `crates/ruvector-crv/src/lib.rs:68` |
| `mod` | `session` | `crates/ruvector-crv/src/lib.rs:69` |
| `mod` | `stage_i` | `crates/ruvector-crv/src/lib.rs:70` |
| `mod` | `stage_ii` | `crates/ruvector-crv/src/lib.rs:71` |
| `mod` | `stage_iii` | `crates/ruvector-crv/src/lib.rs:72` |
| `mod` | `stage_iv` | `crates/ruvector-crv/src/lib.rs:73` |
| `mod` | `stage_v` | `crates/ruvector-crv/src/lib.rs:74` |
| `mod` | `stage_vi` | `crates/ruvector-crv/src/lib.rs:75` |
| `mod` | `types` | `crates/ruvector-crv/src/lib.rs:76` |
| `use` | `error` | `crates/ruvector-crv/src/lib.rs:79` |
| `use` | `session` | `crates/ruvector-crv/src/lib.rs:80` |
| `use` | `stage_i` | `crates/ruvector-crv/src/lib.rs:81` |
| `use` | `stage_ii` | `crates/ruvector-crv/src/lib.rs:82` |
| `use` | `stage_iii` | `crates/ruvector-crv/src/lib.rs:83` |
| `use` | `stage_iv` | `crates/ruvector-crv/src/lib.rs:84` |
| `use` | `stage_v` | `crates/ruvector-crv/src/lib.rs:85` |
| `use` | `stage_vi` | `crates/ruvector-crv/src/lib.rs:86` |
| `use` | `types` | `crates/ruvector-crv/src/lib.rs:87` |
| `const` | `VERSION` | `crates/ruvector-crv/src/lib.rs:95` |
| `struct` | `CrvSessionManager` | `crates/ruvector-crv/src/session.rs:52` |
| `fn` | `new` | `crates/ruvector-crv/src/session.rs:73` |
| `fn` | `create_session` | `crates/ruvector-crv/src/session.rs:94` |
| `fn` | `add_stage_i` | `crates/ruvector-crv/src/session.rs:119` |

_... +71 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-delta-graph` — 96 public items (0 NAPI, 0 WASM)
*crates/ruvector-delta-graph*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `EdgeOp` | `crates/ruvector-delta-graph/src/edge_delta.rs:13` |
| `struct` | `PropertyDelta` | `crates/ruvector-delta-graph/src/edge_delta.rs:31` |
| `fn` | `set` | `crates/ruvector-delta-graph/src/edge_delta.rs:40` |
| `fn` | `remove` | `crates/ruvector-delta-graph/src/edge_delta.rs:48` |
| `struct` | `EdgeDelta` | `crates/ruvector-delta-graph/src/edge_delta.rs:58` |
| `fn` | `new` | `crates/ruvector-delta-graph/src/edge_delta.rs:69` |
| `fn` | `is_empty` | `crates/ruvector-delta-graph/src/edge_delta.rs:78` |
| `fn` | `set_property` | `crates/ruvector-delta-graph/src/edge_delta.rs:83` |
| `fn` | `remove_property` | `crates/ruvector-delta-graph/src/edge_delta.rs:89` |
| `fn` | `with_weight_delta` | `crates/ruvector-delta-graph/src/edge_delta.rs:95` |
| `fn` | `with_type_change` | `crates/ruvector-delta-graph/src/edge_delta.rs:101` |
| `fn` | `compose` | `crates/ruvector-delta-graph/src/edge_delta.rs:107` |
| `fn` | `inverse` | `crates/ruvector-delta-graph/src/edge_delta.rs:132` |
| `struct` | `EdgeDeltaBuilder` | `crates/ruvector-delta-graph/src/edge_delta.rs:148` |
| `fn` | `new` | `crates/ruvector-delta-graph/src/edge_delta.rs:154` |
| `fn` | `set` | `crates/ruvector-delta-graph/src/edge_delta.rs:161` |
| `fn` | `remove` | `crates/ruvector-delta-graph/src/edge_delta.rs:169` |
| `fn` | `weight` | `crates/ruvector-delta-graph/src/edge_delta.rs:175` |
| `fn` | `retype` | `crates/ruvector-delta-graph/src/edge_delta.rs:181` |
| `fn` | `build` | `crates/ruvector-delta-graph/src/edge_delta.rs:187` |
| `type` | `Result` | `crates/ruvector-delta-graph/src/error.rs:6` |
| `enum` | `GraphDeltaError` | `crates/ruvector-delta-graph/src/error.rs:10` |
| `mod` | `edge_delta` | `crates/ruvector-delta-graph/src/lib.rs:16` |
| `mod` | `error` | `crates/ruvector-delta-graph/src/lib.rs:17` |
| `mod` | `node_delta` | `crates/ruvector-delta-graph/src/lib.rs:18` |

_... +71 more — see `catalog/inventory-bootstrap.json`_


## `rpi-boot` — 93 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/rpi-boot*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `MAX_CMDLINE_LENGTH` | `crates/ruvix/crates/rpi-boot/src/config.rs:47` |
| `const` | `MAX_ARGS` | `crates/ruvix/crates/rpi-boot/src/config.rs:50` |
| `enum` | `ConfigError` | `crates/ruvix/crates/rpi-boot/src/config.rs:54` |
| `type` | `Result` | `crates/ruvix/crates/rpi-boot/src/config.rs:66` |
| `struct` | `BootConfig` | `crates/ruvix/crates/rpi-boot/src/config.rs:70` |
| `const` | `fn` | `crates/ruvix/crates/rpi-boot/src/config.rs:93` |
| `enum` | `ConsoleDevice` | `crates/ruvix/crates/rpi-boot/src/config.rs:116` |
| `enum` | `LogLevel` | `crates/ruvix/crates/rpi-boot/src/config.rs:129` |
| `enum` | `PageSize` | `crates/ruvix/crates/rpi-boot/src/config.rs:146` |
| `fn` | `parse_cmdline` | `crates/ruvix/crates/rpi-boot/src/config.rs:162` |
| `const` | `DTB_MAGIC` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:37` |
| `const` | `MIN_DTB_SIZE` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:40` |
| `const` | `MAX_DTB_SIZE` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:43` |
| `struct` | `DtbHeader` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:48` |
| `fn` | `is_valid` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:73` |
| `fn` | `total_size` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:96` |
| `fn` | `version` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:101` |
| `fn` | `boot_cpu` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:106` |
| `fn` | `struct_offset` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:111` |
| `fn` | `strings_offset` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:116` |
| `struct` | `DtbInfo` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:123` |
| `fn` | `parse_dtb_header` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:156` |
| `fn` | `is_valid_dtb` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:185` |
| `enum` | `FdtToken` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:199` |
| `fn` | `from_be` | `crates/ruvix/crates/rpi-boot/src/dtb.rs:214` |

_... +68 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-cluster` — 91 public items (0 NAPI, 0 WASM)
*crates/ruvector-cluster*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `DagVertex` | `crates/ruvector-cluster/src/consensus.rs:18` |
| `fn` | `new` | `crates/ruvector-cluster/src/consensus.rs:37` |
| `fn` | `verify_signature` | `crates/ruvector-cluster/src/consensus.rs:55` |
| `struct` | `Transaction` | `crates/ruvector-cluster/src/consensus.rs:63` |
| `enum` | `TransactionType` | `crates/ruvector-cluster/src/consensus.rs:76` |
| `struct` | `DagConsensus` | `crates/ruvector-cluster/src/consensus.rs:90` |
| `fn` | `new` | `crates/ruvector-cluster/src/consensus.rs:109` |
| `fn` | `submit_transaction` | `crates/ruvector-cluster/src/consensus.rs:125` |
| `fn` | `create_vertex` | `crates/ruvector-cluster/src/consensus.rs:146` |
| `fn` | `add_vertex` | `crates/ruvector-cluster/src/consensus.rs:196` |
| `fn` | `is_finalized` | `crates/ruvector-cluster/src/consensus.rs:226` |
| `fn` | `finalize_vertices` | `crates/ruvector-cluster/src/consensus.rs:232` |
| `fn` | `get_finalized_order` | `crates/ruvector-cluster/src/consensus.rs:268` |
| `fn` | `detect_conflicts` | `crates/ruvector-cluster/src/consensus.rs:322` |
| `fn` | `get_stats` | `crates/ruvector-cluster/src/consensus.rs:334` |
| `fn` | `prune_old_vertices` | `crates/ruvector-cluster/src/consensus.rs:347` |
| `struct` | `ConsensusStats` | `crates/ruvector-cluster/src/consensus.rs:376` |
| `trait` | `DiscoveryService` | `crates/ruvector-cluster/src/discovery.rs:20` |
| `struct` | `StaticDiscovery` | `crates/ruvector-cluster/src/discovery.rs:35` |
| `fn` | `new` | `crates/ruvector-cluster/src/discovery.rs:42` |
| `fn` | `add_node` | `crates/ruvector-cluster/src/discovery.rs:49` |
| `fn` | `remove_node` | `crates/ruvector-cluster/src/discovery.rs:55` |
| `struct` | `GossipDiscovery` | `crates/ruvector-cluster/src/discovery.rs:88` |
| `fn` | `new` | `crates/ruvector-cluster/src/discovery.rs:103` |
| `fn` | `start` | `crates/ruvector-cluster/src/discovery.rs:122` |

_... +66 more — see `catalog/inventory-bootstrap.json`_


## `smp` — 88 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/smp*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `dmb` | `crates/ruvix/crates/smp/src/barriers.rs:86` |
| `fn` | `dmb_ish` | `crates/ruvix/crates/smp/src/barriers.rs:110` |
| `fn` | `dmb_st` | `crates/ruvix/crates/smp/src/barriers.rs:132` |
| `fn` | `dsb` | `crates/ruvix/crates/smp/src/barriers.rs:179` |
| `fn` | `dsb_ish` | `crates/ruvix/crates/smp/src/barriers.rs:200` |
| `fn` | `isb` | `crates/ruvix/crates/smp/src/barriers.rs:242` |
| `fn` | `sev` | `crates/ruvix/crates/smp/src/barriers.rs:281` |
| `fn` | `sevl` | `crates/ruvix/crates/smp/src/barriers.rs:303` |
| `fn` | `wfe` | `crates/ruvix/crates/smp/src/barriers.rs:345` |
| `fn` | `wfi` | `crates/ruvix/crates/smp/src/barriers.rs:388` |
| `fn` | `cpu_yield` | `crates/ruvix/crates/smp/src/barriers.rs:412` |
| `fn` | `release_barrier` | `crates/ruvix/crates/smp/src/barriers.rs:434` |
| `fn` | `sync_barrier` | `crates/ruvix/crates/smp/src/barriers.rs:448` |
| `const` | `MAX_CPUS` | `crates/ruvix/crates/smp/src/cpu.rs:11` |
| `struct` | `CpuId` | `crates/ruvix/crates/smp/src/cpu.rs:31` |
| `const` | `BOOT_CPU` | `crates/ruvix/crates/smp/src/cpu.rs:35` |
| `const` | `fn` | `crates/ruvix/crates/smp/src/cpu.rs:47` |
| `const` | `unsafe` | `crates/ruvix/crates/smp/src/cpu.rs:61` |
| `const` | `fn` | `crates/ruvix/crates/smp/src/cpu.rs:67` |
| `const` | `fn` | `crates/ruvix/crates/smp/src/cpu.rs:73` |
| `const` | `fn` | `crates/ruvix/crates/smp/src/cpu.rs:79` |
| `enum` | `CpuIdError` | `crates/ruvix/crates/smp/src/cpu.rs:132` |
| `enum` | `CpuState` | `crates/ruvix/crates/smp/src/cpu.rs:159` |
| `const` | `fn` | `crates/ruvix/crates/smp/src/cpu.rs:173` |
| `const` | `fn` | `crates/ruvix/crates/smp/src/cpu.rs:179` |

_... +63 more — see `catalog/inventory-bootstrap.json`_


## `rvm-proof` — 85 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-proof*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `ct_eq_32` | `crates/rvm/crates/rvm-proof/src/constant_time.rs:20` |
| `fn` | `ct_eq_64` | `crates/rvm/crates/rvm-proof/src/constant_time.rs:31` |
| `fn` | `ct_eq` | `crates/rvm/crates/rvm-proof/src/constant_time.rs:42` |
| `struct` | `ProofContext` | `crates/rvm/crates/rvm-proof/src/context.rs:13` |
| `struct` | `ProofContextBuilder` | `crates/rvm/crates/rvm-proof/src/context.rs:45` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:63` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:82` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:89` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:96` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:103` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:110` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:117` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:125` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:133` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:140` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/context.rs:147` |
| `struct` | `ProofEngine` | `crates/rvm/crates/rvm-proof/src/engine.rs:18` |
| `const` | `fn` | `crates/rvm/crates/rvm-proof/src/engine.rs:32` |
| `fn` | `verify_and_witness` | `crates/rvm/crates/rvm-proof/src/engine.rs:47` |
| `fn` | `verify_p3` | `crates/rvm/crates/rvm-proof/src/engine.rs:96` |
| `fn` | `verify_p3_with_cap` | `crates/rvm/crates/rvm-proof/src/engine.rs:134` |
| `fn` | `verify_p3_signed` | `crates/rvm/crates/rvm-proof/src/engine.rs:176` |
| `mod` | `constant_time` | `crates/rvm/crates/rvm-proof/src/lib.rs:39` |
| `mod` | `context` | `crates/rvm/crates/rvm-proof/src/lib.rs:40` |
| `mod` | `engine` | `crates/rvm/crates/rvm-proof/src/lib.rs:41` |

_... +60 more — see `catalog/inventory-bootstrap.json`_


## `rvm-cap` — 84 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-cap*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `DerivationNode` | `crates/rvm/crates/rvm-cap/src/derivation.rs:15` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:35` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:49` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:63` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:77` |
| `struct` | `DerivationTree` | `crates/rvm/crates/rvm-cap/src/derivation.rs:91` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:102` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:112` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/derivation.rs:119` |
| `fn` | `add_root` | `crates/rvm/crates/rvm-cap/src/derivation.rs:128` |
| `fn` | `add_child` | `crates/rvm/crates/rvm-cap/src/derivation.rs:144` |
| `fn` | `revoke` | `crates/rvm/crates/rvm-cap/src/derivation.rs:178` |
| `fn` | `depth` | `crates/rvm/crates/rvm-cap/src/derivation.rs:194` |
| `fn` | `is_valid` | `crates/rvm/crates/rvm-cap/src/derivation.rs:204` |
| `fn` | `get` | `crates/rvm/crates/rvm-cap/src/derivation.rs:211` |
| `fn` | `collect_subtree` | `crates/rvm/crates/rvm-cap/src/derivation.rs:227` |
| `fn` | `find_parent` | `crates/rvm/crates/rvm-cap/src/derivation.rs:279` |
| `enum` | `CapError` | `crates/rvm/crates/rvm-cap/src/error.rs:11` |
| `type` | `CapResult` | `crates/rvm/crates/rvm-cap/src/error.rs:67` |
| `enum` | `ProofError` | `crates/rvm/crates/rvm-cap/src/error.rs:71` |
| `struct` | `GrantPolicy` | `crates/rvm/crates/rvm-cap/src/grant.rs:15` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/grant.rs:25` |
| `const` | `fn` | `crates/rvm/crates/rvm-cap/src/grant.rs:34` |
| `fn` | `validate_grant` | `crates/rvm/crates/rvm-cap/src/grant.rs:55` |
| `use` | `derivation` | `crates/rvm/crates/rvm-cap/src/lib.rs:46` |

_... +59 more — see `catalog/inventory-bootstrap.json`_


## `rvm-memory` — 78 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-memory*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `BuddyAllocator` | `crates/rvm/crates/rvm-memory/src/allocator.rs:57` |
| `const` | `REQUIRED_BITMAP_WORDS` | `crates/rvm/crates/rvm-memory/src/allocator.rs:72` |
| `fn` | `new` | `crates/rvm/crates/rvm-memory/src/allocator.rs:82` |
| `fn` | `alloc_pages` | `crates/rvm/crates/rvm-memory/src/allocator.rs:149` |
| `fn` | `free_pages` | `crates/rvm/crates/rvm-memory/src/allocator.rs:203` |
| `fn` | `free_page_count` | `crates/rvm/crates/rvm-memory/src/allocator.rs:244` |
| `mod` | `allocator` | `crates/rvm/crates/rvm-memory/src/lib.rs:44` |
| `mod` | `reconstruction` | `crates/rvm/crates/rvm-memory/src/lib.rs:45` |
| `mod` | `region` | `crates/rvm/crates/rvm-memory/src/lib.rs:46` |
| `mod` | `tier` | `crates/rvm/crates/rvm-memory/src/lib.rs:47` |
| `use` | `allocator` | `crates/rvm/crates/rvm-memory/src/lib.rs:50` |
| `use` | `reconstruction` | `crates/rvm/crates/rvm-memory/src/lib.rs:51` |
| `use` | `region` | `crates/rvm/crates/rvm-memory/src/lib.rs:55` |
| `use` | `tier` | `crates/rvm/crates/rvm-memory/src/lib.rs:56` |
| `const` | `PAGE_SIZE` | `crates/rvm/crates/rvm-memory/src/lib.rs:59` |
| `struct` | `MemoryPermissions` | `crates/rvm/crates/rvm-memory/src/lib.rs:63` |
| `const` | `READ_ONLY` | `crates/rvm/crates/rvm-memory/src/lib.rs:74` |
| `const` | `READ_WRITE` | `crates/rvm/crates/rvm-memory/src/lib.rs:81` |
| `const` | `READ_EXECUTE` | `crates/rvm/crates/rvm-memory/src/lib.rs:88` |
| `struct` | `MemoryRegion` | `crates/rvm/crates/rvm-memory/src/lib.rs:99` |
| `fn` | `validate_region` | `crates/rvm/crates/rvm-memory/src/lib.rs:119` |
| `fn` | `regions_overlap` | `crates/rvm/crates/rvm-memory/src/lib.rs:142` |
| `fn` | `regions_overlap_host` | `crates/rvm/crates/rvm-memory/src/lib.rs:160` |
| `struct` | `CheckpointId` | `crates/rvm/crates/rvm-memory/src/reconstruction.rs:26` |
| `const` | `fn` | `crates/rvm/crates/rvm-memory/src/reconstruction.rs:31` |

_... +53 more — see `catalog/inventory-bootstrap.json`_


## `rvm-hal` — 77 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-hal*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `GP_REG_COUNT` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:11` |
| `fn` | `sanitize_spsr` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:36` |
| `fn` | `validate_elr` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:52` |
| `fn` | `current_el` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:60` |
| `fn` | `configure_hcr_el2` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:90` |
| `fn` | `set_vttbr_el2` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:125` |
| `fn` | `configure_vtcr_el2` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:155` |
| `fn` | `invalidate_tlb` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:181` |
| `fn` | `invalidate_stage2_tlb` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:200` |
| `fn` | `context_switch` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:259` |
| `fn` | `context_switch_vmid` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:415` |
| `fn` | `clear_bss` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:443` |
| `fn` | `wfi_loop` | `crates/rvm/crates/rvm-hal/src/aarch64/boot.rs:470` |
| `const` | `IRQ_SPURIOUS` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:44` |
| `fn` | `gic_init` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:82` |
| `fn` | `gic_enable_irq` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:110` |
| `fn` | `gic_disable_irq` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:161` |
| `fn` | `gic_ack` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:187` |
| `fn` | `gic_eoi` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:204` |
| `struct` | `Aarch64Gic` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:213` |
| `const` | `fn` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:221` |
| `fn` | `init` | `crates/rvm/crates/rvm-hal/src/aarch64/interrupts.rs:230` |
| `const` | `PAGE_SIZE` | `crates/rvm/crates/rvm-hal/src/aarch64/mmu.rs:12` |
| `const` | `VALID` | `crates/rvm/crates/rvm-hal/src/aarch64/mmu.rs:27` |
| `const` | `TABLE` | `crates/rvm/crates/rvm-hal/src/aarch64/mmu.rs:29` |

_... +52 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-subagents` — 76 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-subagents*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `compile_subagents` | `crates/rvAgent/rvagent-subagents/src/builder.rs:31` |
| `fn` | `excluded_state_keys` | `crates/rvAgent/rvagent-subagents/src/builder.rs:123` |
| `fn` | `resolve_tools` | `crates/rvAgent/rvagent-subagents/src/builder.rs:129` |
| `enum` | `MergeError` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:46` |
| `struct` | `VectorClock` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:89` |
| `fn` | `new` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:95` |
| `fn` | `tick` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:102` |
| `fn` | `merge` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:107` |
| `fn` | `happens_before` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:117` |
| `fn` | `get` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:142` |
| `struct` | `LwwRegister` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:168` |
| `fn` | `new` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:176` |
| `fn` | `value` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:185` |
| `fn` | `timestamp` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:190` |
| `fn` | `node_id` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:195` |
| `fn` | `should_win_over` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:202` |
| `struct` | `CrdtState` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:239` |
| `fn` | `new` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:247` |
| `fn` | `set` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:256` |
| `fn` | `get` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:264` |
| `fn` | `clock` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:269` |
| `fn` | `node_id` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:274` |
| `fn` | `keys` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:279` |
| `fn` | `merge` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:291` |
| `fn` | `merge_subagent_results` | `crates/rvAgent/rvagent-subagents/src/crdt_merge.rs:343` |

_... +51 more — see `catalog/inventory-bootstrap.json`_


## `rvm-partition` — 76 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-partition*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `MAX_CAPS_PER_PARTITION` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:6` |
| `struct` | `CapabilityTable` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:10` |
| `fn` | `new` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:18` |
| `fn` | `insert` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:30` |
| `fn` | `get` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:43` |
| `fn` | `remove` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:56` |
| `fn` | `len` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:69` |
| `fn` | `is_empty` | `crates/rvm/crates/rvm-partition/src/cap_table.rs:75` |
| `struct` | `CommEdgeId` | `crates/rvm/crates/rvm-partition/src/comm_edge.rs:8` |
| `const` | `fn` | `crates/rvm/crates/rvm-partition/src/comm_edge.rs:13` |
| `const` | `fn` | `crates/rvm/crates/rvm-partition/src/comm_edge.rs:19` |
| `struct` | `CommEdge` | `crates/rvm/crates/rvm-partition/src/comm_edge.rs:26` |
| `struct` | `DeviceInfo` | `crates/rvm/crates/rvm-partition/src/device.rs:11` |
| `struct` | `ActiveLease` | `crates/rvm/crates/rvm-partition/src/device.rs:28` |
| `struct` | `DeviceLeaseManager` | `crates/rvm/crates/rvm-partition/src/device.rs:51` |
| `fn` | `new` | `crates/rvm/crates/rvm-partition/src/device.rs:77` |
| `fn` | `register_device` | `crates/rvm/crates/rvm-partition/src/device.rs:93` |
| `fn` | `grant_lease` | `crates/rvm/crates/rvm-partition/src/device.rs:120` |
| `fn` | `revoke_lease` | `crates/rvm/crates/rvm-partition/src/device.rs:181` |
| `fn` | `check_lease` | `crates/rvm/crates/rvm-partition/src/device.rs:213` |
| `fn` | `expire_leases` | `crates/rvm/crates/rvm-partition/src/device.rs:233` |
| `fn` | `get_lease_holder` | `crates/rvm/crates/rvm-partition/src/device.rs:270` |
| `fn` | `is_device_available` | `crates/rvm/crates/rvm-partition/src/device.rs:282` |
| `fn` | `device_count` | `crates/rvm/crates/rvm-partition/src/device.rs:289` |
| `fn` | `lease_count` | `crates/rvm/crates/rvm-partition/src/device.rs:295` |

_... +51 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-delta-index` — 72 public items (0 NAPI, 0 WASM)
*crates/ruvector-delta-index*

| Kind | Name | File:Line |
|---|---|---|
| `type` | `Result` | `crates/ruvector-delta-index/src/error.rs:6` |
| `enum` | `IndexError` | `crates/ruvector-delta-index/src/error.rs:10` |
| `struct` | `IncrementalConfig` | `crates/ruvector-delta-index/src/incremental.rs:13` |
| `struct` | `IncrementalUpdater` | `crates/ruvector-delta-index/src/incremental.rs:33` |
| `fn` | `new` | `crates/ruvector-delta-index/src/incremental.rs:41` |
| `fn` | `queue_update` | `crates/ruvector-delta-index/src/incremental.rs:50` |
| `fn` | `needs_flush` | `crates/ruvector-delta-index/src/incremental.rs:62` |
| `fn` | `flush` | `crates/ruvector-delta-index/src/incremental.rs:67` |
| `fn` | `pending_count` | `crates/ruvector-delta-index/src/incremental.rs:98` |
| `fn` | `total_updates` | `crates/ruvector-delta-index/src/incremental.rs:103` |
| `fn` | `clear_pending` | `crates/ruvector-delta-index/src/incremental.rs:108` |
| `struct` | `FlushResult` | `crates/ruvector-delta-index/src/incremental.rs:115` |
| `enum` | `UpdateStrategy` | `crates/ruvector-delta-index/src/incremental.rs:126` |
| `fn` | `select_strategy` | `crates/ruvector-delta-index/src/incremental.rs:138` |
| `struct` | `UpdateStats` | `crates/ruvector-delta-index/src/incremental.rs:158` |
| `fn` | `record` | `crates/ruvector-delta-index/src/incremental.rs:173` |
| `mod` | `error` | `crates/ruvector-delta-index/src/lib.rs:36` |
| `mod` | `incremental` | `crates/ruvector-delta-index/src/lib.rs:37` |
| `mod` | `quality` | `crates/ruvector-delta-index/src/lib.rs:38` |
| `mod` | `repair` | `crates/ruvector-delta-index/src/lib.rs:39` |
| `use` | `error` | `crates/ruvector-delta-index/src/lib.rs:53` |
| `use` | `incremental` | `crates/ruvector-delta-index/src/lib.rs:54` |
| `use` | `quality` | `crates/ruvector-delta-index/src/lib.rs:55` |
| `use` | `repair` | `crates/ruvector-delta-index/src/lib.rs:56` |
| `struct` | `DeltaHnswConfig` | `crates/ruvector-delta-index/src/lib.rs:60` |

_... +47 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-router-core` — 72 public items (0 NAPI, 0 WASM)
*crates/ruvector-router-core*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `calculate_distance` | `crates/ruvector-router-core/src/distance.rs:7` |
| `fn` | `euclidean_distance` | `crates/ruvector-router-core/src/distance.rs:25` |
| `fn` | `cosine_similarity` | `crates/ruvector-router-core/src/distance.rs:55` |
| `fn` | `dot_product` | `crates/ruvector-router-core/src/distance.rs:98` |
| `fn` | `manhattan_distance` | `crates/ruvector-router-core/src/distance.rs:123` |
| `fn` | `batch_distance` | `crates/ruvector-router-core/src/distance.rs:147` |
| `type` | `Result` | `crates/ruvector-router-core/src/error.rs:6` |
| `enum` | `VectorDbError` | `crates/ruvector-router-core/src/error.rs:10` |
| `struct` | `HnswConfig` | `crates/ruvector-router-core/src/index.rs:13` |
| `struct` | `HnswIndex` | `crates/ruvector-router-core/src/index.rs:69` |
| `fn` | `new` | `crates/ruvector-router-core/src/index.rs:78` |
| `fn` | `insert` | `crates/ruvector-router-core/src/index.rs:88` |
| `fn` | `insert_batch` | `crates/ruvector-router-core/src/index.rs:145` |
| `fn` | `search` | `crates/ruvector-router-core/src/index.rs:153` |
| `fn` | `remove` | `crates/ruvector-router-core/src/index.rs:262` |
| `fn` | `len` | `crates/ruvector-router-core/src/index.rs:288` |
| `fn` | `is_empty` | `crates/ruvector-router-core/src/index.rs:293` |
| `mod` | `distance` | `crates/ruvector-router-core/src/lib.rs:15` |
| `mod` | `error` | `crates/ruvector-router-core/src/lib.rs:16` |
| `mod` | `index` | `crates/ruvector-router-core/src/lib.rs:17` |
| `mod` | `quantization` | `crates/ruvector-router-core/src/lib.rs:18` |
| `mod` | `storage` | `crates/ruvector-router-core/src/lib.rs:19` |
| `mod` | `types` | `crates/ruvector-router-core/src/lib.rs:20` |
| `mod` | `vector_db` | `crates/ruvector-router-core/src/lib.rs:21` |
| `use` | `error` | `crates/ruvector-router-core/src/lib.rs:24` |

_... +47 more — see `catalog/inventory-bootstrap.json`_


## `rvm-kernel` — 72 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-kernel*

| Kind | Name | File:Line |
|---|---|---|
| `use` | `rvm_boot` | `crates/rvm/crates/rvm-kernel/src/lib.rs:59` |
| `use` | `rvm_cap` | `crates/rvm/crates/rvm-kernel/src/lib.rs:61` |
| `use` | `rvm_coherence` | `crates/rvm/crates/rvm-kernel/src/lib.rs:63` |
| `use` | `rvm_hal` | `crates/rvm/crates/rvm-kernel/src/lib.rs:65` |
| `use` | `rvm_memory` | `crates/rvm/crates/rvm-kernel/src/lib.rs:67` |
| `use` | `rvm_partition` | `crates/rvm/crates/rvm-kernel/src/lib.rs:69` |
| `use` | `rvm_proof` | `crates/rvm/crates/rvm-kernel/src/lib.rs:71` |
| `use` | `rvm_sched` | `crates/rvm/crates/rvm-kernel/src/lib.rs:73` |
| `use` | `rvm_security` | `crates/rvm/crates/rvm-kernel/src/lib.rs:75` |
| `use` | `rvm_types` | `crates/rvm/crates/rvm-kernel/src/lib.rs:77` |
| `use` | `rvm_wasm` | `crates/rvm/crates/rvm-kernel/src/lib.rs:79` |
| `use` | `rvm_witness` | `crates/rvm/crates/rvm-kernel/src/lib.rs:81` |
| `const` | `VERSION` | `crates/rvm/crates/rvm-kernel/src/lib.rs:84` |
| `const` | `CRATE_COUNT` | `crates/rvm/crates/rvm-kernel/src/lib.rs:87` |
| `mod` | `signer_bridge` | `crates/rvm/crates/rvm-kernel/src/lib.rs:107` |
| `struct` | `CryptoSignerAdapter` | `crates/rvm/crates/rvm-kernel/src/lib.rs:112` |
| `const` | `fn` | `crates/rvm/crates/rvm-kernel/src/lib.rs:118` |
| `fn` | `inner` | `crates/rvm/crates/rvm-kernel/src/lib.rs:123` |
| `use` | `signer_bridge` | `crates/rvm/crates/rvm-kernel/src/lib.rs:152` |
| `struct` | `EpochResult` | `crates/rvm/crates/rvm-kernel/src/lib.rs:202` |
| `enum` | `ApplyResult` | `crates/rvm/crates/rvm-kernel/src/lib.rs:211` |
| `struct` | `Kernel` | `crates/rvm/crates/rvm-kernel/src/lib.rs:235` |
| `struct` | `KernelConfig` | `crates/rvm/crates/rvm-kernel/src/lib.rs:262` |
| `fn` | `new` | `crates/rvm/crates/rvm-kernel/src/lib.rs:284` |
| `fn` | `with_defaults` | `crates/rvm/crates/rvm-kernel/src/lib.rs:302` |

_... +47 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-tools` — 67 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-tools*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `EditFileTool` | `crates/rvAgent/rvagent-tools/src/edit_file.rs:9` |
| `struct` | `ExecuteTool` | `crates/rvAgent/rvagent-tools/src/execute.rs:7` |
| `struct` | `GlobTool` | `crates/rvAgent/rvagent-tools/src/glob.rs:7` |
| `struct` | `GrepTool` | `crates/rvAgent/rvagent-tools/src/grep.rs:10` |
| `mod` | `edit_file` | `crates/rvAgent/rvagent-tools/src/lib.rs:6` |
| `mod` | `execute` | `crates/rvAgent/rvagent-tools/src/lib.rs:7` |
| `mod` | `glob` | `crates/rvAgent/rvagent-tools/src/lib.rs:8` |
| `mod` | `grep` | `crates/rvAgent/rvagent-tools/src/lib.rs:9` |
| `mod` | `ls` | `crates/rvAgent/rvagent-tools/src/lib.rs:10` |
| `mod` | `read_file` | `crates/rvAgent/rvagent-tools/src/lib.rs:11` |
| `mod` | `task` | `crates/rvAgent/rvagent-tools/src/lib.rs:12` |
| `mod` | `write_file` | `crates/rvAgent/rvagent-tools/src/lib.rs:13` |
| `mod` | `write_todos` | `crates/rvAgent/rvagent-tools/src/lib.rs:14` |
| `use` | `edit_file` | `crates/rvAgent/rvagent-tools/src/lib.rs:22` |
| `use` | `execute` | `crates/rvAgent/rvagent-tools/src/lib.rs:23` |
| `use` | `glob` | `crates/rvAgent/rvagent-tools/src/lib.rs:24` |
| `use` | `grep` | `crates/rvAgent/rvagent-tools/src/lib.rs:25` |
| `use` | `ls` | `crates/rvAgent/rvagent-tools/src/lib.rs:26` |
| `use` | `read_file` | `crates/rvAgent/rvagent-tools/src/lib.rs:27` |
| `use` | `task` | `crates/rvAgent/rvagent-tools/src/lib.rs:28` |
| `use` | `write_file` | `crates/rvAgent/rvagent-tools/src/lib.rs:29` |
| `use` | `write_todos` | `crates/rvAgent/rvagent-tools/src/lib.rs:30` |
| `struct` | `FileInfo` | `crates/rvAgent/rvagent-tools/src/lib.rs:38` |
| `struct` | `WriteResult` | `crates/rvAgent/rvagent-tools/src/lib.rs:47` |
| `struct` | `GrepMatch` | `crates/rvAgent/rvagent-tools/src/lib.rs:55` |

_... +42 more — see `catalog/inventory-bootstrap.json`_


## `rvm-wasm` — 64 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-wasm*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AgentId` | `crates/rvm/crates/rvm-wasm/src/agent.rs:13` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/agent.rs:18` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/agent.rs:24` |
| `enum` | `AgentState` | `crates/rvm/crates/rvm-wasm/src/agent.rs:31` |
| `struct` | `AgentConfig` | `crates/rvm/crates/rvm-wasm/src/agent.rs:50` |
| `struct` | `Agent` | `crates/rvm/crates/rvm-wasm/src/agent.rs:61` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/agent.rs:77` |
| `struct` | `AgentManager` | `crates/rvm/crates/rvm-wasm/src/agent.rs:91` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/agent.rs:102` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/agent.rs:111` |
| `fn` | `spawn` | `crates/rvm/crates/rvm-wasm/src/agent.rs:118` |
| `fn` | `activate` | `crates/rvm/crates/rvm-wasm/src/agent.rs:153` |
| `fn` | `suspend` | `crates/rvm/crates/rvm-wasm/src/agent.rs:165` |
| `fn` | `resume` | `crates/rvm/crates/rvm-wasm/src/agent.rs:181` |
| `fn` | `terminate` | `crates/rvm/crates/rvm-wasm/src/agent.rs:201` |
| `fn` | `get` | `crates/rvm/crates/rvm-wasm/src/agent.rs:232` |
| `enum` | `HostFunction` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:14` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:36` |
| `enum` | `HostCallResult` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:52` |
| `fn` | `into_result` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:61` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:70` |
| `struct` | `HostCallArgs` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:77` |
| `const` | `fn` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:89` |
| `trait` | `HostContext` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:103` |
| `struct` | `StubHostContext` | `crates/rvm/crates/rvm-wasm/src/host_functions.rs:160` |

_... +39 more — see `catalog/inventory-bootstrap.json`_


## `rvm-sched` — 61 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-sched*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `DegradedReason` | `crates/rvm/crates/rvm-sched/src/degraded.rs:5` |
| `struct` | `DegradedState` | `crates/rvm/crates/rvm-sched/src/degraded.rs:16` |
| `struct` | `EpochSummary` | `crates/rvm/crates/rvm-sched/src/epoch.rs:5` |
| `struct` | `EpochTracker` | `crates/rvm/crates/rvm-sched/src/epoch.rs:16` |
| `const` | `fn` | `crates/rvm/crates/rvm-sched/src/epoch.rs:24` |
| `fn` | `record_switch` | `crates/rvm/crates/rvm-sched/src/epoch.rs:33` |
| `fn` | `advance` | `crates/rvm/crates/rvm-sched/src/epoch.rs:38` |
| `const` | `fn` | `crates/rvm/crates/rvm-sched/src/epoch.rs:51` |
| `use` | `degraded` | `crates/rvm/crates/rvm-sched/src/lib.rs:57` |
| `use` | `epoch` | `crates/rvm/crates/rvm-sched/src/lib.rs:58` |
| `use` | `modes` | `crates/rvm/crates/rvm-sched/src/lib.rs:59` |
| `use` | `per_cpu` | `crates/rvm/crates/rvm-sched/src/lib.rs:60` |
| `use` | `priority` | `crates/rvm/crates/rvm-sched/src/lib.rs:61` |
| `use` | `scheduler` | `crates/rvm/crates/rvm-sched/src/lib.rs:62` |
| `use` | `smp` | `crates/rvm/crates/rvm-sched/src/lib.rs:63` |
| `use` | `switch` | `crates/rvm/crates/rvm-sched/src/lib.rs:64` |
| `use` | `rvm_types` | `crates/rvm/crates/rvm-sched/src/lib.rs:67` |
| `enum` | `SchedulerMode` | `crates/rvm/crates/rvm-sched/src/modes.rs:5` |
| `struct` | `PerCpuScheduler` | `crates/rvm/crates/rvm-sched/src/per_cpu.rs:12` |
| `const` | `fn` | `crates/rvm/crates/rvm-sched/src/per_cpu.rs:26` |
| `fn` | `compute_priority` | `crates/rvm/crates/rvm-sched/src/priority.rs:12` |
| `const` | `MAX_RUN_QUEUE` | `crates/rvm/crates/rvm-sched/src/scheduler.rs:11` |
| `struct` | `RunQueueEntry` | `crates/rvm/crates/rvm-sched/src/scheduler.rs:22` |
| `const` | `EMPTY` | `crates/rvm/crates/rvm-sched/src/scheduler.rs:36` |
| `const` | `fn` | `crates/rvm/crates/rvm-sched/src/scheduler.rs:46` |

_... +36 more — see `catalog/inventory-bootstrap.json`_


## `drivers` — 59 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/drivers*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `GicError` | `crates/ruvix/crates/drivers/src/gic.rs:82` |
| `const` | `QEMU_VIRT_GIC_START` | `crates/ruvix/crates/drivers/src/gic.rs:97` |
| `const` | `QEMU_VIRT_GIC_END` | `crates/ruvix/crates/drivers/src/gic.rs:98` |
| `const` | `BCM2711_GIC_START` | `crates/ruvix/crates/drivers/src/gic.rs:101` |
| `const` | `BCM2711_GIC_END` | `crates/ruvix/crates/drivers/src/gic.rs:102` |
| `const` | `GENERIC_PERIPH_START` | `crates/ruvix/crates/drivers/src/gic.rs:105` |
| `const` | `GENERIC_PERIPH_END` | `crates/ruvix/crates/drivers/src/gic.rs:106` |
| `fn` | `is_valid_gic_address` | `crates/ruvix/crates/drivers/src/gic.rs:110` |
| `struct` | `Gic` | `crates/ruvix/crates/drivers/src/gic.rs:127` |
| `fn` | `new` | `crates/ruvix/crates/drivers/src/gic.rs:154` |
| `const` | `unsafe` | `crates/ruvix/crates/drivers/src/gic.rs:177` |
| `fn` | `init` | `crates/ruvix/crates/drivers/src/gic.rs:196` |
| `fn` | `enable` | `crates/ruvix/crates/drivers/src/gic.rs:266` |
| `fn` | `disable` | `crates/ruvix/crates/drivers/src/gic.rs:293` |
| `fn` | `set_priority` | `crates/ruvix/crates/drivers/src/gic.rs:321` |
| `fn` | `acknowledge` | `crates/ruvix/crates/drivers/src/gic.rs:342` |
| `fn` | `end_of_interrupt` | `crates/ruvix/crates/drivers/src/gic.rs:365` |
| `fn` | `is_pending` | `crates/ruvix/crates/drivers/src/gic.rs:385` |
| `fn` | `max_interrupts` | `crates/ruvix/crates/drivers/src/gic.rs:400` |
| `mod` | `gic` | `crates/ruvix/crates/drivers/src/lib.rs:55` |
| `mod` | `mmio` | `crates/ruvix/crates/drivers/src/lib.rs:56` |
| `mod` | `pl011` | `crates/ruvix/crates/drivers/src/lib.rs:57` |
| `mod` | `timer` | `crates/ruvix/crates/drivers/src/lib.rs:58` |
| `use` | `gic` | `crates/ruvix/crates/drivers/src/lib.rs:60` |
| `use` | `pl011` | `crates/ruvix/crates/drivers/src/lib.rs:61` |

_... +34 more — see `catalog/inventory-bootstrap.json`_


## `agentic-flow` — 58 public items (0 NAPI, 0 WASM)
*crates/rvf/rvf-adapters/agentic-flow*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AgenticFlowConfig` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:7` |
| `fn` | `new` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:24` |
| `fn` | `with_dimension` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:35` |
| `fn` | `with_witness` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:41` |
| `fn` | `with_swarm_id` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:47` |
| `fn` | `store_path` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:53` |
| `fn` | `witness_path` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:58` |
| `fn` | `ensure_dirs` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:63` |
| `fn` | `validate` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:68` |
| `enum` | `ConfigError` | `crates/rvf/rvf-adapters/agentic-flow/src/config.rs:81` |
| `struct` | `StateEntry` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:9` |
| `struct` | `ConsensusVote` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:22` |
| `struct` | `SwarmCoordination` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:38` |
| `fn` | `new` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:45` |
| `fn` | `record_state` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:53` |
| `fn` | `get_agent_states` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:75` |
| `fn` | `get_all_states` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:84` |
| `fn` | `record_consensus_vote` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:89` |
| `fn` | `get_votes` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:111` |
| `fn` | `state_count` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:120` |
| `fn` | `vote_count` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:125` |
| `enum` | `CoordinationError` | `crates/rvf/rvf-adapters/agentic-flow/src/coordination.rs:138` |
| `struct` | `PatternResult` | `crates/rvf/rvf-adapters/agentic-flow/src/learning.rs:11` |
| `struct` | `LearningPatternStore` | `crates/rvf/rvf-adapters/agentic-flow/src/learning.rs:37` |
| `fn` | `new` | `crates/rvf/rvf-adapters/agentic-flow/src/learning.rs:46` |

_... +33 more — see `catalog/inventory-bootstrap.json`_


## `agentic-robotics-core` — 58 public items (0 NAPI, 0 WASM)
*crates/agentic-robotics-core*

| Kind | Name | File:Line |
|---|---|---|
| `type` | `Result` | `crates/agentic-robotics-core/src/error.rs:5` |
| `enum` | `Error` | `crates/agentic-robotics-core/src/error.rs:8` |
| `mod` | `middleware` | `crates/agentic-robotics-core/src/lib.rs:6` |
| `mod` | `serialization` | `crates/agentic-robotics-core/src/lib.rs:7` |
| `mod` | `message` | `crates/agentic-robotics-core/src/lib.rs:8` |
| `mod` | `publisher` | `crates/agentic-robotics-core/src/lib.rs:9` |
| `mod` | `subscriber` | `crates/agentic-robotics-core/src/lib.rs:10` |
| `mod` | `service` | `crates/agentic-robotics-core/src/lib.rs:11` |
| `mod` | `error` | `crates/agentic-robotics-core/src/lib.rs:12` |
| `use` | `middleware` | `crates/agentic-robotics-core/src/lib.rs:14` |
| `use` | `message` | `crates/agentic-robotics-core/src/lib.rs:15` |
| `use` | `publisher` | `crates/agentic-robotics-core/src/lib.rs:16` |
| `use` | `subscriber` | `crates/agentic-robotics-core/src/lib.rs:17` |
| `use` | `service` | `crates/agentic-robotics-core/src/lib.rs:18` |
| `use` | `error` | `crates/agentic-robotics-core/src/lib.rs:19` |
| `const` | `VERSION` | `crates/agentic-robotics-core/src/lib.rs:22` |
| `fn` | `init` | `crates/agentic-robotics-core/src/lib.rs:25` |
| `trait` | `Message` | `crates/agentic-robotics-core/src/message.rs:7` |
| `struct` | `RobotState` | `crates/agentic-robotics-core/src/message.rs:26` |
| `struct` | `Point3D` | `crates/agentic-robotics-core/src/message.rs:50` |
| `struct` | `PointCloud` | `crates/agentic-robotics-core/src/message.rs:58` |
| `struct` | `Pose` | `crates/agentic-robotics-core/src/message.rs:82` |
| `struct` | `Zenoh` | `crates/agentic-robotics-core/src/middleware.rs:11` |
| `struct` | `ZenohConfig` | `crates/agentic-robotics-core/src/middleware.rs:17` |
| `fn` | `new` | `crates/agentic-robotics-core/src/middleware.rs:35` |

_... +33 more — see `catalog/inventory-bootstrap.json`_


## `hal` — 58 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/hal*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `ConsoleError` | `crates/ruvix/crates/hal/src/console.rs:27` |
| `trait` | `Console` | `crates/ruvix/crates/hal/src/console.rs:101` |
| `trait` | `BufferedConsole` | `crates/ruvix/crates/hal/src/console.rs:174` |
| `enum` | `InterruptError` | `crates/ruvix/crates/hal/src/interrupt.rs:30` |
| `enum` | `TriggerMode` | `crates/ruvix/crates/hal/src/interrupt.rs:54` |
| `enum` | `InterruptType` | `crates/ruvix/crates/hal/src/interrupt.rs:63` |
| `trait` | `InterruptController` | `crates/ruvix/crates/hal/src/interrupt.rs:202` |
| `struct` | `InterruptGuard` | `crates/ruvix/crates/hal/src/interrupt.rs:319` |
| `fn` | `new` | `crates/ruvix/crates/hal/src/interrupt.rs:328` |
| `mod` | `console` | `crates/ruvix/crates/hal/src/lib.rs:52` |
| `mod` | `interrupt` | `crates/ruvix/crates/hal/src/lib.rs:53` |
| `mod` | `mmu` | `crates/ruvix/crates/hal/src/lib.rs:54` |
| `mod` | `power` | `crates/ruvix/crates/hal/src/lib.rs:55` |
| `mod` | `timer` | `crates/ruvix/crates/hal/src/lib.rs:56` |
| `use` | `console` | `crates/ruvix/crates/hal/src/lib.rs:58` |
| `use` | `interrupt` | `crates/ruvix/crates/hal/src/lib.rs:59` |
| `use` | `mmu` | `crates/ruvix/crates/hal/src/lib.rs:60` |
| `use` | `power` | `crates/ruvix/crates/hal/src/lib.rs:61` |
| `use` | `timer` | `crates/ruvix/crates/hal/src/lib.rs:62` |
| `const` | `VERSION` | `crates/ruvix/crates/hal/src/lib.rs:65` |
| `mod` | `prelude` | `crates/ruvix/crates/hal/src/lib.rs:68` |
| `use` | `crate` | `crates/ruvix/crates/hal/src/lib.rs:69` |
| `enum` | `MmuError` | `crates/ruvix/crates/hal/src/mmu.rs:39` |
| `struct` | `PagePermissions` | `crates/ruvix/crates/hal/src/mmu.rs:75` |
| `const` | `NONE` | `crates/ruvix/crates/hal/src/mmu.rs:79` |

_... +33 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-cli` — 58 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-cli*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `A2aCommand` | `crates/rvAgent/rvagent-cli/src/a2a.rs:43` |
| `enum` | `A2aAction` | `crates/rvAgent/rvagent-cli/src/a2a.rs:49` |
| `struct` | `ServeArgs` | `crates/rvAgent/rvagent-cli/src/a2a.rs:59` |
| `struct` | `DiscoverArgs` | `crates/rvAgent/rvagent-cli/src/a2a.rs:81` |
| `struct` | `SendTaskArgs` | `crates/rvAgent/rvagent-cli/src/a2a.rs:87` |
| `fn` | `run` | `crates/rvAgent/rvagent-cli/src/a2a.rs:113` |
| `struct` | `App` | `crates/rvAgent/rvagent-cli/src/app.rs:427` |
| `fn` | `new` | `crates/rvAgent/rvagent-cli/src/app.rs:446` |
| `fn` | `run_once` | `crates/rvAgent/rvagent-cli/src/app.rs:499` |
| `fn` | `run_interactive` | `crates/rvAgent/rvagent-cli/src/app.rs:519` |
| `enum` | `TuiEvent` | `crates/rvAgent/rvagent-cli/src/app.rs:662` |
| `fn` | `print_assistant_message` | `crates/rvAgent/rvagent-cli/src/display.rs:16` |
| `fn` | `print_markdown` | `crates/rvAgent/rvagent-cli/src/display.rs:48` |
| `fn` | `print_tool_call` | `crates/rvAgent/rvagent-cli/src/display.rs:107` |
| `fn` | `print_tool_result` | `crates/rvAgent/rvagent-cli/src/display.rs:121` |
| `fn` | `print_error` | `crates/rvAgent/rvagent-cli/src/display.rs:167` |
| `fn` | `syntax_label` | `crates/rvAgent/rvagent-cli/src/display.rs:198` |
| `struct` | `McpToolDef` | `crates/rvAgent/rvagent-cli/src/mcp.rs:22` |
| `struct` | `McpServerConfig` | `crates/rvAgent/rvagent-cli/src/mcp.rs:35` |
| `enum` | `McpTransport` | `crates/rvAgent/rvagent-cli/src/mcp.rs:48` |
| `struct` | `McpToolCall` | `crates/rvAgent/rvagent-cli/src/mcp.rs:76` |
| `struct` | `McpToolResult` | `crates/rvAgent/rvagent-cli/src/mcp.rs:85` |
| `enum` | `McpContent` | `crates/rvAgent/rvagent-cli/src/mcp.rs:95` |
| `fn` | `text_content` | `crates/rvAgent/rvagent-cli/src/mcp.rs:106` |
| `struct` | `McpClient` | `crates/rvAgent/rvagent-cli/src/mcp.rs:123` |

_... +33 more — see `catalog/inventory-bootstrap.json`_


## `rvm-boot` — 54 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-boot*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `BootContext` | `crates/rvm/crates/rvm-boot/src/entry.rs:23` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/entry.rs:39` |
| `fn` | `run_boot_sequence` | `crates/rvm/crates/rvm-boot/src/entry.rs:72` |
| `struct` | `UartConfig` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:12` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:22` |
| `struct` | `MmuConfig` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:32` |
| `struct` | `InterruptConfig` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:43` |
| `trait` | `HalInit` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:54` |
| `struct` | `StubHal` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:78` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/hal_init.rs:90` |
| `mod` | `entry` | `crates/rvm/crates/rvm-boot/src/lib.rs:58` |
| `mod` | `hal_init` | `crates/rvm/crates/rvm-boot/src/lib.rs:59` |
| `mod` | `measured` | `crates/rvm/crates/rvm-boot/src/lib.rs:60` |
| `mod` | `sequence` | `crates/rvm/crates/rvm-boot/src/lib.rs:61` |
| `use` | `entry` | `crates/rvm/crates/rvm-boot/src/lib.rs:66` |
| `use` | `hal_init` | `crates/rvm/crates/rvm-boot/src/lib.rs:67` |
| `use` | `measured` | `crates/rvm/crates/rvm-boot/src/lib.rs:68` |
| `use` | `sequence` | `crates/rvm/crates/rvm-boot/src/lib.rs:69` |
| `enum` | `BootPhase` | `crates/rvm/crates/rvm-boot/src/lib.rs:74` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/lib.rs:94` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/lib.rs:108` |
| `struct` | `BootTracker` | `crates/rvm/crates/rvm-boot/src/lib.rs:123` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/lib.rs:131` |
| `const` | `fn` | `crates/rvm/crates/rvm-boot/src/lib.rs:140` |
| `fn` | `complete_phase` | `crates/rvm/crates/rvm-boot/src/lib.rs:148` |

_... +29 more — see `catalog/inventory-bootstrap.json`_


## `agentdb` — 53 public items (0 NAPI, 0 WASM)
*crates/rvf/rvf-adapters/agentdb*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `IndexAdapterConfig` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:19` |
| `struct` | `RvfIndexAdapter` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:51` |
| `fn` | `new` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:62` |
| `fn` | `build` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:76` |
| `fn` | `extract_layer_a` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:110` |
| `fn` | `extract_layer_b` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:132` |
| `fn` | `extract_layer_c` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:141` |
| `fn` | `load_progressive` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:147` |
| `fn` | `search` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:168` |
| `fn` | `search_full` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:176` |
| `fn` | `node_count` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:187` |
| `fn` | `loaded_layers` | `crates/rvf/rvf-adapters/agentdb/src/index_adapter.rs:192` |
| `mod` | `index_adapter` | `crates/rvf/rvf-adapters/agentdb/src/lib.rs:12` |
| `mod` | `pattern_store` | `crates/rvf/rvf-adapters/agentdb/src/lib.rs:13` |
| `mod` | `vector_store` | `crates/rvf/rvf-adapters/agentdb/src/lib.rs:14` |
| `use` | `index_adapter` | `crates/rvf/rvf-adapters/agentdb/src/lib.rs:16` |
| `use` | `pattern_store` | `crates/rvf/rvf-adapters/agentdb/src/lib.rs:17` |
| `use` | `vector_store` | `crates/rvf/rvf-adapters/agentdb/src/lib.rs:18` |
| `struct` | `MemoryPattern` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:17` |
| `const` | `TASK` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:34` |
| `const` | `REWARD` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:35` |
| `const` | `SUCCESS` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:36` |
| `const` | `CRITIQUE` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:37` |
| `struct` | `RvfPatternStore` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:44` |
| `fn` | `create` | `crates/rvf/rvf-adapters/agentdb/src/pattern_store.rs:61` |

_... +28 more — see `catalog/inventory-bootstrap.json`_


## `rvf-adapters/sona` — 51 public items (0 NAPI, 0 WASM)
*crates/rvf/rvf-adapters/sona*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `SonaConfig` | `crates/rvf/rvf-adapters/sona/src/config.rs:7` |
| `fn` | `new` | `crates/rvf/rvf-adapters/sona/src/config.rs:20` |
| `fn` | `with_replay_capacity` | `crates/rvf/rvf-adapters/sona/src/config.rs:30` |
| `fn` | `with_trajectory_window` | `crates/rvf/rvf-adapters/sona/src/config.rs:36` |
| `fn` | `store_path` | `crates/rvf/rvf-adapters/sona/src/config.rs:42` |
| `fn` | `ensure_dirs` | `crates/rvf/rvf-adapters/sona/src/config.rs:47` |
| `fn` | `validate` | `crates/rvf/rvf-adapters/sona/src/config.rs:52` |
| `enum` | `ConfigError` | `crates/rvf/rvf-adapters/sona/src/config.rs:68` |
| `struct` | `Experience` | `crates/rvf/rvf-adapters/sona/src/experience.rs:30` |
| `struct` | `ExperienceReplayBuffer` | `crates/rvf/rvf-adapters/sona/src/experience.rs:42` |
| `fn` | `create` | `crates/rvf/rvf-adapters/sona/src/experience.rs:55` |
| `fn` | `push` | `crates/rvf/rvf-adapters/sona/src/experience.rs:86` |
| `fn` | `sample` | `crates/rvf/rvf-adapters/sona/src/experience.rs:151` |
| `fn` | `sample_prioritized` | `crates/rvf/rvf-adapters/sona/src/experience.rs:201` |
| `fn` | `len` | `crates/rvf/rvf-adapters/sona/src/experience.rs:222` |
| `fn` | `is_empty` | `crates/rvf/rvf-adapters/sona/src/experience.rs:227` |
| `fn` | `is_full` | `crates/rvf/rvf-adapters/sona/src/experience.rs:232` |
| `fn` | `close` | `crates/rvf/rvf-adapters/sona/src/experience.rs:237` |
| `enum` | `ExperienceStoreError` | `crates/rvf/rvf-adapters/sona/src/experience.rs:275` |
| `mod` | `config` | `crates/rvf/rvf-adapters/sona/src/lib.rs:36` |
| `mod` | `experience` | `crates/rvf/rvf-adapters/sona/src/lib.rs:37` |
| `mod` | `pattern` | `crates/rvf/rvf-adapters/sona/src/lib.rs:38` |
| `mod` | `trajectory` | `crates/rvf/rvf-adapters/sona/src/lib.rs:39` |
| `use` | `config` | `crates/rvf/rvf-adapters/sona/src/lib.rs:41` |
| `use` | `experience` | `crates/rvf/rvf-adapters/sona/src/lib.rs:42` |

_... +26 more — see `catalog/inventory-bootstrap.json`_


## `rvm-security` — 51 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-security*

| Kind | Name | File:Line |
|---|---|---|
| `const` | `MAX_ATTESTATION_ENTRIES` | `crates/rvm/crates/rvm-security/src/attestation.rs:17` |
| `struct` | `AttestationEntry` | `crates/rvm/crates/rvm-security/src/attestation.rs:21` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/attestation.rs:33` |
| `struct` | `AttestationChain` | `crates/rvm/crates/rvm-security/src/attestation.rs:44` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/attestation.rs:57` |
| `fn` | `add_boot_measurement` | `crates/rvm/crates/rvm-security/src/attestation.rs:68` |
| `fn` | `add_runtime_witness` | `crates/rvm/crates/rvm-security/src/attestation.rs:75` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/attestation.rs:138` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/attestation.rs:144` |
| `fn` | `generate_attestation_report` | `crates/rvm/crates/rvm-security/src/attestation.rs:151` |
| `struct` | `AttestationReport` | `crates/rvm/crates/rvm-security/src/attestation.rs:191` |
| `fn` | `verify_attestation` | `crates/rvm/crates/rvm-security/src/attestation.rs:208` |
| `struct` | `DmaBudget` | `crates/rvm/crates/rvm-security/src/budget.rs:15` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/budget.rs:25` |
| `fn` | `check_dma` | `crates/rvm/crates/rvm-security/src/budget.rs:39` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/budget.rs:59` |
| `fn` | `reset` | `crates/rvm/crates/rvm-security/src/budget.rs:64` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/budget.rs:70` |
| `struct` | `ResourceQuota` | `crates/rvm/crates/rvm-security/src/budget.rs:79` |
| `const` | `fn` | `crates/rvm/crates/rvm-security/src/budget.rs:99` |
| `fn` | `check_cpu_time` | `crates/rvm/crates/rvm-security/src/budget.rs:121` |
| `fn` | `check_memory` | `crates/rvm/crates/rvm-security/src/budget.rs:140` |
| `fn` | `check_ipc` | `crates/rvm/crates/rvm-security/src/budget.rs:159` |
| `fn` | `release_memory` | `crates/rvm/crates/rvm-security/src/budget.rs:168` |
| `fn` | `reset_epoch` | `crates/rvm/crates/rvm-security/src/budget.rs:173` |

_... +26 more — see `catalog/inventory-bootstrap.json`_


## `rvm-witness` — 50 public items (0 NAPI, 0 WASM)
*crates/rvm/crates/rvm-witness*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `WitnessEmitter` | `crates/rvm/crates/rvm-witness/src/emit.rs:7` |
| `const` | `fn` | `crates/rvm/crates/rvm-witness/src/emit.rs:14` |
| `fn` | `emit_partition_create` | `crates/rvm/crates/rvm-witness/src/emit.rs:20` |
| `fn` | `emit_partition_destroy` | `crates/rvm/crates/rvm-witness/src/emit.rs:35` |
| `fn` | `emit_capability_grant` | `crates/rvm/crates/rvm-witness/src/emit.rs:50` |
| `fn` | `emit_capability_revoke` | `crates/rvm/crates/rvm-witness/src/emit.rs:66` |
| `fn` | `emit_memory_map` | `crates/rvm/crates/rvm-witness/src/emit.rs:81` |
| `fn` | `emit_proof_rejected` | `crates/rvm/crates/rvm-witness/src/emit.rs:97` |
| `use` | `rvm_types` | `crates/rvm/crates/rvm-witness/src/hash.rs:9` |
| `fn` | `compute_chain_hash` | `crates/rvm/crates/rvm-witness/src/hash.rs:23` |
| `fn` | `compute_record_hash` | `crates/rvm/crates/rvm-witness/src/hash.rs:42` |
| `fn` | `compute_chain_hash` | `crates/rvm/crates/rvm-witness/src/hash.rs:86` |
| `fn` | `compute_record_hash` | `crates/rvm/crates/rvm-witness/src/hash.rs:99` |
| `use` | `emit` | `crates/rvm/crates/rvm-witness/src/lib.rs:50` |
| `use` | `hash` | `crates/rvm/crates/rvm-witness/src/lib.rs:51` |
| `use` | `log` | `crates/rvm/crates/rvm-witness/src/lib.rs:52` |
| `use` | `record` | `crates/rvm/crates/rvm-witness/src/lib.rs:53` |
| `use` | `replay` | `crates/rvm/crates/rvm-witness/src/lib.rs:54` |
| `use` | `signer` | `crates/rvm/crates/rvm-witness/src/lib.rs:60` |
| `use` | `signer` | `crates/rvm/crates/rvm-witness/src/lib.rs:61` |
| `use` | `signer` | `crates/rvm/crates/rvm-witness/src/lib.rs:63` |
| `const` | `DEFAULT_RING_CAPACITY` | `crates/rvm/crates/rvm-witness/src/lib.rs:66` |
| `struct` | `WitnessLog` | `crates/rvm/crates/rvm-witness/src/log.rs:22` |
| `fn` | `new` | `crates/rvm/crates/rvm-witness/src/log.rs:50` |
| `fn` | `append` | `crates/rvm/crates/rvm-witness/src/log.rs:80` |

_... +25 more — see `catalog/inventory-bootstrap.json`_


## `shell` — 50 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/shell*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/caps.rs:63` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/cpu.rs:9` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/info.rs:28` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/mem.rs:26` |
| `mod` | `caps` | `crates/ruvix/crates/shell/src/commands/mod.rs:5` |
| `mod` | `cpu` | `crates/ruvix/crates/shell/src/commands/mod.rs:6` |
| `mod` | `info` | `crates/ruvix/crates/shell/src/commands/mod.rs:7` |
| `mod` | `mem` | `crates/ruvix/crates/shell/src/commands/mod.rs:8` |
| `mod` | `perf` | `crates/ruvix/crates/shell/src/commands/mod.rs:9` |
| `mod` | `proofs` | `crates/ruvix/crates/shell/src/commands/mod.rs:10` |
| `mod` | `queues` | `crates/ruvix/crates/shell/src/commands/mod.rs:11` |
| `mod` | `tasks` | `crates/ruvix/crates/shell/src/commands/mod.rs:12` |
| `mod` | `vectors` | `crates/ruvix/crates/shell/src/commands/mod.rs:13` |
| `mod` | `witness` | `crates/ruvix/crates/shell/src/commands/mod.rs:14` |
| `mod` | `help` | `crates/ruvix/crates/shell/src/commands/mod.rs:17` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/mod.rs:22` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/perf.rs:26` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/proofs.rs:9` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/queues.rs:9` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/tasks.rs:26` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/vectors.rs:26` |
| `fn` | `execute` | `crates/ruvix/crates/shell/src/commands/witness.rs:42` |
| `mod` | `commands` | `crates/ruvix/crates/shell/src/lib.rs:56` |
| `use` | `parser` | `crates/ruvix/crates/shell/src/lib.rs:59` |
| `struct` | `ShellConfig` | `crates/ruvix/crates/shell/src/lib.rs:67` |

_... +25 more — see `catalog/inventory-bootstrap.json`_


## `rvagent-acp` — 46 public items (0 NAPI, 0 WASM)
*crates/rvAgent/rvagent-acp*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `Session` | `crates/rvAgent/rvagent-acp/src/agent.rs:30` |
| `struct` | `AcpAgent` | `crates/rvAgent/rvagent-acp/src/agent.rs:111` |
| `fn` | `new` | `crates/rvAgent/rvagent-acp/src/agent.rs:119` |
| `fn` | `create_session` | `crates/rvAgent/rvagent-acp/src/agent.rs:127` |
| `fn` | `list_sessions` | `crates/rvAgent/rvagent-acp/src/agent.rs:136` |
| `fn` | `get_session` | `crates/rvAgent/rvagent-acp/src/agent.rs:142` |
| `fn` | `delete_session` | `crates/rvAgent/rvagent-acp/src/agent.rs:148` |
| `fn` | `prompt` | `crates/rvAgent/rvagent-acp/src/agent.rs:157` |
| `fn` | `config` | `crates/rvAgent/rvagent-acp/src/agent.rs:242` |
| `struct` | `ApiKeyState` | `crates/rvAgent/rvagent-acp/src/auth.rs:30` |
| `fn` | `require_api_key` | `crates/rvAgent/rvagent-acp/src/auth.rs:38` |
| `struct` | `RateLimiterState` | `crates/rvAgent/rvagent-acp/src/auth.rs:99` |
| `fn` | `new` | `crates/rvAgent/rvagent-acp/src/auth.rs:108` |
| `fn` | `try_acquire` | `crates/rvAgent/rvagent-acp/src/auth.rs:116` |
| `fn` | `rate_limiter` | `crates/rvAgent/rvagent-acp/src/auth.rs:144` |
| `fn` | `request_size_limit` | `crates/rvAgent/rvagent-acp/src/auth.rs:184` |
| `struct` | `MaxBodySize` | `crates/rvAgent/rvagent-acp/src/auth.rs:219` |
| `struct` | `RequireTls` | `crates/rvAgent/rvagent-acp/src/auth.rs:227` |
| `fn` | `require_tls_middleware` | `crates/rvAgent/rvagent-acp/src/auth.rs:233` |
| `mod` | `agent` | `crates/rvAgent/rvagent-acp/src/lib.rs:7` |
| `mod` | `auth` | `crates/rvAgent/rvagent-acp/src/lib.rs:8` |
| `mod` | `server` | `crates/rvAgent/rvagent-acp/src/lib.rs:9` |
| `mod` | `types` | `crates/rvAgent/rvagent-acp/src/lib.rs:10` |
| `struct` | `AcpConfig` | `crates/rvAgent/rvagent-acp/src/server.rs:40` |
| `struct` | `AppState` | `crates/rvAgent/rvagent-acp/src/server.rs:79` |

_... +21 more — see `catalog/inventory-bootstrap.json`_


## `aarch64` — 42 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/aarch64*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `ExceptionClass` | `crates/ruvix/crates/aarch64/src/exception.rs:14` |
| `fn` | `from_esr` | `crates/ruvix/crates/aarch64/src/exception.rs:77` |
| `struct` | `ExceptionContext` | `crates/ruvix/crates/aarch64/src/exception.rs:116` |
| `mod` | `boot` | `crates/ruvix/crates/aarch64/src/lib.rs:32` |
| `mod` | `exception` | `crates/ruvix/crates/aarch64/src/lib.rs:34` |
| `mod` | `mmu` | `crates/ruvix/crates/aarch64/src/lib.rs:36` |
| `mod` | `registers` | `crates/ruvix/crates/aarch64/src/lib.rs:38` |
| `use` | `boot` | `crates/ruvix/crates/aarch64/src/lib.rs:42` |
| `use` | `mmu` | `crates/ruvix/crates/aarch64/src/lib.rs:44` |
| `use` | `registers` | `crates/ruvix/crates/aarch64/src/lib.rs:46` |
| `const` | `PAGE_SIZE` | `crates/ruvix/crates/aarch64/src/lib.rs:49` |
| `const` | `PAGE_SHIFT` | `crates/ruvix/crates/aarch64/src/lib.rs:52` |
| `const` | `KERNEL_VIRT_BASE` | `crates/ruvix/crates/aarch64/src/lib.rs:55` |
| `const` | `PHYS_RAM_BASE` | `crates/ruvix/crates/aarch64/src/lib.rs:59` |
| `const` | `PHYS_RAM_BASE` | `crates/ruvix/crates/aarch64/src/lib.rs:62` |
| `const` | `VECTOR_ALIGNMENT` | `crates/ruvix/crates/aarch64/src/lib.rs:65` |
| `const` | `fn` | `crates/ruvix/crates/aarch64/src/lib.rs:69` |
| `const` | `fn` | `crates/ruvix/crates/aarch64/src/lib.rs:75` |
| `const` | `VALID` | `crates/ruvix/crates/aarch64/src/mmu.rs:27` |
| `const` | `PAGE` | `crates/ruvix/crates/aarch64/src/mmu.rs:29` |
| `const` | `USER` | `crates/ruvix/crates/aarch64/src/mmu.rs:31` |
| `const` | `RO` | `crates/ruvix/crates/aarch64/src/mmu.rs:33` |
| `const` | `SHAREABLE` | `crates/ruvix/crates/aarch64/src/mmu.rs:35` |
| `const` | `AF` | `crates/ruvix/crates/aarch64/src/mmu.rs:37` |
| `const` | `XN` | `crates/ruvix/crates/aarch64/src/mmu.rs:39` |

_... +17 more — see `catalog/inventory-bootstrap.json`_


## `ospipe` — 40 public items (0 NAPI, 0 WASM)
*crates/rvf/rvf-adapters/ospipe*

| Kind | Name | File:Line |
|---|---|---|
| `mod` | `observation_store` | `crates/rvf/rvf-adapters/ospipe/src/lib.rs:13` |
| `mod` | `pipeline` | `crates/rvf/rvf-adapters/ospipe/src/lib.rs:14` |
| `use` | `observation_store` | `crates/rvf/rvf-adapters/ospipe/src/lib.rs:16` |
| `use` | `pipeline` | `crates/rvf/rvf-adapters/ospipe/src/lib.rs:17` |
| `mod` | `fields` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:25` |
| `const` | `CONTENT_TYPE` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:27` |
| `const` | `APP_NAME` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:29` |
| `const` | `TIMESTAMP_SECS` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:31` |
| `const` | `MONITOR_ID` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:33` |
| `struct` | `ObservationMeta` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:38` |
| `struct` | `ObservationStoreConfig` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:84` |
| `fn` | `new` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:95` |
| `fn` | `with_metric` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:104` |
| `struct` | `RvfObservationStore` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:121` |
| `fn` | `create` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:130` |
| `fn` | `open` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:154` |
| `fn` | `open_readonly` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:168` |
| `fn` | `record_observation` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:182` |
| `fn` | `record_batch` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:203` |
| `fn` | `query_similar_states` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:258` |
| `fn` | `query_filtered` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:269` |
| `fn` | `get_state_history` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:288` |
| `fn` | `compact_history` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:306` |
| `fn` | `delete_observations` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:311` |
| `fn` | `delete_by_filter` | `crates/rvf/rvf-adapters/ospipe/src/observation_store.rs:319` |

_... +15 more — see `catalog/inventory-bootstrap.json`_


## `ruqu-algorithms` — 40 public items (0 NAPI, 0 WASM)
*crates/ruqu-algorithms*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `GroverConfig` | `crates/ruqu-algorithms/src/grover.rs:28` |
| `struct` | `GroverResult` | `crates/ruqu-algorithms/src/grover.rs:42` |
| `fn` | `optimal_iterations` | `crates/ruqu-algorithms/src/grover.rs:69` |
| `fn` | `run_grover` | `crates/ruqu-algorithms/src/grover.rs:98` |
| `mod` | `grover` | `crates/ruqu-algorithms/src/lib.rs:37` |
| `mod` | `qaoa` | `crates/ruqu-algorithms/src/lib.rs:38` |
| `mod` | `surface_code` | `crates/ruqu-algorithms/src/lib.rs:39` |
| `mod` | `vqe` | `crates/ruqu-algorithms/src/lib.rs:40` |
| `use` | `grover` | `crates/ruqu-algorithms/src/lib.rs:42` |
| `use` | `qaoa` | `crates/ruqu-algorithms/src/lib.rs:43` |
| `use` | `surface_code` | `crates/ruqu-algorithms/src/lib.rs:44` |
| `use` | `vqe` | `crates/ruqu-algorithms/src/lib.rs:45` |
| `struct` | `Graph` | `crates/ruqu-algorithms/src/qaoa.rs:34` |
| `fn` | `new` | `crates/ruqu-algorithms/src/qaoa.rs:44` |
| `fn` | `add_edge` | `crates/ruqu-algorithms/src/qaoa.rs:56` |
| `fn` | `unweighted` | `crates/ruqu-algorithms/src/qaoa.rs:63` |
| `fn` | `num_edges` | `crates/ruqu-algorithms/src/qaoa.rs:72` |
| `struct` | `QaoaConfig` | `crates/ruqu-algorithms/src/qaoa.rs:82` |
| `struct` | `QaoaResult` | `crates/ruqu-algorithms/src/qaoa.rs:96` |
| `fn` | `build_qaoa_circuit` | `crates/ruqu-algorithms/src/qaoa.rs:125` |
| `fn` | `cut_value` | `crates/ruqu-algorithms/src/qaoa.rs:162` |
| `fn` | `evaluate_qaoa_cost` | `crates/ruqu-algorithms/src/qaoa.rs:179` |
| `fn` | `run_qaoa` | `crates/ruqu-algorithms/src/qaoa.rs:217` |
| `fn` | `triangle_graph` | `crates/ruqu-algorithms/src/qaoa.rs:318` |
| `fn` | `ring4_graph` | `crates/ruqu-algorithms/src/qaoa.rs:325` |

_... +15 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-attention-cli` — 39 public items (0 NAPI, 0 WASM)
*crates/ruvector-attention-cli*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `BenchmarkArgs` | `crates/ruvector-attention-cli/src/commands/benchmark.rs:13` |
| `fn` | `run` | `crates/ruvector-attention-cli/src/commands/benchmark.rs:43` |
| `struct` | `ComputeArgs` | `crates/ruvector-attention-cli/src/commands/compute.rs:12` |
| `enum` | `AttentionType` | `crates/ruvector-attention-cli/src/commands/compute.rs:51` |
| `fn` | `run` | `crates/ruvector-attention-cli/src/commands/compute.rs:60` |
| `struct` | `ConvertArgs` | `crates/ruvector-attention-cli/src/commands/convert.rs:6` |
| `enum` | `DataFormat` | `crates/ruvector-attention-cli/src/commands/convert.rs:29` |
| `fn` | `run` | `crates/ruvector-attention-cli/src/commands/convert.rs:42` |
| `mod` | `compute` | `crates/ruvector-attention-cli/src/commands/mod.rs:1` |
| `mod` | `benchmark` | `crates/ruvector-attention-cli/src/commands/mod.rs:2` |
| `mod` | `convert` | `crates/ruvector-attention-cli/src/commands/mod.rs:3` |
| `mod` | `serve` | `crates/ruvector-attention-cli/src/commands/mod.rs:4` |
| `mod` | `repl` | `crates/ruvector-attention-cli/src/commands/mod.rs:5` |
| `struct` | `InputData` | `crates/ruvector-attention-cli/src/commands/mod.rs:10` |
| `fn` | `keys_refs` | `crates/ruvector-attention-cli/src/commands/mod.rs:18` |
| `fn` | `values_refs` | `crates/ruvector-attention-cli/src/commands/mod.rs:22` |
| `fn` | `load_input` | `crates/ruvector-attention-cli/src/commands/mod.rs:27` |
| `fn` | `save_output` | `crates/ruvector-attention-cli/src/commands/mod.rs:48` |
| `struct` | `ReplArgs` | `crates/ruvector-attention-cli/src/commands/repl.rs:12` |
| `fn` | `run` | `crates/ruvector-attention-cli/src/commands/repl.rs:114` |
| `struct` | `ServeArgs` | `crates/ruvector-attention-cli/src/commands/serve.rs:20` |
| `fn` | `run` | `crates/ruvector-attention-cli/src/commands/serve.rs:71` |
| `struct` | `Config` | `crates/ruvector-attention-cli/src/config.rs:5` |
| `struct` | `AttentionSettings` | `crates/ruvector-attention-cli/src/config.rs:13` |
| `struct` | `ServerSettings` | `crates/ruvector-attention-cli/src/config.rs:22` |

_... +14 more — see `catalog/inventory-bootstrap.json`_


## `cli` — 36 public items (0 NAPI, 0 WASM)
*crates/ruvix/crates/cli*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `BuildArgs` | `crates/ruvix/crates/cli/src/commands/build.rs:10` |
| `fn` | `execute` | `crates/ruvix/crates/cli/src/commands/build.rs:71` |
| `enum` | `ConfigAction` | `crates/ruvix/crates/cli/src/commands/config.rs:12` |
| `enum` | `ValueType` | `crates/ruvix/crates/cli/src/commands/config.rs:148` |
| `enum` | `ListFormat` | `crates/ruvix/crates/cli/src/commands/config.rs:157` |
| `fn` | `execute` | `crates/ruvix/crates/cli/src/commands/config.rs:204` |
| `enum` | `DtbAction` | `crates/ruvix/crates/cli/src/commands/dtb.rs:15` |
| `enum` | `OutputFormat` | `crates/ruvix/crates/cli/src/commands/dtb.rs:175` |
| `fn` | `execute` | `crates/ruvix/crates/cli/src/commands/dtb.rs:183` |
| `struct` | `FlashArgs` | `crates/ruvix/crates/cli/src/commands/flash.rs:10` |
| `fn` | `execute` | `crates/ruvix/crates/cli/src/commands/flash.rs:63` |
| `enum` | `KeysAction` | `crates/ruvix/crates/cli/src/commands/keys.rs:22` |
| `enum` | `KeyAlgorithm` | `crates/ruvix/crates/cli/src/commands/keys.rs:196` |
| `enum` | `HashAlgorithm` | `crates/ruvix/crates/cli/src/commands/keys.rs:203` |
| `enum` | `ListFormat` | `crates/ruvix/crates/cli/src/commands/keys.rs:211` |
| `enum` | `ExportFormat` | `crates/ruvix/crates/cli/src/commands/keys.rs:218` |
| `fn` | `execute` | `crates/ruvix/crates/cli/src/commands/keys.rs:243` |
| `mod` | `build` | `crates/ruvix/crates/cli/src/commands/mod.rs:5` |
| `mod` | `config` | `crates/ruvix/crates/cli/src/commands/mod.rs:6` |
| `mod` | `dtb` | `crates/ruvix/crates/cli/src/commands/mod.rs:7` |
| `mod` | `flash` | `crates/ruvix/crates/cli/src/commands/mod.rs:8` |
| `mod` | `keys` | `crates/ruvix/crates/cli/src/commands/mod.rs:9` |
| `mod` | `monitor` | `crates/ruvix/crates/cli/src/commands/mod.rs:10` |
| `mod` | `security` | `crates/ruvix/crates/cli/src/commands/mod.rs:11` |
| `struct` | `MonitorArgs` | `crates/ruvix/crates/cli/src/commands/monitor.rs:23` |

_... +11 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-server` — 36 public items (0 NAPI, 0 WASM)
*crates/ruvector-server*

| Kind | Name | File:Line |
|---|---|---|
| `type` | `Result` | `crates/ruvector-server/src/error.rs:11` |
| `enum` | `Error` | `crates/ruvector-server/src/error.rs:15` |
| `mod` | `error` | `crates/ruvector-server/src/lib.rs:5` |
| `mod` | `routes` | `crates/ruvector-server/src/lib.rs:6` |
| `mod` | `state` | `crates/ruvector-server/src/lib.rs:7` |
| `use` | `error` | `crates/ruvector-server/src/lib.rs:18` |
| `use` | `state` | `crates/ruvector-server/src/lib.rs:19` |
| `struct` | `Config` | `crates/ruvector-server/src/lib.rs:23` |
| `struct` | `RuvectorServer` | `crates/ruvector-server/src/lib.rs:46` |
| `fn` | `new` | `crates/ruvector-server/src/lib.rs:53` |
| `fn` | `with_config` | `crates/ruvector-server/src/lib.rs:61` |
| `fn` | `start` | `crates/ruvector-server/src/lib.rs:100` |
| `struct` | `CreateCollectionRequest` | `crates/ruvector-server/src/routes/collections.rs:17` |
| `struct` | `CollectionInfo` | `crates/ruvector-server/src/routes/collections.rs:28` |
| `struct` | `CollectionsList` | `crates/ruvector-server/src/routes/collections.rs:39` |
| `fn` | `routes` | `crates/ruvector-server/src/routes/collections.rs:45` |
| `struct` | `HealthStatus` | `crates/ruvector-server/src/routes/health.rs:9` |
| `struct` | `ReadinessStatus` | `crates/ruvector-server/src/routes/health.rs:16` |
| `fn` | `health_check` | `crates/ruvector-server/src/routes/health.rs:28` |
| `fn` | `readiness` | `crates/ruvector-server/src/routes/health.rs:37` |
| `mod` | `collections` | `crates/ruvector-server/src/routes/mod.rs:3` |
| `mod` | `health` | `crates/ruvector-server/src/routes/mod.rs:4` |
| `mod` | `points` | `crates/ruvector-server/src/routes/mod.rs:5` |
| `struct` | `UpsertPointsRequest` | `crates/ruvector-server/src/routes/points.rs:17` |
| `struct` | `SearchRequest` | `crates/ruvector-server/src/routes/points.rs:24` |

_... +11 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-metrics` — 34 public items (0 NAPI, 0 WASM)
*crates/ruvector-metrics*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `HealthStatus` | `crates/ruvector-metrics/src/health.rs:7` |
| `struct` | `HealthResponse` | `crates/ruvector-metrics/src/health.rs:14` |
| `struct` | `ReadinessResponse` | `crates/ruvector-metrics/src/health.rs:21` |
| `struct` | `CollectionHealth` | `crates/ruvector-metrics/src/health.rs:29` |
| `struct` | `CollectionStats` | `crates/ruvector-metrics/src/health.rs:36` |
| `struct` | `HealthChecker` | `crates/ruvector-metrics/src/health.rs:42` |
| `fn` | `new` | `crates/ruvector-metrics/src/health.rs:49` |
| `fn` | `with_version` | `crates/ruvector-metrics/src/health.rs:57` |
| `fn` | `health` | `crates/ruvector-metrics/src/health.rs:65` |
| `fn` | `readiness` | `crates/ruvector-metrics/src/health.rs:74` |
| `mod` | `health` | `crates/ruvector-metrics/src/lib.rs:8` |
| `mod` | `recorder` | `crates/ruvector-metrics/src/lib.rs:9` |
| `use` | `health` | `crates/ruvector-metrics/src/lib.rs:11` |
| `use` | `recorder` | `crates/ruvector-metrics/src/lib.rs:14` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:17` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:20` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:25` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:33` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:38` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:45` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:51` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:57` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:62` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:67` |
| `static` | `ref` | `crates/ruvector-metrics/src/lib.rs:71` |

_... +9 more — see `catalog/inventory-bootstrap.json`_


## `agentic-robotics-rt` — 32 public items (0 NAPI, 0 WASM)
*crates/agentic-robotics-rt*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `Priority` | `crates/agentic-robotics-rt/src/executor.rs:17` |
| `struct` | `Deadline` | `crates/agentic-robotics-rt/src/executor.rs:21` |
| `struct` | `ROS3Executor` | `crates/agentic-robotics-rt/src/executor.rs:30` |
| `fn` | `new` | `crates/agentic-robotics-rt/src/executor.rs:38` |
| `fn` | `spawn_rt` | `crates/agentic-robotics-rt/src/executor.rs:65` |
| `fn` | `spawn_high` | `crates/agentic-robotics-rt/src/executor.rs:92` |
| `fn` | `spawn_low` | `crates/agentic-robotics-rt/src/executor.rs:100` |
| `fn` | `spawn_blocking` | `crates/agentic-robotics-rt/src/executor.rs:108` |
| `fn` | `high_priority_runtime` | `crates/agentic-robotics-rt/src/executor.rs:117` |
| `fn` | `low_priority_runtime` | `crates/agentic-robotics-rt/src/executor.rs:122` |
| `struct` | `LatencyTracker` | `crates/agentic-robotics-rt/src/latency.rs:9` |
| `fn` | `new` | `crates/agentic-robotics-rt/src/latency.rs:16` |
| `fn` | `record` | `crates/agentic-robotics-rt/src/latency.rs:28` |
| `fn` | `stats` | `crates/agentic-robotics-rt/src/latency.rs:36` |
| `fn` | `reset` | `crates/agentic-robotics-rt/src/latency.rs:53` |
| `fn` | `measure` | `crates/agentic-robotics-rt/src/latency.rs:58` |
| `struct` | `LatencyStats` | `crates/agentic-robotics-rt/src/latency.rs:77` |
| `struct` | `LatencyMeasurement` | `crates/agentic-robotics-rt/src/latency.rs:100` |
| `mod` | `executor` | `crates/agentic-robotics-rt/src/lib.rs:5` |
| `mod` | `scheduler` | `crates/agentic-robotics-rt/src/lib.rs:6` |
| `mod` | `latency` | `crates/agentic-robotics-rt/src/lib.rs:7` |
| `use` | `executor` | `crates/agentic-robotics-rt/src/lib.rs:9` |
| `use` | `scheduler` | `crates/agentic-robotics-rt/src/lib.rs:10` |
| `use` | `latency` | `crates/agentic-robotics-rt/src/lib.rs:11` |
| `enum` | `RTPriority` | `crates/agentic-robotics-rt/src/lib.rs:16` |

_... +7 more — see `catalog/inventory-bootstrap.json`_


## `ruvllm-cli` — 30 public items (0 NAPI, 0 WASM)
*crates/ruvllm-cli*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `BenchmarkResults` | `crates/ruvllm-cli/src/commands/benchmark.rs:18` |
| `struct` | `BenchmarkMetrics` | `crates/ruvllm-cli/src/commands/benchmark.rs:30` |
| `struct` | `SystemInfo` | `crates/ruvllm-cli/src/commands/benchmark.rs:43` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/benchmark.rs:51` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/chat.rs:42` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/download.rs:18` |
| `fn` | `is_model_downloaded` | `crates/ruvllm-cli/src/commands/download.rs:176` |
| `fn` | `get_model_path` | `crates/ruvllm-cli/src/commands/download.rs:196` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/info.rs:15` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/list.rs:15` |
| `mod` | `benchmark` | `crates/ruvllm-cli/src/commands/mod.rs:12` |
| `mod` | `chat` | `crates/ruvllm-cli/src/commands/mod.rs:13` |
| `mod` | `download` | `crates/ruvllm-cli/src/commands/mod.rs:14` |
| `mod` | `info` | `crates/ruvllm-cli/src/commands/mod.rs:15` |
| `mod` | `list` | `crates/ruvllm-cli/src/commands/mod.rs:16` |
| `mod` | `quantize` | `crates/ruvllm-cli/src/commands/mod.rs:17` |
| `mod` | `serve` | `crates/ruvllm-cli/src/commands/mod.rs:18` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/quantize.rs:20` |
| `fn` | `print_format_comparison` | `crates/ruvllm-cli/src/commands/quantize.rs:455` |
| `fn` | `run` | `crates/ruvllm-cli/src/commands/serve.rs:45` |
| `struct` | `ModelDefinition` | `crates/ruvllm-cli/src/models.rs:11` |
| `fn` | `get_recommended_models` | `crates/ruvllm-cli/src/models.rs:35` |
| `fn` | `get_model` | `crates/ruvllm-cli/src/models.rs:119` |
| `fn` | `resolve_model_id` | `crates/ruvllm-cli/src/models.rs:141` |
| `fn` | `get_aliases` | `crates/ruvllm-cli/src/models.rs:151` |

_... +5 more — see `catalog/inventory-bootstrap.json`_


## `rvf-adapters/rvlite` — 29 public items (0 NAPI, 0 WASM)
*crates/rvf/rvf-adapters/rvlite*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `Match` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:17` |
| `struct` | `CompactStats` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:26` |
| `struct` | `RvliteCollection` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:34` |
| `fn` | `create` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:41` |
| `fn` | `open` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:57` |
| `fn` | `add` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:69` |
| `fn` | `add_batch` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:76` |
| `fn` | `search` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:87` |
| `fn` | `remove` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:105` |
| `fn` | `remove_batch` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:111` |
| `fn` | `contains` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:117` |
| `fn` | `len` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:131` |
| `fn` | `is_empty` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:136` |
| `fn` | `compact` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:141` |
| `fn` | `close` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:150` |
| `fn` | `dimension` | `crates/rvf/rvf-adapters/rvlite/src/collection.rs:156` |
| `enum` | `RvliteMetric` | `crates/rvf/rvf-adapters/rvlite/src/config.rs:14` |
| `struct` | `RvliteConfig` | `crates/rvf/rvf-adapters/rvlite/src/config.rs:36` |
| `fn` | `new` | `crates/rvf/rvf-adapters/rvlite/src/config.rs:51` |
| `fn` | `with_metric` | `crates/rvf/rvf-adapters/rvlite/src/config.rs:61` |
| `fn` | `with_max_elements` | `crates/rvf/rvf-adapters/rvlite/src/config.rs:67` |
| `enum` | `RvliteError` | `crates/rvf/rvf-adapters/rvlite/src/error.rs:12` |
| `type` | `Result` | `crates/rvf/rvf-adapters/rvlite/src/error.rs:51` |
| `mod` | `collection` | `crates/rvf/rvf-adapters/rvlite/src/lib.rs:35` |
| `mod` | `config` | `crates/rvf/rvf-adapters/rvlite/src/lib.rs:36` |

_... +4 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-mincut-gated-transformer-wasm` — 28 public items (0 NAPI, 34 WASM)
*crates/ruvector-mincut-gated-transformer-wasm*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `init` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:45` |
| `struct` | `WasmTransformer` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:54` |
| `fn` | `new` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:70` |
| `fn` | `new_baseline` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:95` |
| `fn` | `with_config` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:128` |
| `fn` | `infer` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:150` |
| `fn` | `infer_with_spikes` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:170` |
| `fn` | `reset` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:198` |
| `fn` | `buffer_size` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:204` |
| `fn` | `set_policy` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:210` |
| `struct` | `WasmGatePacket` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:224` |
| `fn` | `new` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:248` |
| `fn` | `from_js` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:261` |
| `struct` | `WasmSpikePacket` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:291` |
| `fn` | `new` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:309` |
| `struct` | `WasmInferResult` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:343` |
| `fn` | `logits` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:362` |
| `fn` | `decision` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:368` |
| `fn` | `reason` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:374` |
| `fn` | `tier` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:380` |
| `fn` | `kv_writes_enabled` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:386` |
| `fn` | `external_writes_enabled` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:392` |
| `fn` | `effective_seq_len` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:398` |
| `fn` | `effective_window` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:404` |
| `fn` | `lambda` | `crates/ruvector-mincut-gated-transformer-wasm/src/lib.rs:410` |

_... +3 more — see `catalog/inventory-bootstrap.json`_


## `agentic-robotics-mcp` — 27 public items (0 NAPI, 0 WASM)
*crates/agentic-robotics-mcp*

| Kind | Name | File:Line |
|---|---|---|
| `mod` | `transport` | `crates/agentic-robotics-mcp/src/lib.rs:13` |
| `mod` | `server` | `crates/agentic-robotics-mcp/src/lib.rs:14` |
| `const` | `MCP_VERSION` | `crates/agentic-robotics-mcp/src/lib.rs:17` |
| `struct` | `McpTool` | `crates/agentic-robotics-mcp/src/lib.rs:21` |
| `struct` | `McpRequest` | `crates/agentic-robotics-mcp/src/lib.rs:29` |
| `struct` | `McpResponse` | `crates/agentic-robotics-mcp/src/lib.rs:38` |
| `struct` | `McpError` | `crates/agentic-robotics-mcp/src/lib.rs:49` |
| `struct` | `ToolResult` | `crates/agentic-robotics-mcp/src/lib.rs:58` |
| `enum` | `ContentItem` | `crates/agentic-robotics-mcp/src/lib.rs:67` |
| `type` | `ToolHandler` | `crates/agentic-robotics-mcp/src/lib.rs:77` |
| `struct` | `McpServer` | `crates/agentic-robotics-mcp/src/lib.rs:80` |
| `struct` | `ServerInfo` | `crates/agentic-robotics-mcp/src/lib.rs:87` |
| `fn` | `new` | `crates/agentic-robotics-mcp/src/lib.rs:96` |
| `fn` | `register_tool` | `crates/agentic-robotics-mcp/src/lib.rs:108` |
| `fn` | `handle_request` | `crates/agentic-robotics-mcp/src/lib.rs:119` |
| `struct` | `ServerBuilder` | `crates/agentic-robotics-mcp/src/server.rs:7` |
| `fn` | `new` | `crates/agentic-robotics-mcp/src/server.rs:13` |
| `fn` | `version` | `crates/agentic-robotics-mcp/src/server.rs:20` |
| `fn` | `build` | `crates/agentic-robotics-mcp/src/server.rs:25` |
| `fn` | `tool` | `crates/agentic-robotics-mcp/src/server.rs:31` |
| `fn` | `text_response` | `crates/agentic-robotics-mcp/src/server.rs:39` |
| `fn` | `error_response` | `crates/agentic-robotics-mcp/src/server.rs:49` |
| `struct` | `StdioTransport` | `crates/agentic-robotics-mcp/src/transport.rs:8` |
| `fn` | `new` | `crates/agentic-robotics-mcp/src/transport.rs:13` |
| `fn` | `run` | `crates/agentic-robotics-mcp/src/transport.rs:18` |

_... +2 more — see `catalog/inventory-bootstrap.json`_


## `ruvector-tiny-dancer-wasm` — 21 public items (0 NAPI, 24 WASM)
*crates/ruvector-tiny-dancer-wasm*

| Kind | Name | File:Line |
|---|---|---|
| `fn` | `init` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:15` |
| `struct` | `RouterConfig` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:23` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:35` |
| `fn` | `set_model_path` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:47` |
| `fn` | `set_confidence_threshold` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:52` |
| `fn` | `set_max_uncertainty` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:57` |
| `struct` | `Candidate` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:78` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:90` |
| `struct` | `RoutingRequest` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:130` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:139` |
| `fn` | `set_metadata` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:148` |
| `struct` | `RoutingResponse` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:182` |
| `fn` | `decisions_json` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:192` |
| `fn` | `inference_time_us` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:197` |
| `fn` | `candidates_processed` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:202` |
| `fn` | `feature_time_us` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:207` |
| `struct` | `Router` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:227` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:235` |
| `fn` | `route` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:244` |
| `fn` | `circuit_breaker_status` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:255` |
| `fn` | `version` | `crates/ruvector-tiny-dancer-wasm/src/lib.rs:262` |

## `agentic-robotics-node` — 17 public items (20 NAPI, 0 WASM)
*crates/agentic-robotics-node*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `AgenticNode` | `crates/agentic-robotics-node/src/lib.rs:17` |
| `fn` | `new` | `crates/agentic-robotics-node/src/lib.rs:27` |
| `fn` | `get_name` | `crates/agentic-robotics-node/src/lib.rs:37` |
| `fn` | `create_publisher` | `crates/agentic-robotics-node/src/lib.rs:43` |
| `fn` | `create_subscriber` | `crates/agentic-robotics-node/src/lib.rs:61` |
| `fn` | `get_version` | `crates/agentic-robotics-node/src/lib.rs:75` |
| `fn` | `list_publishers` | `crates/agentic-robotics-node/src/lib.rs:81` |
| `fn` | `list_subscribers` | `crates/agentic-robotics-node/src/lib.rs:88` |
| `struct` | `AgenticPublisher` | `crates/agentic-robotics-node/src/lib.rs:96` |
| `fn` | `publish` | `crates/agentic-robotics-node/src/lib.rs:105` |
| `fn` | `get_topic` | `crates/agentic-robotics-node/src/lib.rs:119` |
| `fn` | `get_stats` | `crates/agentic-robotics-node/src/lib.rs:125` |
| `struct` | `PublisherStats` | `crates/agentic-robotics-node/src/lib.rs:136` |
| `struct` | `AgenticSubscriber` | `crates/agentic-robotics-node/src/lib.rs:143` |
| `fn` | `get_topic` | `crates/agentic-robotics-node/src/lib.rs:152` |
| `fn` | `try_recv` | `crates/agentic-robotics-node/src/lib.rs:158` |
| `fn` | `recv` | `crates/agentic-robotics-node/src/lib.rs:172` |

## `ruvector-router-ffi` — 12 public items (13 NAPI, 0 WASM)
*crates/ruvector-router-ffi*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `DistanceMetric` | `crates/ruvector-router-ffi/src/lib.rs:18` |
| `struct` | `DbOptions` | `crates/ruvector-router-ffi/src/lib.rs:37` |
| `struct` | `VectorDB` | `crates/ruvector-router-ffi/src/lib.rs:48` |
| `fn` | `new` | `crates/ruvector-router-ffi/src/lib.rs:55` |
| `fn` | `insert` | `crates/ruvector-router-ffi/src/lib.rs:96` |
| `fn` | `insert_async` | `crates/ruvector-router-ffi/src/lib.rs:112` |
| `fn` | `search` | `crates/ruvector-router-ffi/src/lib.rs:132` |
| `fn` | `search_async` | `crates/ruvector-router-ffi/src/lib.rs:158` |
| `fn` | `delete` | `crates/ruvector-router-ffi/src/lib.rs:192` |
| `fn` | `count` | `crates/ruvector-router-ffi/src/lib.rs:199` |
| `fn` | `get_all_ids` | `crates/ruvector-router-ffi/src/lib.rs:207` |
| `struct` | `SearchResultJS` | `crates/ruvector-router-ffi/src/lib.rs:215` |

## `ruvector-tiny-dancer-node` — 12 public items (13 NAPI, 0 WASM)
*crates/ruvector-tiny-dancer-node*

| Kind | Name | File:Line |
|---|---|---|
| `struct` | `RouterConfig` | `crates/ruvector-tiny-dancer-node/src/lib.rs:26` |
| `struct` | `Candidate` | `crates/ruvector-tiny-dancer-node/src/lib.rs:60` |
| `struct` | `RoutingRequest` | `crates/ruvector-tiny-dancer-node/src/lib.rs:100` |
| `struct` | `RoutingDecision` | `crates/ruvector-tiny-dancer-node/src/lib.rs:134` |
| `struct` | `RoutingResponse` | `crates/ruvector-tiny-dancer-node/src/lib.rs:159` |
| `struct` | `Router` | `crates/ruvector-tiny-dancer-node/src/lib.rs:183` |
| `fn` | `new` | `crates/ruvector-tiny-dancer-node/src/lib.rs:201` |
| `fn` | `route` | `crates/ruvector-tiny-dancer-node/src/lib.rs:228` |
| `fn` | `reload_model` | `crates/ruvector-tiny-dancer-node/src/lib.rs:249` |
| `fn` | `circuit_breaker_status` | `crates/ruvector-tiny-dancer-node/src/lib.rs:270` |
| `fn` | `version` | `crates/ruvector-tiny-dancer-node/src/lib.rs:278` |
| `fn` | `hello` | `crates/ruvector-tiny-dancer-node/src/lib.rs:284` |

## `agentic-robotics-embedded` — 2 public items (0 NAPI, 0 WASM)
*crates/agentic-robotics-embedded*

| Kind | Name | File:Line |
|---|---|---|
| `enum` | `EmbeddedPriority` | `crates/agentic-robotics-embedded/src/lib.rs:8` |
| `struct` | `EmbeddedConfig` | `crates/agentic-robotics-embedded/src/lib.rs:17` |

## `ruvector-mincut-brain-node` — 1 public items (0 NAPI, 0 WASM)
*crates/ruvector-mincut-brain-node*

| Kind | Name | File:Line |
|---|---|---|
| `use` | `ruvector_mincut` | `crates/ruvector-mincut-brain-node/src/lib.rs:12` |

## `agentic-robotics-benchmarks` — 0 public items (0 NAPI, 0 WASM)
*crates/agentic-robotics-benchmarks*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `claude-flow` — 0 public items (0 NAPI, 0 WASM)
*crates/rvf/rvf-adapters/claude-flow*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `cognitive_demo` — 0 public items (0 NAPI, 0 WASM)
*crates/ruvix/examples/cognitive_demo*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `ruvector-router-cli` — 0 public items (0 NAPI, 0 WASM)
*crates/ruvector-router-cli*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `ruvix/benches` — 0 public items (0 NAPI, 0 WASM)
*crates/ruvix/benches*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `ruvix/tests` — 0 public items (0 NAPI, 0 WASM)
*crates/ruvix/tests*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `rvf-integration` — 0 public items (0 NAPI, 0 WASM)
*crates/rvf/tests/rvf-integration*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `rvf/benches` — 0 public items (0 NAPI, 0 WASM)
*crates/rvf/benches*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `rvm/benches` — 0 public items (0 NAPI, 0 WASM)
*crates/rvm/benches*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `rvm/tests` — 0 public items (0 NAPI, 0 WASM)
*crates/rvm/tests*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

## `swarm-consensus` — 0 public items (0 NAPI, 0 WASM)
*crates/ruvix/examples/rvf-demos/swarm-consensus*

_(no `pub` items found by ripgrep — may be empty, generated, or all visibility-restricted)_

