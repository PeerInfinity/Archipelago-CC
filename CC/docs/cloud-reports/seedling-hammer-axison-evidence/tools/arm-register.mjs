import { register } from 'node:module';
register(new URL('./arm-loader.mjs', import.meta.url).href);
