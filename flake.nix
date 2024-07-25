{
  description = "Cardano Lightning Demo";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    pre-commit-hooks-nix.url = "github:hercules-ci/pre-commit-hooks.nix/flakeModule";
    pre-commit-hooks-nix.inputs.nixpkgs.follows = "nixpkgs";
    treefmt-nix.url = "github:numtide/treefmt-nix";
  };

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; }
      {
        imports = [
          inputs.pre-commit-hooks-nix.flakeModule
          inputs.treefmt-nix.flakeModule
        ];
        systems = [ "x86_64-linux" "aarch64-darwin" ];
        perSystem = { config, self', inputs', pkgs, system, ... }: {
          treefmt = {
            projectRootFile = "flake.nix";
            flakeFormatter = true;
            programs = {
              prettier = {
                enable = true;
              };
            };
          };

          devShells.default =
          pkgs.mkShell {
            nativeBuildInputs = [
              config.treefmt.build.wrapper
            ]
            ;
            shellHook = ''
              echo 1>&2 "Welcome to the development shell!"
            '';
            name = "cardano-lightning";
            # Let's keep this "path discovery techinque" here for refernece:
            # (builtins.trace (builtins.attrNames inputs.cardano-addresses.packages.${system}) inputs.cardano-cli.packages)
            packages = with pkgs; [
              nodePackages_latest.nodejs
              nodePackages_latest.pnpm
              nodePackages.typescript
              nodePackages_latest.typescript-language-server
            ];
          };
        };
        flake = { };
      };
}
