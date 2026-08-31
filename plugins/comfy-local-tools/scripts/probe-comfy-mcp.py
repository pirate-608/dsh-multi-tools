from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def default_binary(name: str) -> str:
    profile = Path(os.environ.get("USERPROFILE", Path.home()))
    return str(profile / ".local" / "bin" / name)


def default_mcp_python() -> str:
    appdata = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    return str(appdata / "uv" / "tools" / "comfy-mcp" / "Scripts" / "python.exe")


def to_jsonable(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


async def probe(args: argparse.Namespace) -> dict:
    server = Path(args.server)
    comfy = Path(args.comfy_bin)
    if not server.is_file():
        raise FileNotFoundError(f"comfy-mcp executable not found: {server}")
    if not comfy.is_file():
        raise FileNotFoundError(f"comfy executable not found: {comfy}")

    env = os.environ.copy()
    env["COMFY_BIN"] = str(comfy.resolve())
    env["COMFY_WHERE"] = "local"
    server_args = args.server_arg or ["-m", "comfy_mcp.server"]
    params = StdioServerParameters(
        command=str(server.resolve()),
        args=server_args,
        env=env,
    )

    async with asyncio.timeout(args.timeout):
        async with stdio_client(params, errlog=sys.stderr) as (read_stream, write_stream):
            async with ClientSession(
                read_stream,
                write_stream,
                read_timeout_seconds=args.timeout,
            ) as session:
                initialized = await session.initialize()
                listed = await session.list_tools()
                result = {
                    "ok": True,
                    "server": str(server.resolve()),
                    "server_args": server_args,
                    "comfy_bin": str(comfy.resolve()),
                    "initialize": to_jsonable(initialized),
                    "tool_count": len(listed.tools),
                    "tools": [tool.name for tool in listed.tools],
                }
                if not args.skip_server_info:
                    result["server_info"] = to_jsonable(
                        await session.call_tool("server_info", {})
                    )
                return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe the local Comfy MCP stdio server.")
    parser.add_argument("--server", default=default_mcp_python())
    parser.add_argument("--server-arg", action="append")
    parser.add_argument("--comfy-bin", default=default_binary("comfy.exe"))
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--skip-server-info", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(asyncio.run(probe(args)), indent=2, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error_type": type(exc).__name__,
                    "error": str(exc) or repr(exc),
                },
                ensure_ascii=False,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
