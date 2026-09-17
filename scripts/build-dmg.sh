#!/usr/bin/env bash
set -e

echo "==> Building Tauri release..."
npx tauri build

echo "==> Cleaning extended attributes & codesigning CEOVA.app..."
xattr -cr src-tauri/target/release/bundle/macos/CEOVA.app
codesign --force --deep --sign - src-tauri/target/release/bundle/macos/CEOVA.app

echo "==> Staging DMG with /Applications symlink..."
DMG_STAGING="src-tauri/target/release/bundle/dmg-staging"
rm -rf "$DMG_STAGING"
mkdir -p "$DMG_STAGING"
cp -R src-tauri/target/release/bundle/macos/CEOVA.app "$DMG_STAGING/"
ln -s /Applications "$DMG_STAGING/Applications"

echo "==> Creating DMG..."
mkdir -p src-tauri/target/release/bundle/dmg
DMG_OUT="src-tauri/target/release/bundle/dmg/CEOVA_1.2.7_aarch64.dmg"
rm -f "$DMG_OUT"
hdiutil create -volname "CEOVA" -srcfolder "$DMG_STAGING" -ov -format UDZO "$DMG_OUT"

echo "==> Signing DMG..."
codesign --force --sign - "$DMG_OUT"
rm -rf "$DMG_STAGING"

echo "==> Done! Output: $DMG_OUT"
