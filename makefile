all: build
build: prepare_build
	@echo "Generating version information"
	./scripts/version.sh
	@echo "Running browserify..."
	./node_modules/browserify/bin/cmd.js index.js -o dist/.local/hhm-testing.js -d
release: build
	@echo "Releasing HHM files..."
	./scripts/release.sh
	tree -Dsht -T "HHM releases" --noreport -P "hhm*.js" -H . -o dist/releases/index.html dist/releases/
	./node_modules/surge/lib/cli.js ./dist hhm.surge.sh
prepare_build:
	@echo "Preparing dist directory..."
	mkdir -p dist/{releases,.local}
	mkdir -p dist/.local/hhm
	rm -rf dist/.local/hhm/*
jsdoc:
	@echo "Compiling JSDoc"
	mkdir -p dist/api
	rm -rf dist/api/*
	./node_modules/.bin/jsdoc src -c jsdoc.json
