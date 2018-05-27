set -e
set -x
cat > /nginx.conf <<EOF
worker_processes 1;
daemon off;
user nobody nogroup;
error_log stderr;

events {
	worker_connections 1024;
	accept_mutex off; # set to 'on' if nginx worker_processes > 1
	use epoll;
}

http {
	default_type application/json;
	types {
		text/html html htm;
		text/css css;
		text/xml xml;
		image/jpeg jpg;
		image/png png;
		image/svg+xml svg;
		application/x-javascript js;
	}
	access_log /dev/stdout combined;
	sendfile on;

	map \$http_upgrade \$connection_upgrade {
		default upgrade;
		'' close;
	}

	server {
		listen 443 ssl;
		server_name localhost;
		ssl_certificate cert.pem;
		ssl_certificate_key key.pem;
		client_max_body_size 1m;
		tcp_nodelay on;

		location / {
			root /usr/share/nginx/html/;
		}
	}
	
	server {
		listen 443 ssl;
		server_name api.localhost;
		ssl_certificate cert.pem;
		ssl_certificate_key key.pem;
		client_max_body_size 1m;
		tcp_nodelay on;

		keepalive_timeout 5;
		proxy_read_timeout 1d;
		proxy_send_timeout 1d;

		location /coin {
			proxy_pass http://localhost:29231/;
			proxy_http_version 1.1;
			proxy_set_header Upgrade \$http_upgrade;
			proxy_set_header Connection \$connection_upgrade;
		}
	}
}
EOF
nginx -c /nginx.conf