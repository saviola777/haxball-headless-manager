all: build
build: prepare_build
	@echo "Running browserify..."
	browserify index.js -o dist/hhm.js -d
deploy: build
	@echo "Deploying files..."
	cp dist/*.js remote/
	cp config/*.js remote/config/
	rsync -r -t -p -v --progress --delete --size-only -u plugins/ remote/plugins/
prepare_build:
	@echo "Preparing dist directory..."
	mkdir -p dist/
	rm -rf dist/*
