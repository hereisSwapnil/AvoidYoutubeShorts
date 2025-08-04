#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const archiver = require('archiver');
const chalk = require('chalk');

class ExtensionBuilder {
    constructor() {
        this.sourceDir = '.';
        this.buildDir = 'dist';
        this.devBuildDir = 'dist-dev';
        this.prodBuildDir = 'dist-prod';
        this.args = process.argv.slice(2);
        this.isDev = this.args.includes('--dev');
        this.isProd = this.args.includes('--prod');
        this.isClean = this.args.includes('--clean');
        this.isValidate = this.args.includes('--validate');
    }

    async run() {
        try {
            console.log(chalk.blue('🚀 Avoid YT Shorts - Extension Builder'));
            console.log(chalk.gray('=====================================\n'));

            if (this.isClean) {
                await this.clean();
                return;
            }

            if (this.isValidate) {
                await this.validate();
                return;
            }

            await this.build();
        } catch (error) {
            console.error(chalk.red('❌ Build failed:'), error.message);
            process.exit(1);
        }
    }

    async clean() {
        console.log(chalk.yellow('🧹 Cleaning build directories...'));
        
        const dirsToClean = [this.buildDir, this.devBuildDir, this.prodBuildDir];
        for (const dir of dirsToClean) {
            if (await fs.pathExists(dir)) {
                await fs.remove(dir);
                console.log(chalk.gray(`  Removed ${dir}/`));
            }
        }
        
        console.log(chalk.green('✅ Clean completed!\n'));
    }

    async validate() {
        console.log(chalk.yellow('🔍 Validating extension files...'));
        
        const requiredFiles = [
            'manifest.json',
            'content.js',
            'script.css',
            'popup.html',
            'popup.js',
            'background.js',
            'options.html',
            'options.js'
        ];

        const missingFiles = [];
        for (const file of requiredFiles) {
            if (!await fs.pathExists(file)) {
                missingFiles.push(file);
            }
        }

        if (missingFiles.length > 0) {
            throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }

        // Validate manifest.json
        try {
            const manifest = await fs.readJson('manifest.json');
            const requiredManifestFields = ['manifest_version', 'name', 'version', 'description'];
            
            for (const field of requiredManifestFields) {
                if (!manifest[field]) {
                    throw new Error(`Missing required manifest field: ${field}`);
                }
            }
            
            console.log(chalk.green('✅ Manifest validation passed'));
        } catch (error) {
            throw new Error(`Manifest validation failed: ${error.message}`);
        }

        console.log(chalk.green('✅ All files validated successfully!\n'));
    }

    async build() {
        const targetDir = this.isProd ? this.prodBuildDir : (this.isDev ? this.devBuildDir : this.buildDir);
        
        console.log(chalk.yellow(`🏗️  Building extension to ${targetDir}/...`));
        
        // Clean target directory
        if (await fs.pathExists(targetDir)) {
            await fs.remove(targetDir);
        }
        await fs.ensureDir(targetDir);

        // Copy and process files
        await this.copyFiles(targetDir);
        await this.minifyFiles(targetDir);
        await this.createZip(targetDir);
        
        console.log(chalk.green(`✅ Build completed! Extension ready in ${targetDir}/\n`));
        
        // Show build info
        await this.showBuildInfo(targetDir);
    }

    async copyFiles(targetDir) {
        console.log(chalk.gray('  📁 Copying files...'));
        
        const filesToCopy = [
            'manifest.json',
            'popup.html',
            'options.html',
            'package.json'
        ];

        for (const file of filesToCopy) {
            if (await fs.pathExists(file)) {
                await fs.copy(file, path.join(targetDir, file));
                console.log(chalk.gray(`    Copied ${file}`));
            }
        }

        // Copy icons directory if it exists
        if (await fs.pathExists('icons')) {
            await fs.copy('icons', path.join(targetDir, 'icons'));
            console.log(chalk.gray('    Copied icons/'));
        }
    }

    async minifyFiles(targetDir) {
        console.log(chalk.gray('  🔧 Minifying files...'));

        // Minify JavaScript files
        const jsFiles = [
            { src: 'content.js', dest: 'content.js' },
            { src: 'popup.js', dest: 'popup.js' },
            { src: 'background.js', dest: 'background.js' },
            { src: 'options.js', dest: 'options.js' }
        ];

        for (const file of jsFiles) {
            if (await fs.pathExists(file.src)) {
                const code = await fs.readFile(file.src, 'utf8');
                const minified = await minify(code, {
                    compress: this.isProd,
                    mangle: this.isProd,
                    format: {
                        comments: false
                    }
                });
                
                await fs.writeFile(path.join(targetDir, file.dest), minified.code);
                console.log(chalk.gray(`    Minified ${file.src}`));
            }
        }

        // Minify CSS file
        if (await fs.pathExists('script.css')) {
            const css = await fs.readFile('script.css', 'utf8');
            const minified = new CleanCSS({
                level: this.isProd ? 2 : 1,
                format: 'keep-breaks'
            }).minify(css);
            
            await fs.writeFile(path.join(targetDir, 'script.css'), minified.styles);
            console.log(chalk.gray('    Minified script.css'));
        }
    }

    async createZip(targetDir) {
        if (!this.isProd) return; // Only create zip for production builds
        
        console.log(chalk.gray('  📦 Creating distribution zip...'));
        
        const zipPath = path.join(targetDir, 'avoid-yt-shorts-enhanced.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
            output.on('close', () => {
                console.log(chalk.gray(`    Created ${zipPath} (${archive.pointer()} bytes)`));
                resolve();
            });

            archive.on('error', reject);
            archive.pipe(output);
            archive.directory(targetDir, false);
            archive.finalize();
        });
    }

    async showBuildInfo(targetDir) {
        const manifest = await fs.readJson('manifest.json');
        const stats = await fs.stat(targetDir);
        
        console.log(chalk.cyan('📋 Build Information:'));
        console.log(chalk.gray(`  Extension: ${manifest.name}`));
        console.log(chalk.gray(`  Version: ${manifest.version}`));
        console.log(chalk.gray(`  Build Type: ${this.isProd ? 'Production' : (this.isDev ? 'Development' : 'Standard')}`));
        console.log(chalk.gray(`  Output Directory: ${targetDir}/`));
        console.log(chalk.gray(`  Build Size: ${(stats.size / 1024).toFixed(2)} KB`));
        
        if (this.isProd) {
            console.log(chalk.gray(`  Distribution: ${targetDir}/avoid-yt-shorts-enhanced.zip`));
        }
        
        console.log(chalk.gray('\n📝 Next Steps:'));
        console.log(chalk.gray('  1. Load the extension in Chrome:'));
        console.log(chalk.white(`     chrome://extensions/ → Load unpacked → ${path.resolve(targetDir)}`));
        console.log(chalk.gray('  2. Test the extension on YouTube'));
        console.log(chalk.gray('  3. For production, use the zip file for distribution\n'));
    }
}

// Run the builder
const builder = new ExtensionBuilder();
builder.run().catch(error => {
    console.error(chalk.red('❌ Build failed:'), error);
    process.exit(1);
}); 