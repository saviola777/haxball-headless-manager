# To deploy you need the following symlinks/mounts:
# - remote/: remote server for 'make deploy'
# - remote_stable/: remote server for 'make deploy_stable'
# - plugins/: plugin directory, should contain one folder per repository
#
# browserify needs to be installed or symlinked, e.g.:
# npm install browserify && ln -s `pwd`/node_modules/browserify/bin/cmd.js ~/bin/browserify
all: build
build: prepare_build jsdoc
	@echo "Running browserify..."
	browserify index.js -o dist/hhm.js -d
	@echo "Generating version information"
	./scripts/version.sh
deploy: build
	@echo "Deploying files..."
	cp dist/*.js remote/
	cp config/*.js remote/config/
	rsync -r -t -p -v -L --progress --delete -u plugins/hhm-plugins/ remote/plugins/hhm-plugins/
deploy_stable: build
	@echo "Deploying files to stable remote..."
	cp dist/*.js remote_stable/
	cp config/*.js remote_stable/config/
	rsync -r -t -p -v -L --progress --delete -u plugins/hhm-plugins/ remote_stable/plugins/hhm-plugins/
deploy_jsdoc: jsdoc
	rsync -r -t -p -v --progress --delete --size-only -u jsdoc/ remote_stable/docs/
prepare_build:
	@echo "Preparing dist directory..."
	mkdir -p dist/
	rm -rf dist/*
jsdoc:
	@echo "Compiling JSDoc"
	mkdir -p /tmp/jsdoc
	ln -sf /tmp/jsdoc jsdoc
	./node_modules/.bin/jsdoc src -c jsdoc.json
