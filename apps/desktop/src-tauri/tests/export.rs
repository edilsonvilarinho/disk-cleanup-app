use std::path::Path;

use disk_cleanup_desktop_lib::{
    suggested_png_name, validate_png, with_png_extension, MAX_PNG_BYTES, PNG_SIGNATURE,
};

#[test]
fn nome_sugerido_sem_caminho_nem_caracteres_estranhos() {
    assert_eq!(
        suggested_png_name(Some("relatorio-2026-11-23.png")),
        "relatorio-2026-11-23.png"
    );
    assert_eq!(suggested_png_name(Some("relatorio")), "relatorio.png");
    assert_eq!(suggested_png_name(Some("RELATORIO.PNG")), "RELATORIO.PNG");
    assert_eq!(
        suggested_png_name(Some("..\\..\\Windows\\evil.png")),
        "evil.png"
    );
    assert_eq!(suggested_png_name(Some("/etc/pass wd")), "passwd.png");
    assert_eq!(
        suggested_png_name(Some("...")),
        "disk-cleanup-relatorio.png"
    );
    assert_eq!(suggested_png_name(None), "disk-cleanup-relatorio.png");
    assert_eq!(suggested_png_name(Some(&"a".repeat(300))).len(), 100);
}

#[test]
fn caminho_escolhido_sempre_termina_em_png() {
    assert_eq!(
        with_png_extension(Path::new("/tmp/r.png")),
        Path::new("/tmp/r.png")
    );
    assert_eq!(
        with_png_extension(Path::new("/tmp/r.PNG")),
        Path::new("/tmp/r.PNG")
    );
    assert_eq!(
        with_png_extension(Path::new("/tmp/r")),
        Path::new("/tmp/r.png")
    );
    assert_eq!(
        with_png_extension(Path::new("/tmp/r.txt")),
        Path::new("/tmp/r.txt.png")
    );
}

#[test]
fn so_aceita_png_dentro_do_limite() {
    let mut png = PNG_SIGNATURE.to_vec();
    png.extend_from_slice(b"IHDR");
    assert!(validate_png(&png).is_ok());
    assert_eq!(validate_png(b"GIF89a").unwrap_err().code, "export_not_png");
    assert_eq!(validate_png(&[]).unwrap_err().code, "export_not_png");
    let mut big = PNG_SIGNATURE.to_vec();
    big.resize(MAX_PNG_BYTES + 1, 0);
    assert_eq!(validate_png(&big).unwrap_err().code, "export_too_large");
}
