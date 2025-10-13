#!/bin/bash

# Script to run Wails development with virtual framebuffer
# This fixes the GTK initialization error on headless/WSL systems

echo "Starting Wails development server with virtual framebuffer..."
xvfb-run -a -s "-screen 0 1024x768x24" wails dev -tags webkit2_41 "$@"