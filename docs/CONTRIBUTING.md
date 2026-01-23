# Contributing to WinDev Helper

Thank you for your interest in contributing to WinDev Helper! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- Node.js 18 or later
- Visual Studio Code 1.108.1 or later
- Git

### Setting Up the Development Environment

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/windev-helper.git
   cd windev-helper
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Open in VS Code**

   ```bash
   code .
   ```

4. **Build the extension**

   ```bash
   npm run compile
   ```

### Running the Extension

1. Press `F5` to launch the Extension Development Host
2. A new VS Code window opens with the extension loaded
3. Test your changes in this window

### Running Tests

```bash
npm test
```

---

## Project Structure

```
windev-helper/
├── src/
│   ├── extension.ts          # Extension entry point
│   ├── winAppCli.ts          # WinApp CLI wrapper
│   ├── projectManager.ts     # Project detection and management
│   ├── buildManager.ts       # Build operations
│   ├── packageManager.ts     # MSIX packaging
│   ├── templateManager.ts    # Project/item templates
│   ├── statusBarManager.ts   # Status bar items
│   ├── debugConfigurationProvider.ts  # Debug configuration
│   └── test/
│       └── extension.test.ts # Tests
├── docs/                     # Documentation
├── images/                   # Extension icons
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── README.md                 # Main readme
```

---

## Making Changes

### Branching Strategy

- `main` - Stable release branch
- `develop` - Development branch
- `feature/*` - Feature branches
- `bugfix/*` - Bug fix branches

### Creating a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-new-feature
```

### Commit Messages

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(templates): add support for WinUI library templates

fix(debug): resolve breakpoint binding issue on ARM64

docs(readme): update installation instructions
```

---

## Coding Guidelines

### TypeScript Style

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use async/await over callbacks
- Add JSDoc comments for public APIs
- Follow existing code style

### Example

```typescript
/**
 * Creates a new WinUI project.
 * @param name - The project name
 * @param options - Creation options
 * @returns The path to the created project
 */
public async createProject(
    name: string, 
    options: ProjectOptions
): Promise<string> {
    // Implementation
}
```

### ESLint

Run linting before committing:

```bash
npm run lint
```

Fix auto-fixable issues:

```bash
npm run lint -- --fix
```

---

## Testing

### Writing Tests

Add tests in `src/test/`:

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test('Sample test', async () => {
        const result = await someFunction();
        assert.strictEqual(result, expectedValue);
    });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

---

## Documentation

### Updating Documentation

- Keep README.md up to date
- Update relevant docs in the `docs/` folder
- Add JSDoc comments to new public APIs
- Include examples where helpful

### Adding New Documentation

1. Create the markdown file in `docs/`
2. Add a link in `docs/README.md`
3. Follow the existing documentation style

---

## Pull Requests

### Before Submitting

1. Ensure all tests pass
2. Run linting
3. Update documentation if needed
4. Add yourself to CONTRIBUTORS if not already listed

### Creating a Pull Request

1. Push your branch to your fork
2. Open a PR against the `develop` branch
3. Fill out the PR template
4. Link any related issues

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing

Describe how you tested the changes

## Checklist

- [ ] Tests pass
- [ ] Linting passes
- [ ] Documentation updated
- [ ] Commit messages follow convention
```

---

## Issue Reporting

### Bug Reports

Include:

- VS Code version
- Extension version
- Operating system
- Steps to reproduce
- Expected behavior
- Actual behavior
- Error messages/logs

### Feature Requests

Include:

- Use case description
- Proposed solution
- Alternative solutions considered
- Additional context

---

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a release PR to `main`
4. After merge, tag the release
5. Publish to VS Code Marketplace

---

## Getting Help

- Open a discussion on GitHub
- Check existing issues
- Review the documentation

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to WinDev Helper! 🎉
