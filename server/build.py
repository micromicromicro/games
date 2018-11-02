#!/usr/bin/env python
import shutil
import os
import subprocess
resources = 'src/main/resources/cash/micromicro/games/payments'
os.makedirs(resources, exist_ok=True)
shutil.copy('../static/root/games.json', resources)
e = os.environ.copy()
e['JAVA_HOME'] = '/usr/lib/jvm/java-8-jdk'
subprocess.check_call(['mvn', 'clean', 'package'], env=e)
shutil.copy('target/main.jar', '.')
