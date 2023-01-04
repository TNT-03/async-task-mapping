import babel from 'rollup-plugin-babel'
import {uglify} from 'rollup-plugin-uglify';
import { terser } from "rollup-plugin-terser";
export default {
    input: 'index.js',
    output: {
      file: './dist/index.js',
      format: 'cjs',
      sourcemap: false
    },
    plugins: [
        babel({
            exclude: 'node_modules/**'
        }),
        terser({compress: { drop_console: true}}),
        uglify()
    ]
};