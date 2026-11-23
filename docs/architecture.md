# Arquitetura

Arquitetura limpa em camadas concêntricas. Dependências apontam só para dentro;
o núcleo não conhece Tauri, Vue, sistema de arquivos ou sistema operacional.

```
apps/desktop/src (Vue)  ──IPC──▶  apps/desktop/src-tauri (comandos, DTOs)
                                          │
                     crates/infrastructure (adaptadores: jwalk, sysinfo, TOML, JSON, Win32)
                                          │ implementa
                     crates/application (casos de uso + portas/traits)
                                          │ usa
                     crates/domain (regras puras, sem I/O)
```

## Camadas (Rust)

| Crate | Responsabilidade | Depende de |
|---|---|---|
| `domain` | `ByteSize`, `VolumeUsage`, `Tier`, `ExclusionList`, `ToolchainGuard`, `SizeAggregator`, `Candidate`, `Plan`, `approve` | nada (só `thiserror`) |
| `application` | Portas (`FileWalker`, `VolumeInfo`, `Environment`, `PathInspector`, `CatalogRepository`, `PlanCodec`, `ScanProgress`) e casos de uso (`SurveyService`, `ClassifyService`, `export_plan`) | `domain` |
| `infrastructure` | `JwalkFileWalker`, `allocated_size` (Win32/POSIX), `SysinfoVolumeInfo`, `SnapshotEnvironment`, `TomlCatalogRepository`, `SkillPlanJsonCodec`, `platform_exclusions` | `application`, `domain` |
| `src-tauri` | `service` (lógica dos comandos, testada) + `dto` (mapeamento camelCase) + `bootstrap` (raiz de composição) | todos |

## Frontend (Vue 3 + TypeScript)

| Pasta | Responsabilidade |
|---|---|
| `domain/` | Tipos dos DTOs, formatação pt-BR, regras de seleção (puras) |
| `application/` | Porta `DiskCleanupGateway`, stores Pinia, `ThemeController` |
| `infrastructure/` | `TauriGateway` (IPC), `DemoGateway` (navegador sem Tauri), tema no `localStorage` |
| `presentation/` | Componentes, telas e rotas |
| `main.ts` | Raiz de composição |

O gateway entra nos stores por um plugin do Pinia (`this.gateway`); nos testes
ele é substituído por um fake.

## SOLID na prática

- **S**: cada caso de uso tem um serviço; mapeamento de DTO separado da lógica de comando.
- **O**: novo alvo de limpeza = nova regra em `catalog/*.toml`, sem recompilar.
- **L**: qualquer `FileWalker`/`VolumeInfo` (real ou fake) satisfaz os casos de uso.
- **I**: portas pequenas e específicas (`PathInspector` não sabe varrer volume).
- **D**: casos de uso recebem `&dyn Porta`; só as raízes de composição conhecem implementações.

## Invariantes de segurança (domínio)

1. `Plan::from_selection` rejeita candidato bloqueado, caminho excluído (inclusive `alsoRemove`), duplicado ou seleção vazia.
2. A linha de base de exclusões do Windows não pode ser removida pelo catálogo, só ampliada.
3. `approve` é o único caminho para `ApprovedPlan`: exige decisões respondidas, tier aprovado e ciência explícita.
4. `ToolchainGuard` bloqueia alvo apontado por variável monitorada ou que contém entrada do `PATH`.

## Fora desta fase

Execução (remoção, comandos, desinstaladores, helper elevado), relatório,
tier B (registro de desinstalação), DISM, catálogos macOS/Linux.
