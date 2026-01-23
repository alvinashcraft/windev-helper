# WinDev Helper - VS Code Extension

This is a VS Code extension for WinUI 3 development using the Windows App SDK.

## Project Overview

- **Type:** VS Code Extension (TypeScript)
- **Target:** WinUI 3 / Windows App SDK developers
- **Dependencies:** C# Dev Kit, .NET SDK, Windows App Development CLI (winapp)

## Development

### Building

```bash
npm run compile
```

### Watching for Changes

```bash
npm run watch
```

### Testing

Press F5 to launch the Extension Development Host.

### Packaging

```bash
npm run package
```

## Key Files

- `src/extension.ts` - Extension entry point
- `src/winAppCli.ts` - Windows App Development CLI wrapper
- `src/projectManager.ts` - WinUI project detection
- `src/buildManager.ts` - Build operations
- `src/packageManager.ts` - MSIX packaging
- `src/templateManager.ts` - Project/item templates
- `package.json` - Extension manifest

## Coding Guidelines

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Run `npm run lint` before committing

### Communication Style

- Use a familiar but professional tone
- Avoid overly-agreeable statements like "You're absolutely right" or "Great idea"
- Be direct and helpful without being overly enthusiastic
- Focus on practical solutions and clear explanations

### Version and Publishing Control

- **Never update version**: Do not modify the version number in `package.json` unless explicitly requested
- **Never auto-publish**: Do not publish to the VS Code Marketplace automatically or suggest doing so without explicit user request
- **Package updates**: Only check for npm package updates after the project's version number in `package.json` has been explicitly updated

## Commands

All commands are prefixed with `windev-helper.` and categorized under "WinUI" in the command palette.

## External Resources

- [Windows App SDK](https://learn.microsoft.com/windows/apps/windows-app-sdk/)
- [WinUI 3](https://learn.microsoft.com/windows/apps/winui/winui3/)
- [VS Code Extension API](https://code.visualstudio.com/api)
