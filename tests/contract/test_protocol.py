"""Protocol contract: tool discovery via MCP tools/list (public, no auth)."""


async def test_advertises_exactly_the_three_committed_tools(mcp):
    assert set(await mcp.list_tools()) == {
        "describe_by_path",
        "read_digital_twin",
        "write_digital_twin",
    }


async def test_legacy_dt_tools_are_not_advertised(mcp):
    assert not any(name.startswith("dt_") for name in await mcp.list_tools())
