from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

PROTOCOL_VERSION = "2026-07-28"
LEGACY_PROTOCOL_VERSION = "2025-11-25"

class ProtocolError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code

@dataclass(frozen=True)
class RequestContext:
    protocol_version: str
    method: str
    name: str | None
    client_name: str
    client_version: str
    client_capabilities: dict[str, Any]


def parse_stateless_request(headers: dict[str, str], body: dict[str, Any]) -> RequestContext:
    normalized = {k.lower(): v for k, v in headers.items()}
    version = normalized.get("mcp-protocol-version")
    if version != PROTOCOL_VERSION:
        raise ProtocolError("ARQ5-MCP-0001", "unsupported or missing MCP protocol version")
    method_header = normalized.get("mcp-method")
    if not method_header:
        raise ProtocolError("ARQ5-MCP-0002", "Mcp-Method header is required")
    if body.get("jsonrpc") != "2.0" or body.get("method") != method_header:
        raise ProtocolError("ARQ5-MCP-0003", "JSON-RPC method and Mcp-Method header disagree")
    params = body.get("params") or {}
    name = normalized.get("mcp-name")
    if method_header == "tools/call":
        body_name = params.get("name")
        if not name or body_name != name:
            raise ProtocolError("ARQ5-MCP-0004", "tool name and Mcp-Name header disagree")
    meta = params.get("_meta") or {}
    info = meta.get("io.modelcontextprotocol/clientInfo") or {}
    client_name = info.get("name")
    client_version = info.get("version")
    if not isinstance(client_name, str) or not client_name:
        raise ProtocolError("ARQ5-MCP-0005", "client identity is required in request metadata")
    if not isinstance(client_version, str) or not client_version:
        raise ProtocolError("ARQ5-MCP-0006", "client version is required in request metadata")
    capabilities = meta.get("io.modelcontextprotocol/clientCapabilities") or {}
    if not isinstance(capabilities, dict):
        raise ProtocolError("ARQ5-MCP-0007", "client capabilities must be an object")
    return RequestContext(version, method_header, name, client_name, client_version, capabilities)


class StatelessRouter:
    """Small package-local demonstrator, not a complete MCP SDK."""
    def __init__(self):
        self._tools: dict[str, Callable[[dict[str, Any], RequestContext], Any]] = {}

    def register_tool(self, name: str, handler: Callable[[dict[str, Any], RequestContext], Any]) -> None:
        if not name.startswith("arq."):
            raise ValueError("ARQ tool names must use the arq. namespace")
        if name in self._tools:
            raise ValueError("duplicate tool")
        self._tools[name] = handler

    def discover(self) -> dict[str, Any]:
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": "arq-reference-domain", "version": "5.0.0-demo"},
            "capabilities": {"tools": True, "extensions": ["io.modelcontextprotocol/tasks"]},
            "tools": sorted(self._tools),
        }

    def handle(self, headers: dict[str, str], body: dict[str, Any]) -> dict[str, Any]:
        ctx = parse_stateless_request(headers, body)
        request_id = body.get("id")
        if ctx.method == "server/discover":
            return {"jsonrpc": "2.0", "id": request_id, "result": self.discover()}
        if ctx.method != "tools/call" or not ctx.name:
            raise ProtocolError("ARQ5-MCP-0008", "method is not supported by reference router")
        handler = self._tools.get(ctx.name)
        if handler is None:
            raise ProtocolError("ARQ5-MCP-0009", "unknown tool")
        arguments = (body.get("params") or {}).get("arguments") or {}
        if not isinstance(arguments, dict):
            raise ProtocolError("ARQ5-MCP-0010", "tool arguments must be an object")
        return {"jsonrpc": "2.0", "id": request_id, "result": handler(arguments, ctx)}
