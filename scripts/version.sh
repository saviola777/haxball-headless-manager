#!/usr/bin/env bash
VERSION_STRING="`npm list | grep haxball-headless-manager | awk '{print $1}'`"
GIT_HASH="`git rev-parse --short HEAD`"
BUILD_DATE="`date +"%Y-%m-%d %H:%M:%S"`"
echo "// File auto-generated on $BUILD_DATE by version.sh" > ./src/_version.js
echo "module.exports.npmVersionString='$VERSION_STRING';" > ./src/_version.js
echo "module.exports.gitHash='$GIT_HASH';" >> ./src/_version.js
echo "module.exports.buildDate='$BUILD_DATE';" >> ./src/_version.js
