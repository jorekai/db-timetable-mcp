# anti-slop (vendored)

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), directory `skills/install-anti-slop/assets/anti-slop`, commit `63dbb09f73438e550a6991dc6d778f979ffbf183`. MIT licensed, see `LICENSE`.

Loaded as an oxlint JS plugin through `jsPlugins` in `.oxlintrc.json`. Rules in `.oxlintrc.json` apply to the whole repository, rules in `.oxlintrc.changed.json` only to the files a branch changes.

## Differences from upstream

- `effect/` is removed, this project does not use the Effect library.
- `package.json` with `"type": "module"` is added, so that Node loads the plugin as an ES module without a warning.
- `LICENSE` is copied from the upstream repository root.
- Otherwise unchanged. The files are excluded from oxlint, oxfmt, knip, and `tsc`.

## Updating

1. Clone upstream and check out the commit you want.
2. Copy `skills/install-anti-slop/assets/anti-slop` over this directory, remove `effect/` again, and keep this file, `LICENSE`, and `package.json`.
3. Update the commit hash above, run `npm run lint`, and assess new findings.
