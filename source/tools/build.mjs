// オフラインで「1ファイルだけで動く index.html」を作るビルドスクリプト
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import { compile } from '/opt/npm-tools/node_modules/tailwindcss/dist/lib.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const NM = '/opt/npm-tools/node_modules';
const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');

// 1) JS バンドル（lucide-react は同梱アイコンに差し替え）
const js = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true, minify: true, format: 'iife', target: ['es2020'],
  jsx: 'automatic', write: false, nodePaths: [NM], legalComments: 'none',
  alias: { 'lucide-react': path.join(root, 'src/lucide-icons.tsx') },
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.tsx': 'tsx' },
});
const jsCode = js.outputFiles[0].text;

// 2) Tailwind CSS（ソース中のクラス候補だけを生成）
const loadStylesheet = async (id, base) => {
  const file = id === 'tailwindcss' ? path.join(NM, 'tailwindcss/index.css') : path.resolve(base, id);
  return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
};
const compiler = await compile(fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8'), { base: path.join(root, 'src'), loadStylesheet });
const candidates = new Set(appSrc.split(/[\s"'`{}<>\;,]+/).filter(Boolean));
const rawCss = compiler.build([...candidates]);
const css = (await esbuild.transform(rawCss, { loader: 'css', minify: true, target: ['safari14'] })).code;

// 3) HTML 組み立て
const template = fs.readFileSync(path.join(root, 'index.template.html'), 'utf8');
const build = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const html = template.replaceAll('__BUILD__', build)
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => jsCode.replace(/<\/script/gi, '<\\/script'));
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(jsCode.length/1024).toFixed(0)} KB, css ${(css.length/1024).toFixed(0)} KB)`);
