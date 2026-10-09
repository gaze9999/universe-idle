// Vue currently needs the TypeScript 6 compiler API; TypeScript 7 remains available to the project.
require('vue/compiler-sfc').registerTS(() => require('@typescript/typescript6'));
