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
| `domain` | `ByteSize`, `VolumeUsage`, `Tier`, `ExclusionList`, `ToolchainGuard`, `SafetyGuard`, `SizeAggregator`, `Candidate`, `Plan`, `approve`, `ItemResult`, `TierRun`, `CleanupReport` | nada (só `thiserror`) |
| `application` | Portas (`FileWalker`, `VolumeInfo`, `Environment`, `PathInspector`, `CatalogRepository`, `PlanCodec`, `ScanProgress`, `ActionRunner`, `ExecutionProgress`, `ProjectFinder`) e casos de uso (`SurveyService`, `ClassifyService`, `export_plan`, `ExecuteService`) | `domain` |
| `infrastructure` | `JwalkFileWalker`, `allocated_size` (Win32/POSIX), `SysinfoVolumeInfo`, `SnapshotEnvironment`, `TomlCatalogRepository`, `SkillPlanJsonCodec`, `platform_exclusions`, `FsProjectFinder` (projetos por marcador, sem seguir link nem descer em artefato ou pasta oculta; idade pela atividade fora dos artefatos e pelo `.git/index`), `FsActionRunner` (remoção best-effort sem seguir link/junção, envio para a Lixeira via `Recycler`/`SystemRecycler` com o crate `trash`, comandos pelo shell da plataforma) | `application`, `domain` |
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

### Histórico de varreduras

- Regras puras em `domain/history.ts`: retrato compacto (`toSnapshot`: volume, contadores e o 1º
  nível **completo** de `roots` e `profile`; `children` fica de fora), limite de 100 (`appendSnapshot`),
  comparação (`compareEntries`/`compareSnapshots`) e validação do que vem do disco (`sanitizeHistory`).
- Porta `HistoryStorage` (`application/history.ts`), injetada por plugin do Pinia como as preferências;
  adaptador `infrastructure/browserHistory.ts` (`localStorage`, chave `dc-history`). `save` devolve
  `false` em cota cheia/storage bloqueado e a tela avisa.
- Gravação automática: `survey.run` concluído chama `history.record` (falha de varredura não grava).
- Decisão: persistência no WebView, não no núcleo Rust — mesmo mecanismo das preferências, funciona no
  modo demo e não exige comando novo. Se o volume de dados crescer além da cota, a troca é só do
  adaptador (ex.: comando Tauri gravando JSON no diretório de dados do app).

## SOLID na prática

- **S**: cada caso de uso tem um serviço; mapeamento de DTO separado da lógica de comando.
- **O**: novo alvo de limpeza = nova regra em `catalog/*.toml`, sem recompilar.
- **L**: qualquer `FileWalker`/`VolumeInfo` (real ou fake) satisfaz os casos de uso.
- **I**: portas pequenas e específicas (`PathInspector` não sabe varrer volume).
- **D**: casos de uso recebem `&dyn Porta`; só as raízes de composição conhecem implementações.

## Invariantes de segurança (domínio)

1. `Plan::from_selection` rejeita candidato bloqueado, caminho excluído (inclusive `alsoRemove`), duplicado ou seleção vazia.
2. A linha de base de exclusões do Windows não pode ser removida pelo catálogo, só ampliada.
3. `approve` é o único caminho para `ApprovedPlan`: exige decisões respondidas, tier aprovado e ciência explícita,
   e fixa o destino de cada tier (`Disposal`: Lixeira ou definitivo; padrão A definitivo, demais Lixeira).
   Trocar o destino exige aprovar de novo. O destino não entra no `plan.json`.
4. `ToolchainGuard` bloqueia alvo apontado por variável monitorada ou que contém entrada do `PATH`.
5. `ExecuteService` só aceita `ApprovedPlan`; cada item é medido (espaço livre antes/depois) e falha de
   item vira status (`parcial`/`erro`/`pulado`), nunca aborta o tier. O que vai para a Lixeira é contado em
   `trashed`, separado do espaço liberado: só libera ao esvaziar a Lixeira. Comando nunca vai para a Lixeira.
6. `SafetyGuard` recusa, imediatamente antes de remover, alvo com menos de 3 segmentos ou igual a uma
   pasta protegida (perfil, AppData, ProgramData, Program Files, SystemRoot, TEMP).
7. `FsActionRunner` nunca segue link simbólico nem junção/reparse point (teste com `mklink /J`), nem na
   remoção nem na Lixeira. Pasta recusada pela Lixeira (arquivo em uso) desce só no ramo que travou, em lote
   por nível, e para após 5 erros. Os testes usam uma Lixeira falsa; a real só roda com `-- --ignored`.
8. A sessão desktop executa cada tier uma única vez por aprovação; remontar o plano descarta aprovação
   e execuções.

## Idioma, erros e plataformas

- O núcleo **não formata frase**: textos de dado (catálogo, exclusões) são `LocalizedText {pt, en}`;
  motivos são enums (`BlockReason`, `SkipCause`, `FailCause`, `SafetyViolation`); erros saem pelo
  Tauri como `ErrorDto {code, params}`. A interface traduz (`src/i18n`), com `en` tipado por `pt`.
- Idioma **Automático** = primeiro idioma do sistema (`navigator.languages`, que segue o SO).
- Catálogo e exclusões obrigatórias são escolhidos em tempo de execução por `std::env::consts::OS`
  (`catalog_for`, `exclusions_for`): os três sistemas são testados em qualquer máquina.

## Vue — produção, performance, segurança e movimento

- Flags do build declaradas (`__VUE_PROD_DEVTOOLS__` etc.) e `app.config.errorHandler`.
- Telas fora da inicial carregam sob demanda; relatórios do núcleo são `markRaw` (imutáveis, só a
  raiz é trocada); props de lista estáveis via `computed`.
- Sem `v-html`; caminhos do usuário só como texto; CSP sem domínios externos.
- `<Transition>` na troca de tela, `<TransitionGroup>` com `*-move` nas listas, barras e cartões
  animados em CSS; tudo desligado com `prefers-reduced-motion`.

## Atualização automática

- Porta própria na interface (`UpdaterPort`, injetada por plugin do Pinia), separada do gateway de
  limpeza; `TauriUpdater` fala com os comandos `check_update`/`download_update`/`install_update`.
- A regra do canal (estável × beta, maior SemVer) mora em `src-tauri/src/update.rs`, sem rede; a
  chamada HTTP à API do GitHub fica na raiz de composição.
- Instalar nunca é automático: o download sim, a troca de versão só com o clique do usuário.

## Próximo passo

Tier B (desinstaladores via registro: MSI/NSIS/Inno/VS), DISM, helper elevado (UAC/polkit), Temp com
filtro de idade, validação dos catálogos macOS/Linux em máquina real e rollback da atualização.
