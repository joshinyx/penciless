import { execFileSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const ROOT   = resolve(".");
const ICONS  = join(ROOT, "src-tauri/icons");
const EXE    = join(ROOT, "src-tauri/target/release/penciless.exe");
const OUT    = join(ROOT, "src-tauri/target/release/bundle/msix");
const LAYOUT = join(OUT, "layout");
const ASSETS = join(LAYOUT, "Assets");
const MSIX   = join(OUT, "penciless.msix");
const PFX    = join(ROOT, "penciless.pfx");
const PFX_PASS = "joshiny";

function sdkTool(name) {
  const base = "C:\\Program Files (x86)\\Windows Kits\\10\\bin";
  for (const v of readdirSync(base).sort().reverse()) {
    const p = join(base, v, "x64", name);
    if (existsSync(p)) return p;
  }
  throw new Error(`${name} not found — install Windows 10/11 SDK.`);
}

if (!existsSync(EXE)) {
  throw new Error("penciless.exe not found — run 'npm run tauri build' first.");
}

// Layout
mkdirSync(ASSETS, { recursive: true });
copyFileSync(EXE, join(LAYOUT, "penciless.exe"));
for (const f of [
  "Square44x44Logo.png",
  "Square71x71Logo.png",
  "Square150x150Logo.png",
  "Square310x310Logo.png",
  "StoreLogo.png",
]) {
  copyFileSync(join(ICONS, f), join(ASSETS, f));
}

// Manifest
writeFileSync(join(LAYOUT, "AppxManifest.xml"), `\
<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap rescap">

  <Identity
    Name="com.penciless.app"
    Publisher="CN=joshiny"
    Version="0.1.0.0"
    ProcessorArchitecture="x64"/>

  <Properties>
    <DisplayName>penciless</DisplayName>
    <PublisherDisplayName>joshiny</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.26100.0"/>
  </Dependencies>

  <Resources>
    <Resource Language="en-US"/>
    <Resource Language="es-MX"/>
  </Resources>

  <Applications>
    <Application Id="penciless" Executable="penciless.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements
        DisplayName="penciless"
        Description="Screen annotation overlay"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png">
        <uap:DefaultTile Square71x71Logo="Assets\\Square71x71Logo.png"/>
      </uap:VisualElements>
    </Application>
  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust"/>
  </Capabilities>
</Package>`);

// Pack
execFileSync(sdkTool("makeappx.exe"), ["pack", "/d", LAYOUT, "/p", MSIX, "/o", "/nv"], { stdio: "inherit" });
console.log(`\nPacked: ${MSIX}`);

// Sign
if (existsSync(PFX)) {
  execFileSync(sdkTool("signtool.exe"),
    ["sign", "/fd", "SHA256", "/f", PFX, "/p", PFX_PASS, MSIX],
    { stdio: "inherit" });
  console.log("Signed OK");
  console.log("\nTo install: double-click penciless.msix");
  console.log("(Requires Developer Mode or the certificate trusted in Trusted Root)");
} else {
  console.log(`
To sign and install, create a self-signed cert once (PowerShell):

  $c = New-SelfSignedCertificate \`
    -Type Custom -Subject "CN=joshiny" \`
    -KeyUsage DigitalSignature \`
    -CertStoreLocation "Cert:\\CurrentUser\\My" \`
    -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}")
  Export-PfxCertificate -Cert $c -FilePath penciless.pfx \`
    -Password (ConvertTo-SecureString "${PFX_PASS}" -Force -AsPlainText)

Then re-run: node scripts/build-msix.mjs

To let other machines install it without Developer Mode,
also export the certificate to Trusted Root:
  certutil -addstore "Root" penciless.pfx
`);
}
