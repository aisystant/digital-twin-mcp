"""Contract: write_digital_twin — caller-scoped write under the access-control matrix.

Only the `1_declarative` category is user-writable; the rest are read-only for users.
"""

import httpx
import pytest


async def test_write_to_declarative_persists(mcp, auth, new_user):
    token = auth(new_user())
    res = await mcp.call(
        "write_digital_twin",
        {"path": "1_declarative/goals", "data": {"goal": "ship it"}},
        token=token,
    )
    assert not res.is_error
    read = await mcp.call("read_digital_twin", {"path": "1_declarative/goals"}, token=token)
    assert "ship it" in read.text


async def test_write_to_read_only_category_is_denied(mcp, auth, new_user):
    token = auth(new_user())
    res = await mcp.call(
        "write_digital_twin",
        {"path": "2_collected/probe", "data": {"marker": "should-not-persist"}},
        token=token,
    )
    assert res.is_error
    # and nothing was written
    read = await mcp.call("read_digital_twin", {"path": "2_collected/probe"}, token=token)
    assert "should-not-persist" not in read.text


async def test_isolated_between_users(mcp, auth, new_user):
    alice, bob = auth(new_user()), auth(new_user())
    await mcp.call(
        "write_digital_twin",
        {"path": "1_declarative/goals", "data": {"goal": "alice-only"}},
        token=alice,
    )
    read = await mcp.call("read_digital_twin", {"path": "1_declarative/goals"}, token=bob)
    assert "alice-only" not in read.text


async def test_requires_subscription(mcp, auth, new_user, assert_rejected):
    token = auth(new_user(), subscription=False)
    await assert_rejected(
        lambda: mcp.call(
            "write_digital_twin",
            {"path": "1_declarative/goals", "data": {"goal": "x"}},
            token=token,
        )
    )


async def test_requires_authentication(mcp):
    with pytest.raises(httpx.HTTPStatusError) as exc:
        await mcp.call(
            "write_digital_twin",
            {"path": "1_declarative/goals", "data": {"goal": "x"}},
        )
    assert exc.value.response.status_code == 401
