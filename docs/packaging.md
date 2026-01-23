# MSIX Packaging Guide

This guide covers creating, signing, and deploying MSIX packages for WinUI applications.

## Overview

MSIX is the modern Windows app package format that provides:

- Clean installation and uninstallation
- Automatic updates
- App identity for Windows APIs
- Microsoft Store distribution
- Enterprise deployment support

## Prerequisites

- Windows App Development CLI (winapp)
- A code signing certificate (for distribution)
- Windows 10 version 1809 or later

---

## Creating MSIX Packages

### Using VS Code Commands

1. Build your project in Release mode
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run **WinUI: Create MSIX Package**
4. Select the output location
5. The package is created

### Using the CLI

```bash
# Build and publish
dotnet publish -c Release -r win-x64

# Create MSIX package
winapp package -i ./bin/x64/Release/publish -o ./dist/MyApp.msix -m ./Package.appxmanifest
```

### Publishing Options

```bash
# Self-contained deployment
dotnet publish -c Release -r win-x64 --self-contained true

# Framework-dependent deployment
dotnet publish -c Release -r win-x64 --self-contained false

# Trimmed deployment (smaller size)
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishTrimmed=true
```

---

## App Manifest

The `Package.appxmanifest` file defines your app's identity and capabilities.

### Key Elements

```xml
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap rescap">

  <!-- App Identity - Must match your certificate -->
  <Identity
    Name="MyCompany.MyApp"
    Publisher="CN=MyCompany"
    Version="1.0.0.0" />

  <!-- Display Properties -->
  <Properties>
    <DisplayName>My App</DisplayName>
    <PublisherDisplayName>My Company</PublisherDisplayName>
    <Logo>Assets\StoreLogo.png</Logo>
  </Properties>

  <!-- Target Windows Versions -->
  <Dependencies>
    <TargetDeviceFamily 
      Name="Windows.Desktop" 
      MinVersion="10.0.17763.0" 
      MaxVersionTested="10.0.22621.0" />
  </Dependencies>

  <!-- App Entry Point -->
  <Applications>
    <Application 
      Id="App"
      Executable="MyApp.exe"
      EntryPoint="$targetentrypoint$">
      <uap:VisualElements
        DisplayName="My App"
        Description="My awesome WinUI app"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\Square150x150Logo.png"
        Square44x44Logo="Assets\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\Wide310x150Logo.png" />
        <uap:SplashScreen Image="Assets\SplashScreen.png" />
      </uap:VisualElements>
    </Application>
  </Applications>

  <!-- App Capabilities -->
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
```

### Common Capabilities

| Capability | Description |
|------------|-------------|
| `internetClient` | Internet access (outbound) |
| `privateNetworkClientServer` | Local network access |
| `documentsLibrary` | Documents folder access |
| `picturesLibrary` | Pictures folder access |
| `runFullTrust` | Full trust (desktop apps) |

### Generating a Manifest

```bash
# Generate a new manifest
winapp manifest generate

# Validate an existing manifest
winapp manifest validate ./Package.appxmanifest
```

**VS Code command:** WinUI: Generate App Manifest

---

## Code Signing

### Why Sign?

- Required for Windows SmartScreen trust
- Required for Microsoft Store submission
- Required for enterprise deployment
- Provides authenticity verification

### Certificate Types

| Type | Use Case |
|------|----------|
| Self-signed | Development and testing |
| Trusted CA | Production distribution |
| EV Code Signing | Highest trust, required for kernel drivers |

### Generating a Development Certificate

**Using VS Code:**

1. Run **WinUI: Generate Development Certificate**
2. Enter subject name (e.g., `CN=MyDevelopment`)
3. Choose output location
4. Enter a password

**Using CLI:**

```bash
winapp cert generate -n "CN=MyDevelopment" -o ./certs/dev.pfx -p MyPassword123
```

### Installing a Certificate

For local testing, install the certificate:

**Using VS Code:**

1. Run **WinUI: Install Certificate**
2. Select the certificate file

**Using CLI:**

```bash
winapp cert install ./certs/dev.pfx
```

**Manual installation:**

1. Double-click the .pfx file
2. Select "Local Machine"
3. Install to "Trusted People" store

### Signing a Package

**Using VS Code:**

1. Run **WinUI: Sign Package**
2. Select the MSIX file
3. Select the certificate
4. Enter the password

**Using CLI:**

```bash
winapp sign -i ./dist/MyApp.msix -c ./certs/dev.pfx -p MyPassword123 -t http://timestamp.digicert.com
```

### Timestamp Servers

Always use a timestamp server for production:

| Provider | URL |
|----------|-----|
| DigiCert | `http://timestamp.digicert.com` |
| Sectigo | `http://timestamp.sectigo.com` |
| GlobalSign | `http://timestamp.globalsign.com` |

---

## MSIX Bundle

For multi-architecture distribution, create a bundle:

```bash
# Create architecture-specific packages
winapp package -i ./publish-x64 -o ./packages/MyApp_x64.msix
winapp package -i ./publish-arm64 -o ./packages/MyApp_arm64.msix

# Bundle them (using makeappx)
winapp tool makeappx bundle /d ./packages /p ./dist/MyApp.msixbundle
```

---

## Installation and Deployment

### Sideloading

1. Enable Developer Mode or sideloading in Windows Settings
2. Install the certificate to Trusted People
3. Double-click the MSIX package
4. Click Install

### PowerShell Installation

```powershell
# Install for current user
Add-AppPackage -Path .\MyApp.msix

# Install for all users (requires elevation)
Add-AppPackage -Path .\MyApp.msix -ForceApplicationShutdown

# Update existing installation
Add-AppPackage -Path .\MyApp.msix -Update
```

### App Installer

Create an `.appinstaller` file for auto-updates:

```xml
<?xml version="1.0" encoding="utf-8"?>
<AppInstaller
  Uri="https://myserver.com/MyApp.appinstaller"
  Version="1.0.0.0"
  xmlns="http://schemas.microsoft.com/appx/appinstaller/2018">
  
  <MainPackage
    Name="MyCompany.MyApp"
    Version="1.0.0.0"
    Publisher="CN=MyCompany"
    Uri="https://myserver.com/MyApp.msix"
    ProcessorArchitecture="x64" />
    
  <UpdateSettings>
    <OnLaunch HoursBetweenUpdateChecks="0" />
  </UpdateSettings>
</AppInstaller>
```

### Microsoft Store

For Store distribution:

1. Create a partner account
2. Reserve your app name
3. Associate your project with the Store app
4. Submit your package for certification

---

## Troubleshooting

### Package Installation Fails

**Error:** "This app package's publisher certificate could not be verified"

**Solution:** Install the signing certificate to Trusted People store

---

**Error:** "Windows cannot install package because this package depends on a framework"

**Solution:** Install the required dependencies:

```powershell
# Install Windows App SDK runtime
Add-AppPackage -Path Microsoft.WindowsAppRuntime.xxx.msix
```

---

**Error:** "Package was not found"

**Solution:** Check the package identity in the manifest matches your certificate

---

### Signing Fails

**Error:** "SignTool Error: No certificates were found"

**Solution:**

1. Verify the certificate path
2. Check the password is correct
3. Ensure the certificate is not expired

---

### App Doesn't Start After Install

**Solutions:**

1. Check Windows Event Viewer for errors
2. Verify all dependencies are included
3. Check the entry point in the manifest
4. Ensure the executable name matches

---

## Best Practices

### Version Numbering

Use semantic versioning: `Major.Minor.Build.Revision`

```xml
<Identity Version="1.2.3.0" ... />
```

### Asset Requirements

Provide all required logo sizes:

- Square44x44Logo
- Square150x150Logo
- Wide310x150Logo
- SplashScreen
- StoreLogo

### Testing

1. Test installation on a clean machine
2. Test updates from previous versions
3. Verify all features work in the packaged app
4. Test uninstallation is clean

---

## Resources

- [MSIX Documentation](https://learn.microsoft.com/windows/msix/)
- [App Installer Documentation](https://learn.microsoft.com/windows/msix/app-installer/)
- [Package Signing](https://learn.microsoft.com/windows/msix/package/sign-app-package-using-signtool)
- [Microsoft Store Submission](https://learn.microsoft.com/windows/apps/publish/)
