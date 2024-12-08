#!/bin/bash

# Check if browser argument is provided
if [ -z "$1" ]; then
    echo "Usage: ./package.sh [chrome|firefox|all]"
    exit 1
fi

BROWSER=$1

# Create dist directory
mkdir -p dist

function package_chrome() {
    echo "Packaging for Chrome Web Store..."
    cp manifest.chrome.json manifest.json
    zip -r dist/stampy-extension-chrome.zip . \
        -x "*.git*" \
        -x "*.sh" \
        -x "manifest.firefox.json" \
        -x "dist/*" \
        -x "*.DS_Store" \
        -x "README.md"
    echo "Chrome package created: dist/stampy-extension-chrome.zip"
}

function package_firefox() {
    echo "Packaging for Firefox Add-ons..."
    cp manifest.firefox.json manifest.json
    zip -r dist/stampy-extension-firefox.zip . \
        -x "*.git*" \
        -x "*.sh" \
        -x "manifest.chrome.json" \
        -x "dist/*" \
        -x "*.DS_Store" \
        -x "README.md"
    echo "Firefox package created: dist/stampy-extension-firefox.zip"
}

# Package based on argument
case $BROWSER in
    "chrome")
        package_chrome
        ;;
    "firefox")
        package_firefox
        ;;
    "all")
        package_chrome
        package_firefox
        ;;
    *)
        echo "Invalid browser. Use 'chrome', 'firefox', or 'all'"
        exit 1
        ;;
esac
