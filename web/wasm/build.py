#!/usr/bin/env python3
"""Compile the existing native simulator sources to a browser WASM artifact."""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import shlex
import shutil
import subprocess
import sys


SIMULATOR_ROOT = pathlib.Path(__file__).resolve().parents[2]
STUB_ROOT = pathlib.Path(__file__).resolve().parent / "stubs"
WASM_ROOT = pathlib.Path(__file__).resolve().parent
EXTRA_SOURCES = [
    SIMULATOR_ROOT / "src" / "HalDisplay.cpp",
    SIMULATOR_ROOT / "src" / "HalGPIO.cpp",
    WASM_ROOT / "src" / "sdl_browser.cpp",
    WASM_ROOT / "src" / "wasm_main.cpp",
    WASM_ROOT / "src" / "http_canned.cpp",
    WASM_ROOT / "src" / "http_wasm_fetch.cpp",
]
DEVICE_NAMES = {
    "simulator_x4_pro": "x4pro",
    "simulator": "x4",
    "simulator_x3": "x3",
}
SKIP_NAMES = {"simulator_main.cpp", "HalDisplay.cpp", "HalGPIO.cpp", "HttpDownloader.cpp"}


def arguments(entry: dict[str, object]) -> list[str]:
    command = entry.get("command")
    if isinstance(command, str):
        return shlex.split(command)
    return [str(value) for value in entry["arguments"]]


def translate(
    args: list[str],
    output: pathlib.Path,
    source: pathlib.Path,
    firmware_root: pathlib.Path,
    environment: str,
) -> list[str]:
    translated = ["emcc" if source.suffix == ".c" else "em++", f"-I{STUB_ROOT}", f"-I{SIMULATOR_ROOT / 'src'}", f"-I{firmware_root / 'src'}"]
    profile_defines = {
        "simulator": ["-DFREEINK_DEVICE_X4=1"],
        "simulator_x4_pro": ["-DSIMULATOR_DEVICE_X4_PRO", "-DFREEINK_DEVICE_X4PRO=1"],
        "simulator_x3": ["-DSIMULATOR_DEVICE_X3", "-DFREEINK_DEVICE_X3=1"],
    }[environment]
    skip_next = False
    for arg in args[1:]:
        if skip_next:
            skip_next = False
            continue
        if arg in {"-o", "-MF"}:
            skip_next = True
            continue
        if arg in {"-c"} or arg.endswith((".cpp", ".cc", ".c")):
            continue
        if arg in {"-DSIMULATOR_DEVICE_X4_PRO", "-DSIMULATOR_DEVICE_X3", "-DFREEINK_DEVICE_X4PRO=1", "-DFREEINK_DEVICE_X3=1"}:
            continue
        if arg.startswith("-I") and "SDL2" in arg:
            continue
        if arg.startswith("-lSDL2") or arg == "-D_THREAD_SAFE":
            continue
        translated.append(arg)
    translated.extend(
        [
            *profile_defines,
            "-pthread",
            "-fno-signed-char",
            "-Wno-unused-command-line-argument",
            "-Oz",
            "-MMD",
            "-MF",
            str(output.with_suffix(".d")),
            "-c",
            "-o",
            str(output),
            str(source),
        ]
    )
    return translated


def compile_one(job: tuple[pathlib.Path, list[str], pathlib.Path, pathlib.Path, pathlib.Path, str]) -> tuple[pathlib.Path, int, str]:
    source, args, object_root, firmware_root, command_root, environment = job
    digest = hashlib.sha1(str(source).encode()).hexdigest()[:10]
    output = object_root / f"{source.stem}-{digest}.o"
    output.parent.mkdir(parents=True, exist_ok=True)
    command = translate(args, output, source, firmware_root, environment)
    stamp = output.with_suffix(".cmd")
    dependencies = output.with_suffix(".d")
    wanted = " ".join(command)
    if output.exists() and stamp.exists() and dependencies.exists() and stamp.read_text() == wanted:
        dependency_text = dependencies.read_text().replace("\\\n", " ")
        dependency_paths = shlex.split(dependency_text.split(":", 1)[-1])
        if all(
            not (dependency_path := pathlib.Path(path)).exists()
            or dependency_path.stat().st_mtime <= output.stat().st_mtime
            for path in dependency_paths
        ):
            return source, 0, ""
    result = subprocess.run(command, cwd=command_root, capture_output=True, text=True)
    if result.returncode == 0:
        stamp.write_text(wanted)
    return source, result.returncode, result.stderr


def load_sources(firmware_root: pathlib.Path) -> list[tuple[pathlib.Path, list[str]]]:
    compile_commands = firmware_root / "compile_commands.json"
    if not compile_commands.exists():
        raise SystemExit(f"{compile_commands} missing; run `pio run -e simulator_x4_pro -t compiledb` first")
    entries = json.loads(compile_commands.read_text())
    sources: list[tuple[pathlib.Path, list[str]]] = []
    for entry in entries:
        path = pathlib.Path(str(entry["file"]))
        if not path.is_absolute():
            path = (firmware_root / path).resolve()
        if path.name in SKIP_NAMES or not path.exists():
            continue
        sources.append((path, arguments(entry)))
    if not sources:
        raise SystemExit("compile_commands.json contains no usable simulator sources")
    template = max(sources, key=lambda item: sum(arg.startswith("-I") for arg in item[1]))[1]
    extra_sources = [
        *EXTRA_SOURCES,
        firmware_root / "src" / "activities" / "micromarkd" / "MarkdownSyncActivity.cpp",
    ]
    sources.extend((source, template) for source in extra_sources if source.exists())
    return sources


def build(firmware_root: pathlib.Path, environment: str) -> None:
    if environment not in DEVICE_NAMES:
        raise SystemExit(f"unsupported environment: {environment}")
    if not shutil.which("em++"):
        raise SystemExit("em++ is not on PATH; install Emscripten and activate it")

    sources = load_sources(firmware_root)
    device = DEVICE_NAMES[environment]
    object_root = firmware_root / ".pio" / "build" / f"wasm-{device}"
    output_root = SIMULATOR_ROOT / "web" / "public" / "emulator" / device
    output_root.mkdir(parents=True, exist_ok=True)
    jobs = [(source, args, object_root, firmware_root, firmware_root, environment) for source, args in sources]
    failures: list[tuple[pathlib.Path, str]] = []
    objects: list[pathlib.Path] = []
    with concurrent.futures.ThreadPoolExecutor() as executor:
        for source, result, error in executor.map(compile_one, jobs):
            if result:
                failures.append((source, error))
            else:
                digest = hashlib.sha1(str(source).encode()).hexdigest()[:10]
                objects.append(object_root / f"{source.stem}-{digest}.o")
    if failures:
        for source, error in failures[:8]:
            print(f"\n--- {source}\n{error[-1800:]}", file=sys.stderr)
        raise SystemExit(f"WASM compile failed for {len(failures)} translation unit(s)")

    card = firmware_root / "fs_"
    link = [
        "em++",
        *(str(object) for object in objects),
        "-o",
        str(output_root / "crosspoint.js"),
        "-pthread",
        "-sPTHREAD_POOL_SIZE=4",
        "-sSTACK_SIZE=4MB",
        "-sDEFAULT_PTHREAD_STACK_SIZE=4MB",
        "-sALLOW_MEMORY_GROWTH=1",
        "-sINITIAL_MEMORY=134217728",
        "-sEXIT_RUNTIME=0",
        "-sMODULARIZE=1",
        "-sEXPORT_NAME=createCrosspoint",
        "-sENVIRONMENT=web,worker",
        "-sFORCE_FILESYSTEM=1",
        "-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,HEAPU8,HEAPU32,FS,ENV",
        "-sEXPORTED_FUNCTIONS=_main,_malloc,_free,_crosspoint_frame_ptr,_crosspoint_frame_width,_crosspoint_frame_height,_crosspoint_frame_rotation,_crosspoint_consume_dirty,_crosspoint_touch,_crosspoint_key,_crosspoint_set_sleep_timeout,_crosspoint_get_sleep_timeout,_crosspoint_http_sab_alloc",
        "-sASSERTIONS=1",
        "-Oz",
    ]
    if card.exists():
        link.append(f"--preload-file={card}@/fs_")
    result = subprocess.run(link, cwd=firmware_root, capture_output=True, text=True)
    if result.returncode:
        print(result.stderr[-5000:], file=sys.stderr)
        raise SystemExit("WASM link failed")
    (output_root / "BUILT_FROM").write_text(f"{environment}\n")
    print(f"built {device} from {len(objects)} translation units -> {output_root}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--firmware-root", type=pathlib.Path, required=True)
    parser.add_argument("--environment", default="simulator_x4_pro", choices=sorted(DEVICE_NAMES))
    args = parser.parse_args()
    build(args.firmware_root.resolve(), args.environment)


if __name__ == "__main__":
    main()
