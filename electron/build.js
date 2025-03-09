const esbuild = require('esbuild');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
console.log('Building in', isDev ? 'development' : 'production', 'mode');

// Common config for all builds
const commonConfig = {
  bundle: true,
  minify: !isDev,
  sourcemap: isDev,
  target: 'es2020',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
};

// Resolve path to the main app services
const mainAppServicesPath = path.resolve(__dirname, '../src/services');
console.log('Main app services path:', mainAppServicesPath);

async function build() {
  try {
    // Ensure clean build
    console.log('Starting build process...');

    // Build main process
    console.log('Building main process...');
    await esbuild.build({
      ...commonConfig,
      platform: 'node',
      entryPoints: ['src/main/main.ts'],
      external: ['electron', 'electron-store'],
      outfile: 'dist/main/main.js',
      plugins: [{
        name: 'resolve-services',
        setup(build) {
          build.onResolve({ filter: /^\.\.\/\.\.\/src\/services/ }, args => {
            const relativePath = args.path.replace('../../src/services', '');
            return {
              path: path.join(mainAppServicesPath, relativePath)
            };
          });
        },
      }],
    });

    // Build preload script
    console.log('Building preload script...');
    await esbuild.build({
      ...commonConfig,
      platform: 'node',
      entryPoints: ['src/preload/preload.ts'],
      external: ['electron'],
      outfile: 'dist/preload/preload.js',
    });

    // Build renderer process
    console.log('Building renderer process...');
    await esbuild.build({
      ...commonConfig,
      platform: 'browser',
      entryPoints: ['src/renderer/index.tsx'],
      outfile: 'dist/renderer/index.js',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
      },
      inject: ['src/renderer/emotion-shim.ts'],
      plugins: [{
        name: 'resolve-deps',
        setup(build) {
          // Handle React and ReactDOM
          build.onResolve({ filter: /^react(-dom)?$/ }, args => {
            const pkg = args.path === 'react' ? 'react' : 'react-dom';
            return { path: require.resolve(pkg) };
          });

          // Handle @emotion packages
          build.onResolve({ filter: /@emotion\/(react|css|cache|sheet|styled|utils)/ }, args => {
            return { path: require.resolve(args.path) };
          });
        },
      }],
      define: {
        ...commonConfig.define,
        'process.env.IS_ELECTRON': 'true',
        'global': 'window',
      },
      // Ensure proper emotion support
      jsxFactory: 'jsx',
      jsxFragment: 'Fragment',
      banner: {
        js: `
          window.process = window.process || {};
          window.process.env = window.process.env || {};
          window.process.env.NODE_ENV = '${process.env.NODE_ENV || 'production'}';
        `,
      },
    });

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
