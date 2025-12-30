import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--watch');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy static assets
function copyAssets() {
  const assetsDir = path.join(__dirname, 'src/assets');
  const distAssetsDir = path.join(distDir, 'assets');
  
  if (!fs.existsSync(distAssetsDir)) {
    fs.mkdirSync(distAssetsDir, { recursive: true });
  }
  
  // Copy fonts directory
  const fontsDir = path.join(assetsDir, 'fonts');
  const distFontsDir = path.join(distAssetsDir, 'fonts');
  if (fs.existsSync(fontsDir)) {
    fs.cpSync(fontsDir, distFontsDir, { recursive: true });
  }
  
  // Copy images directory
  const imagesDir = path.join(assetsDir, 'images');
  const distImagesDir = path.join(distAssetsDir, 'images');
  if (fs.existsSync(imagesDir)) {
    fs.cpSync(imagesDir, distImagesDir, { recursive: true });
  }
}

// Build renderer
const buildOptions = {
  entryPoints: [path.join(__dirname, 'src/renderer/index.ts')],
  bundle: true,
  platform: 'browser',
  target: ['chrome120'],
  outfile: path.join(distDir, 'renderer.js'),
  sourcemap: isDev,
  minify: !isDev,
  treeShaking: true,
  format: 'esm',
  loader: {
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.svg': 'dataurl',
    '.ttf': 'file',
    '.woff': 'file',
    '.woff2': 'file',
  },
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  external: [],
};

async function build() {
  try {
    copyAssets();
    
    if (isDev) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();

