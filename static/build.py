#!/usr/bin/env python
import os
import os.path
import subprocess
import shutil
import json

shutil.rmtree('built', ignore_errors=True)
os.makedirs('built', exist_ok=True)

for game in ['radishtrap']:
    os.chdir(game)
    subprocess.check_call(['npm', 'install'])
    shutil.rmtree('dist', ignore_errors=True)
    shutil.rmtree('build', ignore_errors=True)
    shutil.copytree('source', 'build')
    with open('build/_config.ts', 'w') as config:
        json.dump(dict(
            host='https://api.development.micromicro.cash',
            port=29231
        ), config)
    subprocess.check_call([
        './node_modules/.bin/parcel', 'build',
        '--no-source-maps',
        '--public-url', '.',
        'source/index.html'
    ])
    os.chdir('..')
    dest = 'built/{}'.format(game)
    shutil.rmtree(dest, ignore_errors=True)
    shutil.copytree('{}/dist'.format(game), dest)
    source = '{}/source'.format(game)
    for extra in os.listdir(source):
        if extra.endswith((
            '.ts',
            '.html',
        )):
            continue
        shutil.copy('{}/{}'.format(source, extra), dest)