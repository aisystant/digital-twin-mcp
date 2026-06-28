"""Contract: describe_by_path — metamodel navigation. No subscription, but auth required."""

import httpx
import pytest


async def test_root_lists_categories(mcp, auth, new_user):
    res = await mcp.call("describe_by_path", {"path": "/"}, token=auth(new_user()))
    assert "1_declarative" in res.text


async def test_nested_path_returns_children(mcp, auth, new_user):
    res = await mcp.call("describe_by_path", {"path": "1_declarative"}, token=auth(new_user()))
    assert res.text.strip()


async def test_unknown_path_does_not_yield_the_category_listing(mcp, auth, new_user):
    res = await mcp.call("describe_by_path", {"path": "no/such/path"}, token=auth(new_user()))
    assert res.is_error or "1_declarative" not in res.text


async def test_allowed_without_subscription(mcp, auth, new_user):
    res = await mcp.call("describe_by_path", {"path": "/"}, token=auth(new_user(), subscription=False))
    assert not res.is_error and "1_declarative" in res.text


async def test_requires_authentication(mcp):
    with pytest.raises(httpx.HTTPStatusError) as exc:
        await mcp.call("describe_by_path", {"path": "/"})
    assert exc.value.response.status_code == 401
