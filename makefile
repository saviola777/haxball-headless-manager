all: build
build: prepare_build
	@echo "Running browserify..."
	browserify index.js -o dist/hhm.js -d
deploy: build
	@echo "Deploying files..."
	cp dist/*.js remote/
	cp config/*.js remote/config/
	rsync -r -t -p -v --progress --delete -u plugins/ remote/plugins/
deploy_stable: build
	@echo "Deploying files to stable remote..."
	cp dist/*.js remote_stable/
	cp config/*.js remote_stable/config/
	rsync -r -t -p -v --progress --delete -u plugins/ remote_stable/plugins/
prepare_build:
	@echo "Preparing dist directory..."
	mkdir -p dist/
	rm -rf dist/*
