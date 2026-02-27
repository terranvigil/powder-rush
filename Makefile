.PHONY: dev build deploy

REMOTE_URL := $(shell git remote get-url origin)

dev:
	npm run dev

build:
	npm run build

deploy: build
	@echo "Deploying to GitHub Pages..."
	@rm -rf /tmp/powder-rush-deploy
	@mkdir -p /tmp/powder-rush-deploy
	@cp -r dist/* /tmp/powder-rush-deploy/
	@cd /tmp/powder-rush-deploy && \
		git init && \
		git add -A && \
		git commit -m "Deploy to GitHub Pages" && \
		git push --force $(REMOTE_URL) HEAD:gh-pages
	@rm -rf /tmp/powder-rush-deploy
	@echo "Deployed! Enable GitHub Pages from gh-pages branch in repo settings."
