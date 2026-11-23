# Disk Cleanup

Aplicativo desktop multiplataforma (Tauri 2 + Rust + Vue 3/TypeScript) que
transforma "o disco está cheio" em um plano verificável. Porta da skill
`disk-cleanup` com o mesmo princípio: **nada é apagado sem medição e sem
aprovação explícita**.

## Estado — fase 1 (somente leitura)

| Etapa | Estado |
|---|---|
| 1. Survey (volume, raízes, perfil, nuvem lógico × real) | implementado |
| 2. Classificação (catálogo TOML, exclusões, bloqueio por PATH/variável) | implementado |
| 3. Plano (`plan.json` no formato da skill) | implementado (sem execução) |
| 4. Execução | próxima fase |
| 5. Relatório | próxima fase |

O `plan.json` gerado já é aceito pelo `cleanup.ps1` da skill.

## Requisitos

- Rust stable (MSVC no Windows) + `cargo-llvm-cov` (`cargo install cargo-llvm-cov`)
- Node 20+ e pnpm
- Windows: WebView2 e Visual Studio Build Tools (C++)

## Comandos

```bash
# Núcleo Rust
cargo test --workspace
cargo cov --summary-only                 # falha abaixo de 95% de linhas
cargo clippy --workspace --all-targets -- -D warnings

# Frontend (apps/desktop)
pnpm install
pnpm test                                # vitest
pnpm coverage                            # falha abaixo de 95% (linhas, ramos, funções, statements)
pnpm typecheck
pnpm dev                                 # interface no navegador com dados de demonstração

# App desktop
pnpm tauri dev                           # sobe o Vite (porta 1420) e o app
pnpm tauri build --no-bundle             # executável release com a interface embutida
pnpm tauri build                         # executável + instalador

# Varredura real pelo terminal (somente leitura)
cargo run --release -p disk-cleanup-infrastructure --example smoke -- C:\
```

> `cargo run`/`cargo build` direto no crate desktop gera um binário de debug que
> carrega a interface de `devUrl` (`http://localhost:1420`). Sem o Vite rodando,
> a janela mostra `ERR_CONNECTION_REFUSED`. Use `pnpm tauri dev` ou
> `pnpm tauri build`, que embutem/servem o frontend.

## Fluxo de trabalho

TDD: teste primeiro (vermelho), implementação mínima (verde), refatoração.
Arquitetura e decisões em [`docs/architecture.md`](docs/architecture.md).

Fora da medição de cobertura, por serem raízes de composição sem lógica:
`apps/desktop/src-tauri/src/{bootstrap,main}.rs` e `apps/desktop/src/main.ts`.
