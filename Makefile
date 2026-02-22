SHELL := /bin/sh

.PHONY: make run deploy

make:
	@echo "Usage:"
	@echo "  make        - show this help"
	@echo "  make run    - run local web server on http://localhost:8000"
	@echo "  make deploy - scp project files to boids.exe.dev"

run:
	python3 -m http.server 8000

deploy:
	scp -r index.html app.js favicon.svg README.md Makefile boids.exe.xyz:~/
