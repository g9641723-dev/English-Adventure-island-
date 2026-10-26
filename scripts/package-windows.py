"""Package the complete source and portable game without credentials or user data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import argparse
import hashlib
import os

parser = argparse.ArgumentParser()
parser.add_argument('--output', default='English-Adventure-Island-Windows.zip')
args = parser.parse_args()
if Path(args.output).name != args.output or not args.output.endswith('.zip'):
    parser.error('--output must be a ZIP basename')
root = Path(__file__).resolve().parents[1]
files = [
    'README.md', 'HANDOFF.md', 'START-GAME.bat',
    'English-Adventure-Island.html', 'index.html', 'teacher.html',
    'package.json', 'package-lock.json', 'vite.config.js',
    'playwright.config.js', 'playwright.cloud.config.js',
    'wrangler.jsonc', '.gitignore', '.nvmrc', '.env.cloud',
]
directories = ['src', 'public', 'docs', 'scripts', 'tests', 'dist',
               'worker', 'functions', '.agents/skills/english-game-builder']
excluded = {'.git', 'node_modules', '.wrangler', '.cloudflare', '__pycache__',
            'artifacts', 'test-results', 'playwright-report', 'exports'}
paths = [root / name for name in files]
for directory in directories:
    for current, dirs, names in os.walk(root / directory, followlinks=False):
        dirs[:] = [d for d in dirs if d not in excluded]
        for name in names:
            if name.startswith(('.env', '.dev.vars')) or name.endswith(('.log', '.key', '.pem', '.p12', '.pyc')):
                continue
            paths.append(Path(current) / name)
output = root / 'exports' / args.output
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(set(paths)):
        assert path.is_file() and not path.is_symlink(), path
        assert path.resolve().is_relative_to(root), path
        archive.write(path, 'English-Adventure-Island/' + path.relative_to(root).as_posix())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert len(names) == len(set(names))
    for name in files:
        assert archive.read('English-Adventure-Island/' + name) == (root / name).read_bytes()
    for name in ['worker/index.js', 'worker/migrations/0001_schema.sql',
                 'functions/api/[[path]].js', '.agents/skills/english-game-builder/SKILL.md']:
        assert 'English-Adventure-Island/' + name in names
    assert not any(set(Path(n).parts) & excluded for n in names)
    assert not any(Path(n).name.startswith('.env') and Path(n).name != '.env.cloud' for n in names)
    assert not any(Path(n).name.startswith('.dev.vars') for n in names)
    print(f'ZIP validated: {len(names)} files; {output.stat().st_size:,} bytes')
print(output)
print('SHA256:', hashlib.sha256(output.read_bytes()).hexdigest())
