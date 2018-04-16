#!/usr/bin/env bash

# If error code, stop script
set -e

# Install packages
npm config set strict-ssl false
npm install

# Build
npm run build

if [ "$#" -ne 0 ] && [ $1 = "--release" ]
then
    # Increment package json
    npm version $2 -m "Released %s"
    npm publish
    git push --follow-tags
fi