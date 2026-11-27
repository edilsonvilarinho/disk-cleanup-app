//! Linha de comando do Disk Cleanup. Mesma camada `application` do desktop:
//! nenhuma regra nova. A aprovação continua explícita: sem `--approve` e
//! `--yes`, nada é removido (`ExecuteService` só aceita `ApprovedPlan`).
//!
//! ```text
//! disk-cleanup-cli survey [--root C:\] [--depth 1|2]
//! disk-cleanup-cli classify [--project-root D:\dev]... [--out plan.json]
//! disk-cleanup-cli execute --plan plan.json --approve A,C [--disposal A=trash] --yes [--dry-run]
//! ```

use std::collections::{BTreeMap, BTreeSet};
use std::fmt;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

use disk_cleanup_application::{
    protected_paths_guard, ActionRunner, CatalogRepository, ClassificationReport, ClassifyService,
    Environment, ExecuteService, ExecutionProgress, FileWalker, PathInspector, PlanCodec,
    ProjectFinder, ScanProgress, SurveyRequest, SurveyService, VolumeInfo,
};
use disk_cleanup_domain::{
    approve, ByteSize, Disposal, ExclusionList, ItemResult, ItemStatus, Plan, Tier,
};

/// Projeto só entra no plan.json com ao menos estes dias sem atividade.
const MIN_IDLE_DAYS: u32 = 90;

/// Leitura e gravação do plan.json (porta para os testes não tocarem o disco).
pub trait TextFiles {
    fn read(&self, path: &str) -> Result<String, String>;
    fn write(&self, path: &str, text: &str) -> Result<(), String>;
}

/// Portas que a CLI usa; `main.rs` liga os adaptadores reais.
pub struct Ports<'a> {
    pub env: &'a dyn Environment,
    pub walker: &'a dyn FileWalker,
    pub volumes: &'a dyn VolumeInfo,
    pub inspector: &'a dyn PathInspector,
    pub catalog: &'a dyn CatalogRepository,
    pub baseline: ExclusionList,
    pub finder: &'a dyn ProjectFinder,
    pub runner: &'a dyn ActionRunner,
    pub codec: &'a dyn PlanCodec,
    pub files: &'a dyn TextFiles,
    /// `true` no Windows: raiz `C:\` e perfil em `USERPROFILE`.
    pub windows: bool,
}

impl fmt::Debug for Ports<'_> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Ports")
    }
}

/// Erro de uso (código 2) ou de execução (código 1).
#[derive(Debug, PartialEq, Eq)]
enum Failure {
    Usage(String),
    Run(String),
}

impl<E: fmt::Display> From<E> for Failure {
    fn from(e: E) -> Self {
        Failure::Run(e.to_string())
    }
}

const USAGE: &str = "uso:
  disk-cleanup-cli survey [--root <raiz>] [--depth 1|2]
  disk-cleanup-cli classify [--project-root <pasta>]... [--out plan.json]
  disk-cleanup-cli execute --plan plan.json --approve <tiers> [--disposal A=trash,C=permanent] --yes [--dry-run]";

/// Roda um comando e devolve o código de saída (0 ok, 1 erro, 2 uso).
pub fn run(args: &[String], ports: &Ports<'_>, out: &mut dyn Write) -> i32 {
    let result = match args.first().map(String::as_str) {
        Some("survey") => survey(&args[1..], ports, out),
        Some("classify") => classify(&args[1..], ports, out),
        Some("execute") => execute(&args[1..], ports, out),
        _ => Err(Failure::Usage(USAGE.into())),
    };
    match result {
        Ok(()) => 0,
        Err(Failure::Usage(m)) => {
            let _ = writeln!(out, "{m}");
            2
        }
        Err(Failure::Run(m)) => {
            let _ = writeln!(out, "erro: {m}");
            1
        }
    }
}

/// Opções `--nome valor` (repetíveis) e flags `--nome`.
struct Options {
    values: Vec<(String, String)>,
    flags: BTreeSet<String>,
}

impl Options {
    fn parse(args: &[String], flags: &[&str], values: &[&str]) -> Result<Self, Failure> {
        let mut parsed = Options {
            values: Vec::new(),
            flags: BTreeSet::new(),
        };
        let mut it = args.iter();
        while let Some(arg) = it.next() {
            let name = arg.trim_start_matches("--");
            if flags.contains(&name) {
                parsed.flags.insert(name.to_string());
            } else if values.contains(&name) {
                let value = it
                    .next()
                    .ok_or_else(|| Failure::Usage(format!("{arg} exige um valor\n{USAGE}")))?;
                parsed.values.push((name.to_string(), value.clone()));
            } else {
                return Err(Failure::Usage(format!(
                    "opção desconhecida: {arg}\n{USAGE}"
                )));
            }
        }
        Ok(parsed)
    }

    fn one(&self, name: &str) -> Option<&str> {
        self.values
            .iter()
            .rev()
            .find(|(n, _)| n == name)
            .map(|(_, v)| v.as_str())
    }

    fn all(&self, name: &str) -> Vec<String> {
        self.values
            .iter()
            .filter(|(n, _)| n == name)
            .map(|(_, v)| v.clone())
            .collect()
    }

    fn flag(&self, name: &str) -> bool {
        self.flags.contains(name)
    }
}

fn gb(size: ByteSize) -> String {
    format!("{:.1} GB", size.bytes() as f64 / (1u64 << 30) as f64).replace('.', ",")
}

fn signed_gb(bytes: i64) -> String {
    let sign = if bytes < 0 { '-' } else { '+' };
    format!("{sign}{}", gb(ByteSize::from_bytes(bytes.unsigned_abs())))
}

struct Quiet;
impl ScanProgress for Quiet {
    fn scanned(&self, _: u64, _: ByteSize) {}
}

fn default_root(ports: &Ports<'_>) -> String {
    if ports.windows {
        let drive = ports.env.var("SystemDrive").unwrap_or_else(|| "C:".into());
        format!(r"{drive}\")
    } else {
        "/".into()
    }
}

fn survey(args: &[String], ports: &Ports<'_>, out: &mut dyn Write) -> Result<(), Failure> {
    let opts = Options::parse(args, &[], &["root", "depth"])?;
    let depth = match opts.one("depth").unwrap_or("2") {
        "1" => 1,
        "2" => 2,
        other => {
            return Err(Failure::Usage(format!(
                "--depth deve ser 1 ou 2, veio {other}"
            )))
        }
    };
    let profile = ports
        .env
        .var(if ports.windows { "USERPROFILE" } else { "HOME" });
    let request = SurveyRequest {
        volume_root: opts
            .one("root")
            .map_or_else(|| default_root(ports), str::to_string),
        profile,
        depth,
    };
    let report = SurveyService::new(ports.walker, ports.volumes, &Quiet).run(&request)?;
    writeln!(
        out,
        "{}: {} usados · {} livres · {} arquivos",
        request.volume_root,
        gb(report.volume.used()),
        gb(report.volume.free()),
        report.files
    )?;
    for entry in report.roots.iter().take(5) {
        writeln!(out, "  {:<28} {}", entry.name(), gb(entry.allocated))?;
    }
    writeln!(
        out,
        "  {} arquivos grandes no perfil · somente leitura, nada foi alterado",
        report.largest.len()
    )?;
    Ok(())
}

fn classify(args: &[String], ports: &Ports<'_>, out: &mut dyn Write) -> Result<(), Failure> {
    let opts = Options::parse(args, &[], &["project-root", "out"])?;
    let roots = opts.all("project-root");
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs());
    let report = ClassifyService::new(ports.catalog, ports.env, ports.inspector)
        .with_projects(ports.finder, &roots)
        .with_large_files(&[], now)
        .run(ports.baseline.clone(), &[])?;
    for tier in Tier::ALL {
        let items: Vec<_> = report
            .candidates
            .iter()
            .filter(|c| c.tier == tier)
            .collect();
        if items.is_empty() {
            continue;
        }
        let total: ByteSize = items.iter().map(|c| c.size).sum();
        writeln!(
            out,
            "{tier} {:<14} {} itens  {}",
            tier.description(),
            items.len(),
            gb(total)
        )?;
        for c in items {
            let state = if c.availability.is_selectable() {
                ""
            } else {
                "  (bloqueado)"
            };
            writeln!(out, "    {:<40} {:>9}{state}", c.id, gb(c.size))?;
        }
    }
    let Some(path) = opts.one("out") else {
        writeln!(
            out,
            "somente leitura · use --out plan.json para gravar o plano"
        )?;
        return Ok(());
    };
    let selected = default_selection(&report);
    let ids: Vec<&str> = selected.iter().map(String::as_str).collect();
    let volume = default_root(ports);
    let plan = Plan::from_selection(
        volume.trim_end_matches('\\'),
        &report.candidates,
        &ids,
        &report.exclusions,
    )?;
    ports.files.write(path, &ports.codec.encode(&plan)?)?;
    writeln!(
        out,
        "{path} gravado: {} itens · {} · nada foi alterado",
        plan.item_count(),
        gb(plan.estimated_total())
    )?;
    Ok(())
}

/// Mesma seleção padrão da interface: selecionável, sem arquivo grande, e
/// projeto só com idade conhecida ≥ `MIN_IDLE_DAYS`.
fn default_selection(report: &ClassificationReport) -> Vec<String> {
    report
        .candidates
        .iter()
        .filter(|c| c.availability.is_selectable())
        .filter(|c| !report.large_files.iter().any(|f| f.id == c.id))
        .filter(|c| match report.projects.iter().find(|p| p.id == c.id) {
            Some(p) => p.idle_days.is_some_and(|d| d >= MIN_IDLE_DAYS),
            None => true,
        })
        .map(|c| c.id.clone())
        .collect()
}

fn parse_tiers(value: &str) -> Result<BTreeSet<Tier>, Failure> {
    value
        .split(',')
        .filter(|t| !t.trim().is_empty())
        .map(|t| t.parse::<Tier>().map_err(|e| Failure::Usage(e.to_string())))
        .collect()
}

fn parse_disposals(value: Option<&str>) -> Result<BTreeMap<Tier, Disposal>, Failure> {
    let Some(value) = value else {
        return Ok(BTreeMap::new());
    };
    value
        .split(',')
        .map(|pair| {
            let (tier, disposal) = pair.split_once('=').ok_or_else(|| {
                Failure::Usage(format!(
                    "--disposal espera TIER=trash|permanent, veio {pair}"
                ))
            })?;
            let tier = tier
                .parse::<Tier>()
                .map_err(|e| Failure::Usage(e.to_string()))?;
            let disposal = disposal
                .parse::<Disposal>()
                .map_err(|e| Failure::Usage(e.to_string()))?;
            Ok((tier, disposal))
        })
        .collect()
}

struct Printer<'w> {
    out: std::cell::RefCell<&'w mut dyn Write>,
}

impl ExecutionProgress for Printer<'_> {
    fn item_started(&self, _: &str) {}
    fn item_finished(&self, r: &ItemResult) {
        let what = match &r.status {
            ItemStatus::Done if r.trashed > ByteSize::ZERO => format!("Lixeira {}", gb(r.trashed)),
            ItemStatus::Done => signed_gb(r.freed()),
            other => format!("{} {}", other.code(), signed_gb(r.freed())),
        };
        let _ = writeln!(self.out.borrow_mut(), "    {:<40} {what}", r.id);
    }
}

fn execute(args: &[String], ports: &Ports<'_>, out: &mut dyn Write) -> Result<(), Failure> {
    let opts = Options::parse(args, &["yes", "dry-run"], &["plan", "approve", "disposal"])?;
    let path = opts
        .one("plan")
        .ok_or_else(|| Failure::Usage(format!("--plan é obrigatório\n{USAGE}")))?;
    let Some(approve_arg) = opts.one("approve") else {
        return Err(Failure::Usage(
            "plano não aprovado: use --approve <tiers> e --yes".into(),
        ));
    };
    let plan = ports.codec.decode(&ports.files.read(path)?)?;
    let tiers = parse_tiers(approve_arg)?;
    let disposals = parse_disposals(opts.one("disposal"))?;
    let approved =
        approve(&plan, &[], &tiers, &disposals, opts.flag("yes")).map_err(|e| match e {
            disk_cleanup_domain::ApprovalError::NotAcknowledged => {
                Failure::Usage("confirme com --yes: a remoção definitiva não tem volta".into())
            }
            other => Failure::Run(other.to_string()),
        })?;
    let guard = protected_paths_guard(ports.env);
    let printer = Printer {
        out: std::cell::RefCell::new(out),
    };
    let service = ExecuteService::new(ports.runner, ports.volumes, &guard, &printer);
    for tier in approved.plan().tiers() {
        let disposal = approved.disposal(tier).code();
        if opts.flag("dry-run") {
            let steps = service.preview(&approved, tier)?;
            let mut w = printer.out.borrow_mut();
            writeln!(w, "tier {tier} · dry-run · destino {disposal}")?;
            for s in steps {
                writeln!(w, "    {:<40} {} {}", s.id, s.kind, gb(s.estimated))?;
            }
            continue;
        }
        writeln!(printer.out.borrow_mut(), "tier {tier} · destino {disposal}")?;
        let run = service.execute(&approved, tier)?;
        writeln!(
            printer.out.borrow_mut(),
            "  tier {tier}: {} medidos ({} estimados) · {} na Lixeira · {} pendentes",
            signed_gb(run.freed()),
            gb(run.estimated()),
            gb(run.trashed()),
            run.pending().len()
        )?;
    }
    Ok(())
}
