#!/usr/bin/env python
import subprocess

subprocess.check_call(['npm', 'install'])
subprocess.check_call(['./node_modules/.bin/tsc', '--out', 'bundle.js'])