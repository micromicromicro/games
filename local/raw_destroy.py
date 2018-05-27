#!/usr/bin/env python3
from _common import ca, docker_env


ca(['docker', 'stop', 'microraw_nginx_1'], env=docker_env)
ca(['docker', 'rm', 'microraw_nginx_1'], env=docker_env)
