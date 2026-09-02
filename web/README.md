# Xteink browser emulator

This is a separate browser package. The firmware repository stays a normal
PlatformIO project; the browser package consumes its generated
`compile_commands.json` and compiles the same firmware sources to WASM.

## Install and run

```bash
npm install
npm run dev
```

Build a compile database once from the firmware checkout, then build any
browser profile from the simulator repository:

```bash
cd /path/to/microMarkD
pio run -e simulator_x4_pro -t compiledb

cd /path/to/crossink-simulator/web
npm install
python3 wasm/build.py \
  --firmware-root /path/to/microMarkD \
  --environment simulator_x4_pro
npm run dev
```

The dev server enables COOP/COEP headers because the firmware worker uses
`SharedArrayBuffer`. Front-end changes use Vite HMR; C++ changes require a new
WASM build.

The package currently exposes X4, X4 Pro, and X3 profiles. The build script
reuses the compile database and applies the selected device defines:

```bash
python3 wasm/build.py --firmware-root /path/to/microMarkD --environment simulator
python3 wasm/build.py --firmware-root /path/to/microMarkD --environment simulator_x3
```

Generated WASM profiles under `public/emulator/` are committed because the
GitHub Pages workflow publishes this repository without a firmware checkout.
Rebuild the profiles after firmware changes and commit the updated files.

GitHub Pages uses the `github-pages` Vite mode and publishes automatically from
`main` via `.github/workflows/pages.yml`.

## Checks

```bash
npm run format
npm run lint
npm run build
```
