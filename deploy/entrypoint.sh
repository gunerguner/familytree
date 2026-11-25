#!/bin/sh
set -eu
mkdir -p /data /data/backups
chown -R app:app /data
exec setpriv --reuid=app --regid=app --init-groups -- "$@"
