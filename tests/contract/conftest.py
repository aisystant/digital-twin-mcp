"""Black-box contract harness for digital-twin-mcp.

Tests drive the server through its REAL external surface only:

  * the MCP transport (Streamable HTTP) — `tools/list` and `tools/call`;
  * authentication via a real Ory-style JWT (RS256, verified against a JWKS the
    server fetches from `ORY_URL`).

Nothing here knows how the server stores data. State is created and observed purely
through tools, and every test uses a fresh random `sub`, so twins start empty and are
naturally isolated — no database fixture, no schema assumptions.

The server does not exist yet, so these tests are red. The only things they assume are
the agreed contract: an MCP server at `/mcp`, JWT auth, and the three tools.
"""

import json
import time
import uuid

import httpx
import jwt
import pytest
import pytest_asyncio
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt.algorithms import RSAAlgorithm

# The subscription signal is a JWT claim injected by Ory Hydra's token hook. The exact
# claim NAME is still open (see ../../OPEN-QUESTIONS.md); keep it in this one place so
# tests assert the *behaviour* (subscribed vs not), not a wire detail spread everywhere.
SUBSCRIPTION_CLAIM = "subscription"
_KID = "contract-test-key"


@pytest.fixture(scope="session")
def _rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def auth(_rsa_key, httpserver, monkeypatch):
    """Serve a JWKS the server trusts and return a token factory.

    `auth(sub, subscription=...)` mints a signed JWT exactly as Ory would; the server
    verifies it against the JWKS at ORY_URL like in production.
    """
    jwk = json.loads(RSAAlgorithm.to_jwk(_rsa_key.public_key()))
    jwk.update({"kid": _KID, "alg": "RS256", "use": "sig"})
    httpserver.expect_request("/.well-known/jwks.json").respond_with_json({"keys": [jwk]})
    issuer = httpserver.url_for("").rstrip("/")
    monkeypatch.setenv("ORY_URL", issuer)

    def make_token(sub: str, *, subscription: bool = True) -> str:
        claims = {
            "iss": issuer,
            "sub": sub,
            "iat": int(time.time()),
            "exp": int(time.time()) + 300,
        }
        if subscription:
            claims[SUBSCRIPTION_CLAIM] = "active"
        return jwt.encode(claims, _rsa_key, algorithm="RS256", headers={"kid": _KID})

    return make_token


@pytest.fixture
def new_user():
    """Factory for fresh, never-before-seen subjects (each starts with an empty twin)."""
    return lambda: str(uuid.uuid4())


class ToolResult:
    def __init__(self, text: str, is_error: bool):
        self.text = text
        self.is_error = is_error


def _parse(response: httpx.Response) -> dict:
    if response.headers.get("content-type", "").startswith("text/event-stream"):
        for line in response.text.splitlines():
            if line.startswith("data:"):
                return json.loads(line[5:].strip())
        raise AssertionError("no data frame in SSE response")
    return response.json()


class MCPClient:
    """Minimal MCP Streamable HTTP client over an in-process ASGI app."""

    PATH = "/mcp"

    def __init__(self, client: httpx.AsyncClient):
        self._c = client
        self._sid: str | None = None
        self._n = 0

    def _headers(self, token: str | None) -> dict:
        h = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json"}
        if self._sid:
            h["Mcp-Session-Id"] = self._sid
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h

    async def _rpc(self, method: str, params: dict, token: str | None) -> dict:
        self._n += 1
        body = {"jsonrpc": "2.0", "id": self._n, "method": method, "params": params}
        r = await self._c.post(self.PATH, json=body, headers=self._headers(token))
        r.raise_for_status()  # surfaces transport-level auth rejection (401/403) to tests
        if sid := r.headers.get("Mcp-Session-Id"):
            self._sid = sid
        return _parse(r)

    async def _ensure_session(self, token: str | None) -> None:
        if self._sid:
            return
        await self._rpc(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "contract-tests", "version": "0"},
            },
            token,
        )

    async def list_tools(self, token: str | None = None) -> list[str]:
        await self._ensure_session(token)
        res = await self._rpc("tools/list", {}, token)
        return [t["name"] for t in res["result"]["tools"]]

    async def call(self, name: str, arguments: dict, token: str | None = None) -> ToolResult:
        await self._ensure_session(token)
        res = await self._rpc("tools/call", {"name": name, "arguments": arguments}, token)
        if "error" in res:  # JSON-RPC error → normalise to an error result
            return ToolResult(text=str(res["error"].get("message", "")), is_error=True)
        result = res["result"]
        text = "".join(
            block.get("text", "")
            for block in result.get("content", [])
            if block.get("type") == "text"
        )
        return ToolResult(text=text, is_error=bool(result.get("isError")))


@pytest_asyncio.fixture
async def mcp(auth):
    from digital_twin_mcp.app import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://contract.test") as client:
        yield MCPClient(client)


@pytest.fixture
def assert_rejected():
    """Assert a tool call is rejected, tolerant of HOW (HTTP 4xx, JSON-RPC error, or
    an isError result) — so tests don't pin the rejection mechanism."""

    async def _check(make_call):
        try:
            result = await make_call()
        except httpx.HTTPStatusError as exc:
            assert exc.response.status_code in (401, 402, 403)
            return
        assert result.is_error

    return _check
