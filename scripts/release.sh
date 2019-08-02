#!/usr/bin/env bash
VERSION="`npm list | grep haxball-headless-manager | cut -d' ' -f1 | cut -d'@' -f3`"

if [[ "`echo $VERSION | cut -d'-' -f2`" == "git" ]]
then
  echo "Releasing git version"
  cp dist/.local/hhm-testing.js dist/releases/hhm-git.js
else
  echo "Releasing stable $VERSION"
  cp dist/.local/hhm-testing.js dist/releases/hhm-$VERSION.js
  cp dist/.local/hhm-testing.js dist/releases/hhm-latest.js
fi
