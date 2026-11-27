use disk_cleanup_domain::{belongs_to_installed, InstalledApp};

fn app(name: &str, publisher: &str, location: &str) -> InstalledApp {
    InstalledApp {
        name: name.into(),
        publisher: publisher.into(),
        location: location.into(),
    }
}

#[test]
fn a_folder_belongs_to_an_installed_app_by_name_publisher_or_install_folder() {
    let apps = vec![
        app("Slack", "Slack Technologies", ""),
        app(
            "Visual Studio Code",
            "Microsoft Corporation",
            r"C:\Users\u\AppData\Local\Programs\Microsoft VS Code",
        ),
        app("Discord", "Discord Inc.", ""),
        app("JetBrains Toolbox", "JetBrains s.r.o.", ""),
        app("Zoom Workplace", "Zoom Video Communications, Inc.", ""),
    ];
    for folder in [
        "Slack",
        "slack",
        "discord",
        "JetBrains",
        "Microsoft VS Code",
        "Zoom",
        // genérico demais para afirmar que é sobra
        "x",
        "ab",
    ] {
        assert!(belongs_to_installed(folder, &apps), "{folder}");
    }
    for folder in ["Postman", "Figma", "Spotify", "Code Cache Old"] {
        assert!(!belongs_to_installed(folder, &apps), "{folder}");
    }
    assert!(!belongs_to_installed("Postman", &[]));
}
