# Single Executable Distribution

`@valoranchi/riot-client` can be built and distributed as a standalone Windows executable (`riotclient-win-x64.exe`) requiring no installed Node.js runtime, npm dependencies, or environment configuration.

## Building the Executable

Run the build script from the root of `lib/`:

```bash
npm run exe
```

The build script automates the full Node.js Single Executable Application (SEA) pipeline:

1. **Compile TypeScript**: Compiles the codebase using `tsc` to `dist/`.
2. **Bundle with esbuild**: Bundles `dist/bin.js` and all dependencies (including `undici`) into a single self-contained CommonJS file (`dist/bundle.cjs`).
3. **Generate SEA Blob**: Runs `node --experimental-sea-config sea-config.json` to produce the SEA bytecode preparation blob (`dist/sea-prep.blob`).
4. **Copy Host Node Binary**: Copies the host Node binary (`process.execPath`) to `release/riotclient-win-x64.exe`.
5. **Inject with postject**: Uses `postject` to inject the SEA blob into the PE executable with fuse `NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`.

The final output is saved to:

```
release/riotclient-win-x64.exe
```

---

## Running the Executable

The standalone binary supports all CLI commands and options:

```powershell
# Check version
.\release\riotclient-win-x64.exe --version

# Inspect authenticated player
.\release\riotclient-win-x64.exe whoami

# Stream live match events
.\release\riotclient-win-x64.exe watch-match

# Run the HTTP integration server
.\release\riotclient-win-x64.exe serve --port 47800
```

---

---

## Desktop Double-Click Mode

You can distribute `riotclient-win-x64.exe` to users who do not use terminal commands:

- **Double-Click Launch**: Double-clicking the `.exe` in Windows Explorer automatically boots the local server (on port 47800, falling back to the next free port if busy) and immediately opens the interactive dashboard in your default browser.
- **Terminal Launch**: You can also launch the dashboard explicitly from any terminal via `riotclient dashboard` or `.\riotclient-win-x64.exe dashboard`.
- Keep the console window open while using the dashboard; closing the window stops the server.

---

## Download

Every GitHub release carries `riotclient-win-x64.exe` among its assets: [github.com/Valoranchi/valoranchi/releases](https://github.com/Valoranchi/valoranchi/releases).

### Windows SmartScreen Note

Because this is a community open-source binary distributed without a commercial Authenticode certificate, Windows SmartScreen may show a warning dialog ("Windows protected your PC") on first launch:

1. Click **More info**.
2. Click **Run anyway**.

---

## Windows Binary Signing Caveat

> [!WARNING]
> Official Node.js binaries for Windows are digitally signed by the Node.js Foundation.

When `postject` injects the SEA preparation blob into the resource section of `node.exe`, the executable's original digital signature is modified, causing Windows to detect the signature as corrupted (`warning: The signature seems corrupted!`).

### Recommended Mitigation

1. **Remove Existing Signature**:
   If the Windows SDK is installed, remove the original signature using Microsoft's `signtool`:

   ```powershell
   signtool remove /s release\riotclient-win-x64.exe
   ```

   The `npm run exe` script automatically attempts this step if `signtool` is available in your `PATH`.

2. **Re-sign with Your Certificate**:
   For commercial or widespread distribution, sign the final executable with your own Authenticode code-signing certificate:

   ```powershell
   signtool sign /fd SHA256 /a /tr http://timestamp.digicert.com /td SHA256 release\riotclient-win-x64.exe
   ```

3. **Running Without Signing**:
   The binary executes normally in developer consoles, automation scripts, and CI runners without re-signing. Windows SmartScreen presents the "More info -> Run anyway" dialog on desktop launches until signed.

---

## Automated CI Releases

The `.github/workflows/release.yml` workflow includes a `build-exe` job running on `windows-latest`. Whenever a new version is released, it builds `riotclient-win-x64.exe` and attaches it to the GitHub Release assets.
