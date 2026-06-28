{
  description = "digital-twin-mcp — autonomous MCP server for learner digital twins";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    systems.url = "github:nix-systems/default";
    devenv.url = "github:cachix/devenv";
  };

  # devenv binary cache — speeds up first `nix develop`.
  nixConfig = {
    extra-substituters = "https://devenv.cachix.org";
    extra-trusted-public-keys = "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
  };

  outputs =
    { nixpkgs
    , devenv
    , systems
    , ...
    } @ inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      devShells = forEachSystem (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          # Enter with: nix develop --impure
          default = devenv.lib.mkShell {
            inherit inputs pkgs;
            modules = [
              ({ ... }: {
                # Python 3.13 + uv as the dependency manager.
                languages.python = {
                  enable = true;
                  version = "3.13";
                  uv.enable = true;
                  uv.sync.enable = true;
                };

                # Local Postgres for contract tests (no pgvector needed for this server).
                # Start with `devenv up`; tests connect to 127.0.0.1:5432.
                services.postgres = {
                  enable = true;
                  listen_addresses = "127.0.0.1";
                  initialDatabases = [{ name = "digital_twin"; }];
                };

                packages = [ pkgs.ruff ];

                env.DATABASE_URL = "postgres://127.0.0.1:5432/digital_twin";
              })
            ];
          };
        });
    };
}
