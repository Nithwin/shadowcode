# ShadowCode (Halwin IDE Core)

ShadowCode is a privacy-first, AI-native editor core based on the VS Code OSS codebase.

## Project Goals

- No Microsoft branding in product-facing surfaces.
- No Microsoft telemetry endpoints.
- Open ecosystem support with Open VSX.
- Offline-first AI workflows, including local providers.

## Build From Source

1. Install Node.js, npm, and platform build dependencies.
2. Run `npm install` in the repository root.
3. Start incremental builds:
   - `npm run watch-client-transpile`
   - `npm run watch-client`
   - `npm run watch-extensions`
4. Launch development app:
   - `./scripts/code.sh`

## Contributing

See `CONTRIBUTING.md`.

## Security

See `SECURITY.md` for private vulnerability reporting.

## License

Copyright (c) ShadowCode Contributors.

Licensed under the MIT license in `LICENSE.txt`.
