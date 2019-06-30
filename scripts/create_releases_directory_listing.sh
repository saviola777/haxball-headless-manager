#!/bin/bash
# from https://stackoverflow.com/questions/21395159/shell-script-to-create-a-static-html-directory-listing

ROOT=./dist
#HTTP="/"
OUTPUT="dist/releases/index.html"

i=0
echo "<html><body><h1>HHM releases</h1><ul>" > $OUTPUT
for filepath in `find "$ROOT" -maxdepth 1 -mindepth 1 -name "releases"| sort`; do
  path=`basename "$filepath"`
  echo "  <li>$path</li>" >> $OUTPUT
  echo "  <ul>" >> $OUTPUT
  for i in `find "$filepath" -maxdepth 1 -mindepth 1 -name "hhm*.js"| sort`; do
    file=`basename "$i"`
    echo "    <li><a href=\"./$file\">$file</a></LI>" >> $OUTPUT
  done
  echo "  </ul>" >> $OUTPUT
done
echo "</ul></body></html>" >> $OUTPUT
