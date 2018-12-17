Package.describe({
  name: 'araad:meteor-ngx-package-compiler',
  version: '0.0.5',
  summary: 'Compiles meteor packages that contain Typescript on server and Angular library on client',
  documentation: "README.md"
});

Package.registerBuildPlugin({
  name: 'meteor-ngx-compiler-plugin',
  sources: ['plugin.js'],
  use: ['ecmascript@0.10.9', 'babel-compiler@7.0.0'],
  npmDependencies: {
    'shallow-diff': '0.0.5'
  }
});

Package.onUse(function(api) {
  api.versionsFrom('1.6.1');

  api.use(['isobuild:compiler-plugin@1.0.0']);
});
