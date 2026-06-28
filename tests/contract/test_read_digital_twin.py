"""Contract: read_digital_twin — caller-scoped read. Subscription + auth required."""

import httpx
import pytest


async def test_write_then_read_returns_the_value(mcp, auth, new_user):
    token = auth(new_user())
    await mcp.call(
        "write_digital_twin",
        {"path": "1_declarative/goals", "data": {"goal": "ship it"}},
        token=token,
    )
    res = await mcp.call("read_digital_twin", {"path": "1_declarative/goals"}, token=token)
    assert "ship it" in res.text


async def test_isolated_between_users(mcp, auth, new_user):
    alice, bob = auth(new_user()), auth(new_user())
    await mcp.call(
        "write_digital_twin",
        {"path": "1_declarative/goals", "data": {"goal": "alice-only"}},
        token=alice,
    )
    res = await mcp.call("read_digital_twin", {"path": "1_declarative/goals"}, token=bob)
    assert "alice-only" not in res.text


async def test_requires_subscription(mcp, auth, new_user, assert_rejected):
    token = auth(new_user(), subscription=False)
    await assert_rejected(
        lambda: mcp.call("read_digital_twin", {"path": "1_declarative/goals"}, token=token)
    )


async def test_requires_authentication(mcp):
    with pytest.raises(httpx.HTTPStatusError) as exc:
        await mcp.call("read_digital_twin", {"path": "1_declarative/goals"})
    assert exc.value.response.status_code == 401
