use crate::Environment;

/// Expande `%VAR%`, `${VAR}` e `~` inicial. Retorna o nome da primeira
/// variável ausente como erro. Delimitadores sem par são mantidos literais.
pub fn expand_template(template: &str, env: &dyn Environment) -> Result<String, String> {
    let (mut out, rest) = expand_home(template, env)?;
    let mut rest = rest;
    while let Some(pos) = rest.find(['%', '$']) {
        out.push_str(&rest[..pos]);
        let tail = &rest[pos..];
        match variable_at(tail) {
            Some((name, consumed)) => {
                out.push_str(&env.var(name).ok_or_else(|| name.to_string())?);
                rest = &tail[consumed..];
            }
            None => {
                out.push_str(&tail[..1]);
                rest = &tail[1..];
            }
        }
    }
    out.push_str(rest);
    Ok(out)
}

fn expand_home<'a>(template: &'a str, env: &dyn Environment) -> Result<(String, &'a str), String> {
    let Some(rest) = template.strip_prefix('~') else {
        return Ok((String::new(), template));
    };
    if !(rest.is_empty() || rest.starts_with(['/', '\\'])) {
        return Ok((String::new(), template));
    }
    let home = env
        .var("HOME")
        .or_else(|| env.var("USERPROFILE"))
        .ok_or_else(|| "HOME".to_string())?;
    Ok((home, rest))
}

/// `(nome, bytes consumidos)` se `text` começa com `%NOME%` ou `${NOME}`.
fn variable_at(text: &str) -> Option<(&str, usize)> {
    let (open, close) = if text.starts_with("${") {
        ("${", '}')
    } else {
        ("%", '%')
    };
    let body = &text[open.len()..];
    let end = body.find(close)?;
    let name = &body[..end];
    let valid = !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_');
    valid.then_some((name, open.len() + end + 1))
}
