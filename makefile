# To deploy you need the following symlinks/mounts:
# - remote/: remote server for 'make deploy'
# - remote_stable/: remote server for 'make deploy_stable'
# - plugins/: plugin directory, should contain one folder per repository
#
# browserify needs to be installed or symlinked, e.g.:
# npm install browserify && ln -s `pwd`/node_modules/browserify/bin/cmd.js ~/bin/browserify
all: build
build: prepare_build
	@echo "Running browserify..."
	browserify index.js -o dist/hhm.js -d
deploy: build
	@echo "Deploying files..."
	cp dist/*.js remote/
	cp config/*.js remote/config/
	rsync -r -t -p -v -L --progress --delete -u plugins/ remote/plugins/
deploy_stable: build
	@echo "Deploying files to stable remote..."
	cp dist/*.js remote_stable/
	cp config/*.js remote_stable/config/
	rsync -r -t -p -v -L --progress --delete -u plugins/ remote_stable/plugins/
prepare_build:
	@echo "Preparing dist directory..."
	mkdir -p dist/
	rm -rf dist/*
