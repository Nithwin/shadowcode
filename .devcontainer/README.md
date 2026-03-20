# ShadowCode Development Container

This repository includes a development container setup for building ShadowCode locally or in Codespaces-compatible environments.

## Quick Start

1. Install Docker.
2. Open this repository in your editor.
3. Reopen in container from the command palette.
4. In the container terminal run:

```bash
npm install
./scripts/code.sh
```

## Recommended Resources

- CPU: 4 cores or more
- RAM: 8 GB or more

## Notes

- If a graphical desktop session is configured, use the VNC settings from your local environment.
- For better performance on macOS/Windows, prefer container volumes over bind mounts for large installs.
