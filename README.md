# meteor-ngx-package-compiler
This package defines a meteor build plugin which is intended to be used in meteor packages that contain an Angular library and implements the Angular Package Format [(APF)](https://docs.google.com/document/d/1CZC2rcpxffTDfRDs6p1cfbmKNLA6x5O-NtkJglDaBVs/preview)

It uses ng-pacakgr to compile the angular library and then installs it in node_modules. For the server files, it will read the tsconfig.server.json and pass that to the tsc compiler which will bundle the files as part of the meteor package.

## Installation

Include it in the ```api.use``` statement inside the package.js file of the package containing the angular library:
```
api.use('araad:meteor-ngx-package-compiler');
```

**NOTE**

Do not include this package as a direct dependency of your meteor app. This package is intended to work only as a dependency of a meteor package.

## Usage


Start with the following meteor-angular boilerplate
```
git clone https://github.com/araad/meteor-ngx-base.git
```
OR 

Install the angular schematics into your existing meteor-angular project
```
npm install --save-dev meteor-ngx-schematics
```


Then generate a new package using the schematics

```
// Unscoped
ng generate meteor-ngx-schematics:package some-name --prefix some-prefix

// Scoped
ng generate meteor-ngx-schematics:pacakge @some-org/some-name --prefix some-prefix
```

Once you start meteor, the package will be built and dependencies will beadded to package.json from local package directory.

---

Import angular library modules into your app
```
// Unscoped
import { SomeNameModule } from 'some-name';

// Scoped
import { SomeNameModule } from '@some-org/some-name';
```

Import server modules into your app
```
// Unscoped
import { SomeNameModule } from 'meteor/some-name';

// Scoped
import { SomeNameModule } from 'meteor/some-org:some-name';
```

Import common modules into your app (can be imported in both client and server side)
```
// Unscoped
import { SomeName } from 'some-name/common';

// Scoped
import { SomeName } from '@some-org/some-name/common';
```

---

### Package Folder Structure
```
some-name
├── client
│   ├── karma.conf.js
│   ├── ng-package.json
│   ├── package.json
│   ├── src
│   │   ├── lib
│   │   │   └── some-name.module.ts
│   │   ├── public_api.ts
│   │   └── test.ts
│   ├── tsconfig.lib.json
│   ├── tsconfig.spec.json
│   └── tslint.json
├── common
│   ├── imports
│   │   └── SomeName.ts
│   ├── package.json
│   ├── public_api.ts
│   └── tsconfig.lib.json
├── package.js
├── server
│   ├── imports
│   │   └── SomeName.ts
│   └── public_api.ts
└── tsconfig.pkg.json
```