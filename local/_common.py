import subprocess

host_local = '127.0.0.1'
docker_env = {'DOCKER_HOST': 'unix:///var/run/docker.sock'}


def cc(args, **kwargs):
    print('-> {}'.format(args))
    subprocess.check_call(args, **kwargs)


def ca(args, **kwargs):
    print('-> {}'.format(args))
    ret = subprocess.call(args, **kwargs)
    print('\t= {}'.format(ret))


def compose(target, build=False):
    cc(
        [
            'docker-compose',
            '-f', 'docker-compose.yml',
            '-p', 'localradish',
            'up',
            '-d',
        ] + (
            ['--build'] if build else ['--no-build']
        ) + [
            target
        ],
        env=docker_env,
    )