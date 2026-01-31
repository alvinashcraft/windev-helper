// WinDev Helper - Project Context Provider
// Copyright (c) WinDev Helper Contributors. All rights reserved.
// Licensed under the MIT License.

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Resource dictionary reference from App.xaml
 */
export interface ResourceDictionary {
    /** Source path (relative to project) */
    source: string;
    /** Resolved absolute path */
    absolutePath: string;
    /** XAML content of the dictionary */
    content: string;
}

/**
 * Project context for XAML preview rendering
 */
export interface ProjectContext {
    /** Path to the project directory */
    projectPath: string;
    /** Path to App.xaml */
    appXamlPath?: string;
    /** App.xaml content (preprocessed) */
    appXamlContent?: string;
    /** Resource dictionaries referenced in App.xaml */
    resourceDictionaries: ResourceDictionary[];
    /** Theme setting from App.xaml (if detected) */
    requestedTheme?: 'Light' | 'Dark' | 'Default';
}

/**
 * Provides project context for XAML preview rendering
 */
export class ProjectContextProvider {
    private cache: Map<string, { context: ProjectContext; timestamp: number }> = new Map();
    private readonly cacheMaxAge = 30000; // 30 seconds
    private fileWatchers: vscode.FileSystemWatcher[] = [];

    /**
     * Get project context for a XAML file
     * @param xamlFilePath Path to the XAML file being previewed
     */
    public async getContext(xamlFilePath: string): Promise<ProjectContext | null> {
        const projectPath = await this.findProjectRoot(xamlFilePath);
        if (!projectPath) {
            return null;
        }

        // Check cache
        const cacheKey = projectPath;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
            return cached.context;
        }

        // Build context
        const context = await this.buildContext(projectPath);
        
        // Cache it
        this.cache.set(cacheKey, {
            context,
            timestamp: Date.now()
        });

        return context;
    }

    /**
     * Find the project root directory by looking for .csproj
     */
    private async findProjectRoot(xamlFilePath: string): Promise<string | null> {
        let dir = path.dirname(xamlFilePath);
        const root = path.parse(dir).root;

        while (dir !== root) {
            try {
                const files = await fs.promises.readdir(dir);
                const csproj = files.find(f => f.endsWith('.csproj'));
                if (csproj) {
                    return dir;
                }
            } catch {
                // Directory not readable, continue up
            }
            dir = path.dirname(dir);
        }

        return null;
    }

    /**
     * Build project context
     */
    private async buildContext(projectPath: string): Promise<ProjectContext> {
        const context: ProjectContext = {
            projectPath,
            resourceDictionaries: []
        };

        // Look for App.xaml
        const appXamlPath = path.join(projectPath, 'App.xaml');
        if (await this.fileExists(appXamlPath)) {
            context.appXamlPath = appXamlPath;
            const appXamlContent = await fs.promises.readFile(appXamlPath, 'utf-8');
            context.appXamlContent = this.preprocessAppXaml(appXamlContent);
            context.requestedTheme = this.extractRequestedTheme(appXamlContent);

            // Extract and load resource dictionaries
            const resourceSources = this.extractResourceDictionarySources(appXamlContent);
            for (const source of resourceSources) {
                const dict = await this.loadResourceDictionary(projectPath, source);
                if (dict) {
                    context.resourceDictionaries.push(dict);
                }
            }
        }

        return context;
    }

    /**
     * Check if a file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Preprocess App.xaml for dynamic loading
     * Removes code-behind references and other compile-time attributes
     */
    private preprocessAppXaml(xaml: string): string {
        let result = xaml;

        // Remove x:Class attribute
        result = result.replace(/\s+x:Class\s*=\s*"[^"]*"/gi, '');

        // Remove mc:Ignorable and related namespaces
        result = result.replace(/\s+mc:Ignorable\s*=\s*"[^"]*"/gi, '');
        result = result.replace(/\s+xmlns:d\s*=\s*"[^"]*"/gi, '');
        result = result.replace(/\s+xmlns:mc\s*=\s*"[^"]*"/gi, '');

        // Remove d: prefixed attributes
        result = result.replace(/\s+d:\w+\s*=\s*"[^"]*"/gi, '');

        return result;
    }

    /**
     * Extract RequestedTheme from App.xaml
     */
    private extractRequestedTheme(xaml: string): 'Light' | 'Dark' | 'Default' | undefined {
        const match = xaml.match(/RequestedTheme\s*=\s*"(\w+)"/i);
        if (match) {
            const theme = match[1];
            if (theme === 'Light' || theme === 'Dark' || theme === 'Default') {
                return theme;
            }
        }
        return undefined;
    }

    /**
     * Extract ResourceDictionary Source paths from App.xaml
     */
    private extractResourceDictionarySources(xaml: string): string[] {
        const sources: string[] = [];

        // Match <ResourceDictionary Source="..." />
        const regex = /<ResourceDictionary\s+Source\s*=\s*"([^"]+)"\s*\/>/gi;
        let match;
        while ((match = regex.exec(xaml)) !== null) {
            sources.push(match[1]);
        }

        // Also match <ResourceDictionary Source="..."> with possible children
        const regex2 = /<ResourceDictionary\s+Source\s*=\s*"([^"]+)"/gi;
        while ((match = regex2.exec(xaml)) !== null) {
            if (!sources.includes(match[1])) {
                sources.push(match[1]);
            }
        }

        return sources;
    }

    /**
     * Load a resource dictionary file
     */
    private async loadResourceDictionary(
        projectPath: string, 
        source: string
    ): Promise<ResourceDictionary | null> {
        try {
            // Handle ms-appx:/// paths
            let relativePath = source;
            if (source.startsWith('ms-appx:///')) {
                relativePath = source.replace('ms-appx:///', '');
            }

            // Handle pack URIs and other formats
            if (relativePath.includes(';component/')) {
                // WPF-style pack URI - extract the path part
                const componentMatch = relativePath.match(/;component\/(.+)/);
                if (componentMatch) {
                    relativePath = componentMatch[1];
                }
            }

            // Skip external resources (HTTP, etc.)
            if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
                console.log(`[ProjectContext] Skipping external resource: ${source}`);
                return null;
            }

            // Resolve the path
            const absolutePath = path.join(projectPath, relativePath);

            // Read the file
            if (!await this.fileExists(absolutePath)) {
                console.log(`[ProjectContext] Resource dictionary not found: ${absolutePath}`);
                return null;
            }

            const content = await fs.promises.readFile(absolutePath, 'utf-8');

            // Preprocess to remove compile-time attributes
            const processedContent = this.preprocessResourceDictionary(content);

            return {
                source,
                absolutePath,
                content: processedContent
            };
        } catch (err) {
            console.error(`[ProjectContext] Failed to load resource dictionary ${source}:`, err);
            return null;
        }
    }

    /**
     * Preprocess a resource dictionary for dynamic loading
     */
    private preprocessResourceDictionary(xaml: string): string {
        let result = xaml;

        // Remove x:Class attribute if present
        result = result.replace(/\s+x:Class\s*=\s*"[^"]*"/gi, '');

        // Remove mc:Ignorable and design-time namespaces
        result = result.replace(/\s+mc:Ignorable\s*=\s*"[^"]*"/gi, '');
        result = result.replace(/\s+xmlns:d\s*=\s*"[^"]*"/gi, '');
        result = result.replace(/\s+xmlns:mc\s*=\s*"[^"]*"/gi, '');
        result = result.replace(/\s+d:\w+\s*=\s*"[^"]*"/gi, '');

        return result;
    }

    /**
     * Invalidate cache for a project
     */
    public invalidateCache(projectPath?: string): void {
        if (projectPath) {
            this.cache.delete(projectPath);
        } else {
            this.cache.clear();
        }
    }

    /**
     * Set up file watchers to invalidate cache on changes
     */
    public setupWatchers(): void {
        // Watch for App.xaml changes
        const appXamlWatcher = vscode.workspace.createFileSystemWatcher('**/App.xaml');
        appXamlWatcher.onDidChange(uri => {
            const projectPath = path.dirname(uri.fsPath);
            this.invalidateCache(projectPath);
        });
        this.fileWatchers.push(appXamlWatcher);

        // Watch for resource dictionary changes
        const dictWatcher = vscode.workspace.createFileSystemWatcher('**/*.xaml');
        dictWatcher.onDidChange(() => {
            // Invalidate all cache since we don't know which project it affects
            this.invalidateCache();
        });
        this.fileWatchers.push(dictWatcher);
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        for (const watcher of this.fileWatchers) {
            watcher.dispose();
        }
        this.fileWatchers = [];
        this.cache.clear();
    }
}
