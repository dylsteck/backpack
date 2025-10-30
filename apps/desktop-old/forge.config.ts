import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'Cortex',
    executableName: 'cortex',
    appBundleId: 'com.cortex.desktop',
    appCategoryType: 'public.app-category.productivity',
    // Icon paths (add your icons to these locations)
    // icon: './assets/icon', // will automatically append .icns, .ico, .png
  },
  rebuildConfig: {},
  makers: [
    // Windows installer
    new MakerSquirrel({
      name: 'cortex',
      authors: 'Cortex',
      description: 'Cortex Desktop Application',
    }),
    // macOS dmg
    new MakerZIP({}, ['darwin']),
    // Linux packages
    new MakerRpm({
      options: {
        name: 'cortex',
        productName: 'Cortex',
        genericName: 'Cortex Desktop',
        categories: ['Utility'],
      },
    }),
    new MakerDeb({
      options: {
        name: 'cortex',
        productName: 'Cortex',
        genericName: 'Cortex Desktop',
        categories: ['Utility'],
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data: http://localhost:* ws://localhost:*; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:;",
      port: 3003, // Port for webpack dev server
      loggerPort: 9001, // Logger port
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
            },
          },
        ],
        nodeIntegration: false,
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
