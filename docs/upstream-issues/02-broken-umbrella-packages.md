# Publishing pipeline: umbrella npm packages publish without their `main` files

## Affected versions

- `ruvector@0.2.23` (npm) — broken
- `@ruvector/sona@0.1.6` (npm) — broken
- (likely affects future umbrella packages without a fix to the publishing pipeline)

The platform-specific packages (`@ruvector/sona-darwin-arm64@0.1.5`, `@ruvector/graph-node-darwin-arm64@2.0.2`, `@ruvector/rvf-node-darwin-arm64@0.1.7`) are correctly published and contain working `.node` binaries.

## Summary

Two umbrella packages on npm declare `main` and `types` paths in their `package.json` that aren't present in the published tarball. After `npm install <pkg>`, `require()` / `import` fails with `Cannot find module` even though the package itself installed successfully. This is consistent across two unrelated packages and looks like a systemic publishing-pipeline bug rather than an oversight on either.

## Reproducers

### `ruvector` (umbrella for everything)

```bash
$ mkdir /tmp/probe-ruvector && cd /tmp/probe-ruvector && npm init -y
$ npm install ruvector
$ node -e "import('ruvector').then(m => console.log(Object.keys(m)))"
Cannot find module '/private/tmp/probe-ruvector/node_modules/ruvector/dist/index.js'.
Please verify that the package.json has a valid "main" entry
```

Inspecting the installed package:

```bash
$ cat node_modules/ruvector/package.json | grep -E '"main"|"types"'
"main": "dist/index.js",
"types": "dist/index.d.ts",

$ ls node_modules/ruvector/dist 2>&1
ls: node_modules/ruvector/dist: No such file or directory
```

### `@ruvector/sona`

```bash
$ npm install @ruvector/sona
$ node -e "import('@ruvector/sona')"
Cannot find package '/.../node_modules/@ruvector/sona/index.js' imported from /.../

$ ls node_modules/@ruvector/sona/
package.json
README.md

$ cat node_modules/@ruvector/sona/package.json | grep -E '"main"|"types"'
"main": "index.js",
"types": "index.d.ts",
```

The convention for napi-rs umbrella packages is that `index.js` performs platform detection and re-exports the right `@ruvector/<name>-<platform>` package. Both packages above declare that intent in their `package.json` (the platform packages exist in `optionalDependencies`) but the actual `index.js` and `index.d.ts` files aren't shipped.

## Expected

After `npm install ruvector` (or `@ruvector/sona`), `import` / `require` should resolve and return the binding's exports. The convention is for the umbrella's `index.js` to use `napi-rs`'s standard "load platform package" boilerplate, e.g.:

```js
const { platform, arch } = require('os');
const candidates = {
  'darwin-arm64': '@ruvector/sona-darwin-arm64',
  // ... etc
};
module.exports = require(candidates[`${platform()}-${arch()}`]);
```

## Actual

Both umbrellas install but immediately fail to import.

## Workaround used in downstream SDK

An integrating SDK has to bypass the umbrella and load the platform package directly. In TypeScript:

```ts
function resolveBindingPath(): string {
  const env = process.env.RUVECTOR_SONA_BINDING;
  if (env) return env;
  const platform = `${process.platform}-${process.arch}`;
  // Try common platform-package layouts
  for (const pkg of [`@ruvector/sona-${platform}`, `@ruvector/sona-${platform}-gnu`]) {
    try {
      const dir = require.resolve(`${pkg}/package.json`).replace(/\/package\.json$/, '');
      for (const c of [`${dir}/sona.${platform}.node`, `${dir}/sona.${platform}-gnu.node`])
        if (existsSync(c)) return c;
    } catch {/* try next */}
  }
  throw new Error('binding not found');
}
const binding = require(resolveBindingPath());
```

This works but requires every SDK to reimplement platform detection, which is exactly what the umbrella package is supposed to provide.

## Suggested fix

Two possibilities, in order of preference:

1. **Publish the umbrella's `index.js` and `index.d.ts`.** napi-rs ships a code generator that produces the correct boilerplate; either the publishing pipeline's `prepublish` step is missing, or the `files: [...]` in the package.json doesn't include the generated files. Compare the published tarball (`npm pack`) against the in-repo `npm/packages/<name>/index.js` / `index.d.ts` — if those exist locally but don't appear in the tarball, fix is in `package.json#files` or `.npmignore`.

2. **Document the workaround if the umbrella shape is intentional.** A note in the package's README saying "the umbrella is a placeholder; install `@ruvector/<name>-<platform>` directly" would prevent every integrator from rediscovering the same workaround.

This affects multi-platform publishing across the whole org — the same fix likely applies to other umbrella packages (`@ruvector/core`, `@ruvector/gnn`, `@ruvector/attention`, etc.) that aren't yet published on the registry.

## Related: `@ruvector/core` not published at all

`@ruvector/core` (the headline package per the upstream README) is not on the npm registry as of this writing — neither the umbrella nor any platform package. The in-repo prebuilt at `ruvector/npm/core/platforms/<platform>/ruvector.node` works when loaded directly, but downstream SDKs can't depend on it via npm. Filing as a related but separate concern.
