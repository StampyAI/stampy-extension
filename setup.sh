#!/bin/bash

if [ "$1" = "chrome" ]; then
  cp manifest.chrome.json manifest.json
elif [ "$1" = "firefox" ]; then
  cp manifest.firefox.json manifest.json
else
  echo "Usage: ./setup.sh [chrome|firefox]"
  exit 1
fi 