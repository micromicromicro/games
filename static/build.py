#!/usr/bin/env python
import os
import subprocess
import shutil


for game in ['radishtrap']:
    os.chdir(game)
    subprocess.check_call(['npm', 'install'])
    subprocess.check_call([
        './node_modules/.bin/parcel', 'build',
        '--no-source-maps',
        'source/index.html'
    ])
    os.chdir('..')
    os.makedirs('built/{}'.format(game), exist_ok=True)
    shutil.copytree('{}/dist'.format(game), 'built/{}'.format(game))