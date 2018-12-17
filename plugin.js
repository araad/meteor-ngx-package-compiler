import { execSync } from 'child_process';
import fs from 'fs';
import ngPackagr from 'ng-packagr';
import path from 'path';
import diff from 'shallow-diff';
import ts from 'typescript';
import _ from 'underscore';

const ngPackage = 'ng-package.json';
const tsConfigLib = 'tsconfig.lib.json';
const tsConfigPkg = 'tsconfig.pkg.json';
const optsKey = 'meteorNgCompilerOptions';
const defaultCompilerOptions = {
  verbose: false
};
let compilerOptions = defaultCompilerOptions;

Plugin.registerCompiler(
  {
    extensions: ['ts', 'html', 'scss', 'json']
  },
  () => new MeteorNgxPackageCompiler()
);

class MeteorNgxPackageCompiler {
  constructor() {
    this.cacheDir = '';
  }

  setCompilerOptions(files) {
    compilerOptions = defaultCompilerOptions;
    let config = files.find(f => f.getBasename() === tsConfigPkg);
    if (config) {
      tsConfig = JSON.parse(config.getContentsAsString());
      let opts = tsConfig[optsKey];
      if (opts) {
        for (const key in compilerOptions) {
          if (opts.hasOwnProperty(key)) {
            compilerOptions[key] = opts[key];
          }
        }
      }
    }
  }

  async processFilesForTarget(files) {
    this.setCompilerOptions(files);

    let ngConfigs = files.filter(
      f => f.getBasename() === tsConfigLib || f.getBasename() === tsConfigPkg
    );
    let meteorNgPkgs = _.uniq(ngConfigs, false, f => f.getPackageName()).map(
      f =>
        f.getPackageName().indexOf(':') >= 0
          ? f.getPackageName().replace(':', '-')
          : f.getPackageName()
    );

    meteorNgPkgs.forEach(packageName => {
      logVerbose('processing files for', packageName);
      logVerbose('processing common');
      await this.processCommon(packageName, files);
      logVerbose('processing server');
      await this.processServer(packageName, files);
      logVerbose('processing client');
      await this.processClient(packageName, files);
      logVerbose('pkg process done');
    });

    logVerbose('done');
  }

  async processClient(packageName, files) {
    const pkgJsonPath = path.join(
      'packages',
      packageName,
      'client',
      'package.json'
    );
    if (fs.existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath));
      const pkgNameParts = pkgJson.name.split('/');
      const libDir = path.join('.', 'dist', packageName);
      const modDir = path.join('.', 'node_modules', ...pkgNameParts);
      const tsCfgPath = path.join(
        'packages',
        packageName,
        'client',
        tsConfigLib
      );
      const ngPkgPath = path.join('packages', packageName, 'client', ngPackage);
      let hasChanges = false;

      let clientFiles = files.filter(
        f =>
          (f.getPackageName().indexOf(':') >= 0
            ? f.getPackageName().replace(':', '-')
            : f.getPackageName()) === packageName &&
          f.getArch().startsWith('web') &&
          f.getPathInPackage().startsWith('client/')
      );

      logVerbose(`Checking ${packageName} (web.browser)...`);

      if (clientFiles.length > 0) {
        hasChanges = this.hasChanges(`${packageName}.client`, clientFiles);
      }

      if (hasChanges || !fs.existsSync(libDir) || !fs.existsSync(modDir)) {
        log(`Building angular library from ${packageName} (web.browser)...`);
        await this.buildClient(tsCfgPath, ngPkgPath, libDir, modDir);
      }
    }
  }

  async buildClient(tsConfigPath, ngPackagePath, libDir, modDir) {
    await ngPackagr.build({
      project: path.join('.', ngPackagePath),
      config: path.join('.', tsConfigPath)
    });

    try {
      if (!fs.existsSync(modDir)) {
        logVerbose('creating link in node_modules...');
        execSync(`npm install -s ${path.resolve(libDir)}`, {
          stdio: 'inherit'
        });
      }
    } catch (e) {
      logVerbose(e);
    }
  }

  async processServer(packageName, files) {
    let serverFiles = files.filter(
      f =>
        (f.getPackageName().indexOf(':') >= 0
          ? f.getPackageName().replace(':', '-')
          : f.getPackageName()) === packageName &&
        !f.getArch().startsWith('web') &&
        f.getPathInPackage().startsWith('server/')
    );

    if (serverFiles.length > 0) {
      logVerbose(`Checking ${packageName} (${serverFiles[0].getArch()})...`);

      let tsCfgFile = files.find(
        f =>
          (f.getPackageName().indexOf(':') >= 0
            ? f.getPackageName().replace(':', '-')
            : f.getPackageName()) === packageName &&
          f.getBasename() === tsConfigPkg
      );

      log(
        `Compiling files from ${packageName} (${serverFiles[0].getArch()})...`
      );
      this.compilerServerFiles(serverFiles, tsCfgFile);
    }
  }

  compilerServerFiles(files, tsConfigFile) {
    let tsConfig = JSON.parse(tsConfigFile.getContentsAsString());

    files.forEach(file => {
      let result = ts.transpileModule(file.getContentsAsString(), tsConfig);
      let data = result.outputText;
      if (tsConfig.compilerOptions.module === 'es2015') {
        data = Babel.compile(data).code;
      }
      let sourcePath = file.getPathInPackage();
      let path = sourcePath.replace('.ts', '.js');

      let sourceMap = JSON.parse(result.sourceMapText);
      sourceMap.sources = [file.getDisplayPath()];

      file.addJavaScript({
        data,
        sourceMap,
        sourcePath,
        path,
        hash: file.getSourceHash()
      });
    });
  }

  async processCommon(packageName, files) {
    let hasChanges = false;

    let commonFiles = files.filter(
      f =>
        (f.getPackageName().indexOf(':') >= 0
          ? f.getPackageName().replace(':', '-')
          : f.getPackageName()) === packageName &&
        f.getPathInPackage().startsWith('common/')
    );

    logVerbose(`Checking ${packageName} (common)...`);
    logVerbose(commonFiles.length);

    if (commonFiles.length > 0) {
      hasChanges = this.hasChanges(`${packageName}.common`, commonFiles);
    }

    const pkgJsonPath = path.join(
      'packages',
      packageName,
      'common',
      'package.json'
    );
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath));
    const pkgNameParts = pkgJson.name.split('/');
    const libDir = path.join('.', 'dist', packageName);
    const modDir = path.join('.', 'node_modules', ...pkgNameParts);
    logVerbose('*******', modDir, '*********');

    if (hasChanges || !fs.existsSync(libDir) || !fs.existsSync(modDir)) {
      log(`Building files from ${packageName} (common)...`);
      await this.buildCommon(packageName, libDir, modDir, pkgJson.name);
    }
  }

  async buildCommon(packageName, libDir, modDir, pkgJsonName) {
    execSync(
      `tsc -p ${path.join(
        'packages',
        packageName,
        'common',
        tsConfigLib
      )} --outDir ${path.join(path.resolve(libDir), 'common')} -d`
    );

    fs.copyFileSync(
      path.join('packages', packageName, 'common', 'package.json'),
      path.join(libDir, 'common', 'package.json')
    );

    if (!fs.existsSync(path.join(libDir, 'package.json'))) {
      fs.writeFileSync(
        path.join(libDir, 'package.json'),
        JSON.stringify({
          name: pkgJsonName.replace('/common', ''),
          version: '0.0.1'
        })
      );
    }

    try {
      if (!fs.existsSync(modDir)) {
        logVerbose('installing in node_modules...');

        execSync(`npm install -s ${path.join(path.resolve(libDir))}`, {
          stdio: 'inherit'
        });
      }
    } catch (e) {
      logVerbose(e);
    }
  }

  setDiskCacheDirectory(dir) {
    this.cacheDir = dir;
  }

  hasChanges(packageName, files) {
    logVerbose('comparing for:', packageName);
    let hashPath = path.join(this.cacheDir, `${packageName}.json`);
    logVerbose('hashpath:', hashPath);
    if (fs.existsSync(hashPath)) {
      logVerbose('hashpath exists');

      let hashObj = JSON.parse(fs.readFileSync(hashPath));
      let newHashObj = {};

      files.forEach(file => {
        newHashObj[file.getDisplayPath()] = file.getSourceHash();
      });

      logVerbose('checking if length changed...');

      if (Object.getOwnPropertyNames(hashObj).length === files.length) {
        logVerbose('no change in length');

        logVerbose('checking for diff between hash objects...');
        let diffHash = diff(hashObj, newHashObj);
        logVerbose(
          'updated:',
          diffHash.updated.length,
          '\tunchanged:',
          diffHash.unchanged.length,
          '\tadded:',
          diffHash.added.length,
          '\tdeleted:',
          diffHash.deleted.length
        );

        fs.writeFileSync(hashPath, JSON.stringify(newHashObj));

        return diffHash.unchanged.length !== files.length;
      }

      fs.writeFileSync(hashPath, JSON.stringify(newHashObj));
    } else {
      logVerbose('hashpath does not exist');
      let hashObj = {};
      files.forEach(file => {
        hashObj[file.getDisplayPath()] = file.getSourceHash();
      });

      logVerbose('creating new hash object on disk...');
      fs.writeFileSync(hashPath, JSON.stringify(hashObj));
    }

    return true;
  }
}

function log(...args) {
  console.log('[meteor-ng-package-compiler]:', ...args);
}

function logVerbose(...args) {
  if (compilerOptions.verbose) {
    log(...args);
  }
}
