#!/usr/bin/env python3
"""Build a standalone tools site, including dependencies outside source/tools.

Usage: python3 scripts/migrate_tools.py SOURCE_SITE [--target TARGET]
Only generated public files are written; repository/workflow files stay intact.
"""
import argparse
import hashlib
import json
import re
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ORIGIN = 'https://tools.hzifa33.com'
PORTFOLIO = 'https://hzifa33.com'
TEXT_EXT = {'.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.xml', '.txt'}
ASSET_REF = re.compile(r'''(?<![\w])(/assets/[a-zA-Z0-9_./%+@-]+)''')
CSS_URL = re.compile(r'''url\(\s*['"]?([^'"\s)]+)''')
SOURCE_URL = re.compile(
    r'https://(?:www\.)?hzifa33\.(?:com|github\.io)(/)(?:(ar|es)/)?tools(?=/|["\'?#\s<)]|$)',
    re.IGNORECASE,
)
TOOL_PATH = re.compile(r'/(?:((?:ar|es))/)?tools(?=/|["\'?#\s<)]|$)')


def rebase(text, filename):
    # These links lead to the portfolio, not the new tools homepage.
    if filename.endswith('.html'):
        text = re.sub(r'''href=(["'])/\1''', r'href=\1https://hzifa33.com/\1', text)
    text = SOURCE_URL.sub(lambda m: ORIGIN + ('/' + m[2] if m[2] else ''), text)
    text = TOOL_PATH.sub(
        lambda m: ('/' + m[1] if m[1] else '') +
        ('' if text[m.end():m.end() + 1] == '/' else '/'), text)
    if filename.endswith('.html'):
        text = re.sub(r'''(data-page-path|href)=(["'])\2''', r'\1=\2/\2', text)
    if filename.endswith('.webmanifest'):
        data = json.loads(text)
        for field in ('id', 'start_url', 'scope'):
            if data.get(field) == '':
                data[field] = '/'
        text = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    # Scripts that select a tool by its old /tools/<slug>/ position.
    if filename in {'assets/core.js', 'assets/ux.js'}:
        text = text.replace(".split('/')[2]", ".split('/')[1]")
    if filename == 'assets/action-icons.js':
        text = text.replace("location.pathname.split('/')[2]",
                            "location.pathname.replace(/^\\/(ar|es)(?=\\/)/,'').split('/')[1]")
    if filename == 'assets/soft-runtime.js':
        text = text.replace("'https://hzifa33.com'+url", "'https://tools.hzifa33.com'+url")
    if filename == 'assets/ux.js':
        text = text.replace("a.getAttribute('href')==='/'", "a.getAttribute('href')==='https://hzifa33.com/'")
    return text


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {'src', 'href', 'poster'} and value:
                self.urls.append(value)
            if key == 'srcset' and value:
                self.urls.extend(x.strip().split()[0] for x in value.split(','))


def text_files(files):
    for name, data in list(files.items()):
        if Path(name).suffix in TEXT_EXT:
            try:
                yield name, data.decode('utf-8')
            except UnicodeDecodeError:
                continue


def validate(files):
    errors = set()

    def check(url, name):
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc or not parsed.path:
            return
        # Literal paths only; dynamic JS path fragments are checked via the tree.
        path = unquote(parsed.path)
        if path.startswith('/'):
            local = path.lstrip('/')
        else:
            import posixpath
            local = posixpath.normpath(str(Path(name).parent / path))
        if local in ('', '.') or path.endswith('/'):
            local = (local.rstrip('/') + '/index.html').lstrip('/')
        if local not in files:
            errors.add(f'{name}: missing {url}')

    for name, text in text_files(files):
        if Path(name).suffix == '.html':
            parser = References()
            parser.feed(text)
            for url in parser.urls:
                check(url, name)
        if Path(name).suffix == '.css':
            for url in CSS_URL.findall(text):
                check(url, name)
        if Path(name).suffix == '.webmanifest':
            manifest = json.loads(text)
            for key in ('id', 'start_url', 'scope'):
                check(manifest[key], name)
            for icon in manifest.get('icons', []):
                check(icon['src'], name)
            for shortcut in manifest.get('shortcuts', []):
                check(shortcut['url'], name)
                for icon in shortcut.get('icons', []):
                    check(icon['src'], name)
        for asset in ASSET_REF.findall(text):
            # Concatenated expressions such as '/assets/logo-'+theme+'.svg'.
            if Path(asset).suffix:
                check(asset, name)
        if re.search(r'''importScripts\(\s*['"]/sw\.js['"]''', text) and name == 'sw.js':
            errors.add('sw.js imports itself')
    if errors:
        raise ValueError('Migration validation failed:\n' + '\n'.join(sorted(errors)))


def make_worker(files):
    digest = hashlib.sha256()
    for name, data in sorted(files.items()):
        digest.update(name.encode() + b'\0' + data)
    cache = 'hoztools-root-' + digest.hexdigest()[:16]
    # Precache the shell without downloading large PDF libraries during install.
    core = ['/offline.html', '/', '/ar/', '/es/', '/manifest.webmanifest']
    for name in sorted(files):
        if name.startswith('assets/') and (name.startswith('assets/fonts/') or
                name.startswith('assets/soft-') or name in {
                    'assets/tools-ui.css', 'assets/core.js', 'assets/icons.js',
                    'assets/logo.svg', 'assets/logo-light.svg', 'assets/logo-dark.svg',
                    'assets/install-prompt.js', 'assets/app-icon-classic-clear-192.png'}):
            core.append('/' + name)
    pages = sorted('/' + n[:-10] for n in files if n.endswith('index.html'))
    return '''/* Generated by scripts/migrate_tools.py. Cache public site resources only. */
const CACHE = %s;
const OFFLINE = '/offline.html';
const CORE = %s;
const PAGES = new Set(%s);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(n => n.startsWith('hoztools-') && n !== CACHE).map(n => caches.delete(n)));
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = url.pathname.replace(/index\\.html$/, '');
  const page = request.mode === 'navigate' && (PAGES.has(path) || PAGES.has(path + '/'));
  const asset = url.pathname.startsWith('/assets/') && /\\.(?:js|mjs|css|png|svg|jpg|jpeg|webp|ttf|woff2?|wasm|bcmap|icc|pfb)$/.test(url.pathname);
  const manifest = /^(?:\\/(?:ar|es))?\\/manifest\\.webmanifest$/.test(url.pathname);
  if (!page && !asset && !manifest) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && (response.type === 'basic' || response.type === 'default')) {
        event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      // Precached shell entries have no query string.
      if (asset) {
        const shell = await cache.match(url.pathname);
        if (shell) return shell;
      }
      if (page) return (await cache.match(OFFLINE)) || Response.error();
      return Response.error();
    }
  })());
});
''' % (json.dumps(cache), json.dumps(core), json.dumps(pages))


def migrate(source, target):
    source, target = source.resolve(), target.resolve()
    if source == target or not (source / 'tools/index.html').is_file():
        raise ValueError('SOURCE_SITE must contain tools/index.html and differ from TARGET')
    files = {}
    for prefix, folder in [('', source / 'tools'), ('ar/', source / 'ar/tools'), ('es/', source / 'es/tools')]:
        if not folder.is_dir():
            raise ValueError(f'Missing language source: {folder}')
        for path in sorted(folder.rglob('*')):
            if path.is_file() and not path.is_symlink():
                name = prefix + path.relative_to(folder).as_posix()
                if name != 'sw.js':
                    files[name] = path.read_bytes()
    # Recursively collect shared assets referenced by pages, CSS, or JS.
    # Include theme-dependent logo names that are assembled in JavaScript.
    pending = {'assets/logo.svg', 'assets/logo-light.svg', 'assets/logo-dark.svg'}
    while True:
        for name, text in text_files(files):
            pending.update(p.lstrip('/') for p in ASSET_REF.findall(text)
                           if (source / p.lstrip('/')).is_file())
        missing = sorted(pending - files.keys())
        if not missing:
            break
        for name in missing:
            path = source / name
            if not path.is_file() or path.is_symlink():
                raise ValueError(f'Missing shared dependency: {name}')
            files[name] = path.read_bytes()
    for name, text in text_files(files):
        files[name] = rebase(text, name).encode('utf-8')
    files['CNAME'] = b'tools.hzifa33.com\n'
    validate(files)
    files['sw.js'] = make_worker(files).encode()
    # Validate the complete build before touching the destination repository.
    with tempfile.TemporaryDirectory(prefix='hoztools-build-') as folder:
        stage = Path(folder)
        for name, data in files.items():
            path = stage / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        changed = 0
        for name in sorted(files):
            path = target / name
            if not path.is_file() or path.read_bytes() != files[name]:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes((stage / name).read_bytes())
                changed += 1
    print(f'Validated {len(files)} public files; updated {changed} files in {target}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--target', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    migrate(args.source, args.target)
