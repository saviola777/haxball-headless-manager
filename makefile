# To deploy you need the following symlinks/mounts:
# - remote/: remote server for 'make deploy'
# - remote_stable/: remote server for 'make deploy_stable'
# - plugins/: plugin directory, should contain one folder per repository
#
# browserify needs to be installed or symlinked, e.g.:
# npm install browserify && ln -s `pwd`/node_modules/browserify/bin/cmd.js ~/bin/browserify
all: build
build: prepare_build
	@echo "Generating version information"
	./scripts/version.sh
	@echo "Running browserify..."
	browserify index.js -o dist/.local/hhm-testing.js -d
release: build
	@echo "Releasing HHM files..."
	./scripts/release.sh
	tree -Dsht -T "HHM releases" --noreport -P "hhm*.js" -H . -o dist/releases/index.html dist/releases/
	surge ./dist hhm.surge.sh
prepare_build:
	@echo "Preparing dist directory..."
	mkdir -p dist/{releases,.local}
	rm -rf dist/.local/*
jsdoc:
	@echo "Compiling JSDoc"
	mkdir -p dist/api
	rm -rf dist/api/*
	./node_modules/.bin/jsdoc src -c jsdoc.json
