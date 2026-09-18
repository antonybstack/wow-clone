"""Reproduce the selected CC0 MakeHuman garment sources; verify before extraction."""
from pathlib import Path
import hashlib, json, subprocess, zipfile
ROOT = Path(__file__).resolve().parents[2]
URL = 'https://files2.makehumancommunity.org/asset_packs/suits02/suits02_cc0.zip'
SHA = '437f4d7ab92b698c1fb1047e7d62b22c11f195b2473e936118661dc8e6b7eb7a'
archive = ROOT / '.cache/armory-assets/suits02_cc0.zip'
archive.parent.mkdir(parents=True, exist_ok=True)
if not archive.exists():
    temporary = archive.with_suffix('.download')
    subprocess.run(['curl', '--fail', '--location', '--retry', '2', '--output', str(temporary), URL], check=True)
    if hashlib.sha256(temporary.read_bytes()).hexdigest() != SHA:
        raise RuntimeError('Upstream archive changed; review source/license before accepting it')
    temporary.rename(archive)
assert hashlib.sha256(archive.read_bytes()).hexdigest() == SHA, 'Cached archive hash mismatch'
output = ROOT / 'blender/characters/sources/armory'
output.mkdir(parents=True, exist_ok=True)
files = []
with zipfile.ZipFile(archive) as pack:
    for name in pack.namelist():
        if name.endswith('/') or not any(name.startswith('clothes/' + item + '/') for item in ('rehmanpolanski_viking_tunic', 'rehmanpolanski_viking_boots', 'rehmanpolanski_viking_pants', 'donitz_monk_robe', 'donitz_monk_robe_hood')):
            continue
        data = pack.read(name)
        (output / Path(name).name).write_bytes(data)
        files.append({'path': Path(name).name, 'archivePath': name, 'sha256': hashlib.sha256(data).hexdigest()})
(output / 'provenance.json').write_text(json.dumps({
    'authors': ['Rehman Polanski', 'Donitz'], 'license': 'CC0-1.0', 'archive': URL, 'archiveSha256': SHA,
    'assetPage': 'https://static.makehumancommunity.org/assets/assetpacks/suits02.html',
    'licenseEvidence': 'Pack page and original .mhclo headers identify CC0 and author.',
    'files': files,
}, indent=2) + '\n')
print('Verified and extracted', len(files), 'garment source files')

# Short authored gloves use the same MakeClothes fitting contract.
glove_url = 'https://files.makehumancommunity.org/asset_packs/gloves01/gloves01_cc0.zip'
glove_sha = 'ecdaee1d02749d17352791d415cb622a883350cc8a4b90eda3725aef35d9afb2'
glove_archive = archive.parent / 'gloves01_cc0.zip'
if not glove_archive.exists():
    subprocess.run(['curl','--fail','--location','--retry','2','--output',str(glove_archive),glove_url],check=True)
assert hashlib.sha256(glove_archive.read_bytes()).hexdigest() == glove_sha, 'Glove source archive changed'
glove_files=[]
with zipfile.ZipFile(glove_archive) as pack:
    for name in pack.namelist():
        if not name.startswith('clothes/toigo_gloves_short/') or name.endswith('/'): continue
        data=pack.read(name);(output/Path(name).name).write_bytes(data)
        glove_files.append({'path':Path(name).name,'sha256':hashlib.sha256(data).hexdigest()})
(output/'gloves-provenance.json').write_text(json.dumps({'author':'Margaret Toigo','license':'CC0-1.0','archive':glove_url,'archiveSha256':glove_sha,'assetPage':'https://static.makehumancommunity.org/assets/assetpacks/gloves01.html','files':glove_files},indent=2)+'\n')
