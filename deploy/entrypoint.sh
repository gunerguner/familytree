#!/bin/sh
set -eu
mkdir -p /data
chown -R app:app /data
exec setpriv --reuid=app --regid=app --init-groups -- "$@"
