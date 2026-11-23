use disk_cleanup_domain::{path_components, ByteSize, FocusRoot, SizeAggregator};

fn b(n: u64) -> ByteSize {
    ByteSize::from_bytes(n)
}

fn add(agg: &mut SizeAggregator, path: &str, logical: u64, allocated: u64) {
    agg.add_file(&path_components(path), b(logical), b(allocated));
}

#[test]
fn aggregates_volume_root_at_depth_one_and_two_in_a_single_pass() {
    let mut agg = SizeAggregator::new(vec![
        FocusRoot::new("volume-1", r"C:\", 1),
        FocusRoot::new("volume-2", r"C:\", 2),
    ]);
    add(&mut agg, r"C:\Users\u\a.bin", 100, 100);
    add(&mut agg, r"C:\Users\u\b.bin", 50, 40);
    add(&mut agg, r"C:\Windows\x.dll", 30, 30);
    add(&mut agg, r"C:\pagefile.sys", 70, 70);

    let level1 = agg.entries("volume-1");
    let names: Vec<_> = level1.iter().map(|e| e.key.join("\\")).collect();
    assert_eq!(names, ["Users", "pagefile.sys", "Windows"]);
    assert_eq!(level1[0].logical, b(150));
    assert_eq!(level1[0].allocated, b(140));
    assert_eq!(level1[0].files, 2);

    let level2 = agg.entries("volume-2");
    let users_u = level2.iter().find(|e| e.key == ["Users", "u"]).unwrap();
    assert_eq!(users_u.logical, b(150));
    // arquivo solto na raiz aparece com a própria chave de 1 segmento
    assert!(level2.iter().any(|e| e.key == ["pagefile.sys"]));
}

#[test]
fn focus_on_user_profile_ignores_files_outside_it_and_is_case_insensitive() {
    let mut agg = SizeAggregator::new(vec![FocusRoot::new("profile", r"C:\Users\Edils", 1)]);
    add(&mut agg, r"C:\Users\edils\AppData\Local\x", 10, 10);
    add(&mut agg, r"C:\Users\edils\.gradle\caches\y", 5, 5);
    add(&mut agg, r"C:\Users\other\z", 99, 99);
    add(&mut agg, r"C:\Users\edils", 1, 1); // o próprio diretório não gera chave
    let entries = agg.entries("profile");
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].key, ["AppData"]);
    assert_eq!(entries[1].key, [".gradle"]);
    assert_eq!(agg.total("profile"), b(15));
}

#[test]
fn entries_are_sorted_by_logical_size_then_by_name_for_stable_output() {
    let mut agg = SizeAggregator::new(vec![FocusRoot::new("r", "/", 1)]);
    add(&mut agg, "/b/x", 10, 10);
    add(&mut agg, "/a/x", 10, 10);
    add(&mut agg, "/c/x", 20, 20);
    let keys: Vec<_> = agg
        .entries("r")
        .into_iter()
        .map(|e| e.key.join("/"))
        .collect();
    assert_eq!(keys, ["c", "a", "b"]);
}

#[test]
fn unknown_focus_yields_nothing() {
    let agg = SizeAggregator::new(vec![]);
    assert!(agg.entries("nope").is_empty());
    assert_eq!(agg.total("nope"), ByteSize::ZERO);
}

#[test]
fn aggregate_entry_reports_placeholder_bytes_for_cloud_files() {
    let mut agg = SizeAggregator::new(vec![FocusRoot::new("p", r"C:\Users\u", 1)]);
    add(&mut agg, r"C:\Users\u\OneDrive - Empresa\doc.pdf", 60, 9);
    let e = &agg.entries("p")[0];
    assert!(e.is_cloud());
    assert_eq!(e.placeholder(), b(51));
    assert_eq!(e.name(), "OneDrive - Empresa");
}
