use std::fs::File;
use std::hash::{DefaultHasher, Hasher};
use std::io::{Read, Seek, SeekFrom};

use disk_cleanup_application::{ContentHasher, PortError};

/// Trecho lido do início e do fim no hash parcial.
const EDGE: u64 = 4096;
const CHUNK: usize = 64 * 1024;

/// Hash de conteúdo com o hasher da biblioteca padrão. Não precisa ser
/// criptográfico: a última etapa confirma byte a byte. Só leitura.
#[derive(Debug, Clone, Copy, Default)]
pub struct StdContentHasher;

fn open(path: &str) -> Result<File, PortError> {
    File::open(path).map_err(|e| PortError::Io(format!("{path}: {e}")))
}

fn io(path: &str, e: &std::io::Error) -> PortError {
    PortError::Io(format!("{path}: {e}"))
}

/// Lê até encher `buf` ou acabar o arquivo; devolve quantos bytes vieram.
fn fill(file: &mut File, buf: &mut [u8]) -> std::io::Result<usize> {
    let mut read = 0;
    while read < buf.len() {
        match file.read(&mut buf[read..])? {
            0 => break,
            n => read += n,
        }
    }
    Ok(read)
}

impl ContentHasher for StdContentHasher {
    fn partial(&self, path: &str) -> Result<u64, PortError> {
        let mut file = open(path)?;
        let len = file.metadata().map_err(|e| io(path, &e))?.len();
        let mut hasher = DefaultHasher::new();
        hasher.write_u64(len);
        let mut buf = vec![0u8; usize::try_from(EDGE).unwrap_or(4096)];
        let n = fill(&mut file, &mut buf).map_err(|e| io(path, &e))?;
        hasher.write(&buf[..n]);
        if len > EDGE * 2 {
            file.seek(SeekFrom::Start(len - EDGE))
                .map_err(|e| io(path, &e))?;
            let n = fill(&mut file, &mut buf).map_err(|e| io(path, &e))?;
            hasher.write(&buf[..n]);
        }
        Ok(hasher.finish())
    }

    fn full(&self, path: &str) -> Result<u64, PortError> {
        let mut file = open(path)?;
        let mut hasher = DefaultHasher::new();
        let mut buf = vec![0u8; CHUNK];
        loop {
            let n = fill(&mut file, &mut buf).map_err(|e| io(path, &e))?;
            if n == 0 {
                break;
            }
            hasher.write(&buf[..n]);
        }
        Ok(hasher.finish())
    }

    fn equal(&self, a: &str, b: &str) -> Result<bool, PortError> {
        let (mut fa, mut fb) = (open(a)?, open(b)?);
        let (mut ba, mut bb) = (vec![0u8; CHUNK], vec![0u8; CHUNK]);
        loop {
            let na = fill(&mut fa, &mut ba).map_err(|e| io(a, &e))?;
            let nb = fill(&mut fb, &mut bb).map_err(|e| io(b, &e))?;
            if na != nb || ba[..na] != bb[..nb] {
                return Ok(false);
            }
            if na == 0 {
                return Ok(true);
            }
        }
    }
}
