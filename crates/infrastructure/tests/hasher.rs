use std::fs;

use disk_cleanup_application::{ContentHasher, PortError};
use disk_cleanup_infrastructure::StdContentHasher;

#[test]
fn partial_full_and_byte_comparison_on_real_files() {
    let dir = tempfile::tempdir().unwrap();
    let p = |n: &str| dir.path().join(n).to_string_lossy().into_owned();
    let big: Vec<u8> = (0..200_000u32).map(|i| (i % 251) as u8).collect();
    let mut tail = big.clone();
    *tail.last_mut().unwrap() ^= 0xFF;
    let mut middle = big.clone();
    middle[100_000] ^= 0xFF;
    fs::write(p("a"), &big).unwrap();
    fs::write(p("b"), &big).unwrap();
    fs::write(p("tail"), &tail).unwrap();
    fs::write(p("middle"), &middle).unwrap();
    fs::write(p("small"), b"oi").unwrap();
    fs::write(p("small2"), b"oi").unwrap();
    fs::write(p("shorter"), &big[..199_999]).unwrap();
    let h = StdContentHasher;

    assert_eq!(h.partial(&p("a")).unwrap(), h.partial(&p("b")).unwrap());
    // fim diferente: o parcial já separa (lê início e fim)
    assert_ne!(h.partial(&p("a")).unwrap(), h.partial(&p("tail")).unwrap());
    // meio diferente: parcial igual, completo separa
    assert_eq!(
        h.partial(&p("a")).unwrap(),
        h.partial(&p("middle")).unwrap()
    );
    assert_ne!(h.full(&p("a")).unwrap(), h.full(&p("middle")).unwrap());
    assert_eq!(h.full(&p("a")).unwrap(), h.full(&p("b")).unwrap());
    assert_eq!(
        h.partial(&p("small")).unwrap(),
        h.partial(&p("small2")).unwrap()
    );

    assert!(h.equal(&p("a"), &p("b")).unwrap());
    assert!(!h.equal(&p("a"), &p("middle")).unwrap());
    assert!(!h.equal(&p("a"), &p("shorter")).unwrap());
    assert!(h.equal(&p("small"), &p("small2")).unwrap());

    for r in [h.partial(&p("nada")), h.full(&p("nada"))] {
        assert!(matches!(r, Err(PortError::Io(_))));
    }
    assert!(h.equal(&p("a"), &p("nada")).is_err());
}
