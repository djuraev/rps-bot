FROM nginx:alpine

# our nginx settings replace the default ones
COPY nginx.conf /etc/nginx/conf.d/default.conf

# the web page: HTML, CSS, JavaScript
COPY public/ /usr/share/nginx/html/

EXPOSE 80
