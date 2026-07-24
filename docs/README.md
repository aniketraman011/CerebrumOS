# CerebrumOS Documentation Index

Research-oriented design docs for reviewers who should not need to read the full source tree.

| Document | Contents |
|----------|----------|
| [HLD.md](./HLD.md) | High-level architecture and data flow |
| [LLD.md](./LLD.md) | Module boundaries, decision engine, APIs |
| [SCHEDULER_DESIGN.md](./SCHEDULER_DESIGN.md) | Policies, complexity, Linux/production analogies |
| [MEMORY_DESIGN.md](./MEMORY_DESIGN.md) | Paging, fragmentation, heat map, reuse |
| [BENCHMARK_METHODOLOGY.md](./BENCHMARK_METHODOLOGY.md) | How scheduler comparisons are run |
| [EXPERIMENTAL_RESULTS.md](./EXPERIMENTAL_RESULTS.md) | Template for recording experiment tables |

## Demo path (UI)
1. Open **Runtime Playground** (`/`) — centerpiece
2. Pin a scheduler or leave **Adaptive**
3. Generate a burst → read the **Runtime Decision** panel
4. Open **Timeline Replay** → ▶ Replay request + Interview Mode
5. Open **Decision Engine** / **Memory** / **Benchmarks** from the sidebar
