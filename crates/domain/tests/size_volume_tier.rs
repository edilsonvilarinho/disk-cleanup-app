use disk_cleanup_domain::{ByteSize, DomainError, Tier, VolumeHealth, VolumeUsage};

const GIB: u64 = 1024 * 1024 * 1024;

#[test]
fn byte_size_converts_to_gib_using_binary_units() {
    assert_eq!(ByteSize::from_bytes(3 * GIB / 2).gib(), 1.5);
    assert_eq!(ByteSize::ZERO.bytes(), 0);
}

#[test]
fn byte_size_adds_sums_and_never_underflows() {
    let a = ByteSize::from_bytes(10);
    let b = ByteSize::from_bytes(4);
    assert_eq!((a + b).bytes(), 14);
    let mut c = a;
    c += b;
    assert_eq!(c.bytes(), 14);
    assert_eq!(b.saturating_sub(a), ByteSize::ZERO);
    assert_eq!(a.saturating_sub(b).bytes(), 6);
    let total: ByteSize = [a, b, c].into_iter().sum();
    assert_eq!(total.bytes(), 28);
    assert_eq!(
        ByteSize::from_bytes(u64::MAX) + a,
        ByteSize::from_bytes(u64::MAX)
    );
}

#[test]
fn volume_usage_rejects_invalid_capacity() {
    assert_eq!(
        VolumeUsage::new(ByteSize::ZERO, ByteSize::ZERO),
        Err(DomainError::InvalidVolume("capacidade total zero".into()))
    );
    assert!(matches!(
        VolumeUsage::new(ByteSize::from_bytes(10), ByteSize::from_bytes(11)),
        Err(DomainError::InvalidVolume(_))
    ));
}

#[test]
fn volume_usage_computes_used_and_percentages() {
    let v = VolumeUsage::new(ByteSize::from_bytes(1000), ByteSize::from_bytes(65)).unwrap();
    assert_eq!(v.total().bytes(), 1000);
    assert_eq!(v.free().bytes(), 65);
    assert_eq!(v.used().bytes(), 935);
    assert!((v.used_percent() - 93.5).abs() < 1e-9);
    assert!((v.free_percent() - 6.5).abs() < 1e-9);
}

#[test]
fn volume_health_thresholds_are_10_and_20_percent_free() {
    let at = |free| {
        VolumeUsage::new(ByteSize::from_bytes(100), ByteSize::from_bytes(free))
            .unwrap()
            .health()
    };
    assert_eq!(at(9), VolumeHealth::Critical);
    assert_eq!(at(10), VolumeHealth::Warning);
    assert_eq!(at(19), VolumeHealth::Warning);
    assert_eq!(at(20), VolumeHealth::Healthy);
}

#[test]
fn volume_usage_after_freeing_space_is_capped_at_total() {
    let v = VolumeUsage::new(ByteSize::from_bytes(100), ByteSize::from_bytes(10)).unwrap();
    assert_eq!(v.with_free(ByteSize::from_bytes(40)).free().bytes(), 40);
    assert_eq!(v.with_free(ByteSize::from_bytes(500)).free().bytes(), 100);
}

#[test]
fn tiers_have_fixed_execution_order_and_parse_from_letter() {
    assert_eq!(Tier::ALL, [Tier::A, Tier::B, Tier::C, Tier::D]);
    assert!(Tier::A < Tier::D);
    assert_eq!(Tier::C.letter(), 'C');
    assert_eq!("a".parse::<Tier>(), Ok(Tier::A));
    assert_eq!("b".parse::<Tier>(), Ok(Tier::B));
    assert_eq!("C".parse::<Tier>(), Ok(Tier::C));
    assert_eq!(" D ".parse::<Tier>(), Ok(Tier::D));
    assert_eq!(
        "X".parse::<Tier>(),
        Err(DomainError::UnknownTier("X".into()))
    );
    for t in Tier::ALL {
        assert!(!t.description().is_empty());
        assert_eq!(t.to_string(), t.letter().to_string());
    }
}
