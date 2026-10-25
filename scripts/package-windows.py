"""Package original sources and a ready-to-open game, without dependencies or secrets."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
root = Path(__file__).resolve().parents[1]
files = ['README.md', 'START-GAME.bat', 'English-Adventure-Island.html', 'index.html', 'package.json', 'package-lock.json', 'playwright.config.js', '.gitignore', '.nvmrc']
directories = ['src', 'public', 'docs', 'scripts', 'tests', 'dist', '.agents/skills/english-game-builder']
paths = [root / name for name in files]
for directory in directories:
    paths.extend(p for p in (root / directory).rglob('*') if p.is_file() and '__pycache__' not in p.parts)
output = root / 'exports' / 'English-Adventure-Island-Windows.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(set(paths)):
        assert path.is_file() and not path.is_symlink(), path
        archive.write(path, 'English-Adventure-Island/' + path.relative_to(root).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(set(archive.namelist()))
    assert archive.read('English-Adventure-Island/English-Adventure-Island.html') == (root / 'English-Adventure-Island.html').read_bytes()
    assert not any('/node_modules/' in n or '/.git/' in n or n.endswith('.env') for n in archive.namelist())
    print(f'ZIP validated: {len(archive.namelist())} files; {output.stat().st_size:,} bytes')
print(output)
print('SHA256:', hashlib.sha256(output.read_bytes()).hexdigest())
