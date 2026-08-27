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

`packages/tiny-git` is intentionally a local workspace package. It owns the
local note commit model (branches, checkout, and snapshots) and can move to
its own repository without changing the emulator UI import.

The MicroMarkD workbench is a small Obsidian-like browser surface: it browses
the local vault, searches note contents, follows `[[wiki links]]`, shows tags
and backlinks, edits notes, and commits changes through tiny-git. It is a
preview companion for the emulator, not a second firmware implementation.

Generated WASM files under `public/emulator/` are ignored. Keep the source and
build script here; build the profile locally or in CI from a firmware checkout.

## Checks

```bash
npm run format
npm run lint
npm run build
```
