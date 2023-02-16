import livereload from 'rollup-plugin-livereload'
import serve from 'rollup-plugin-serve'
import babel from 'rollup-plugin-babel'
import html from '@rollup/plugin-html'

export default {
    input: 'index.js',
    output: {
      file: './demo/index.js',
      format: 'umd',
      sourcemap: true,
      name: "async-task-mapping"
    },
    plugins: [
        babel({
            exclude: 'node_modules/**'
        }),
        livereload(),
        serve({
            open : true,
            port : 8888,
            contentBase: 'demo',
        }),
        html({})
    ]
};