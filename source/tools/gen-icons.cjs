// react-icons/lu（Lucide公式SVGデータ）から、アプリで使うアイコンだけを抜き出して
// lucide-react 互換の小さなモジュールを生成する（オフラインビルド用）
const R = process.argv[2];
const lu = require(R + '/react-icons/lu');
const map = { Settings:'Settings', List:'List', Timer:'Timer', Edit2:'Pen', X:'X', Plus:'Plus', Minus:'Minus',
  Layers:'Layers', Trash2:'Trash2', Clock:'Clock', AlertCircle:'CircleAlert', Printer:'Printer', Camera:'Camera',
  Sparkles:'Sparkles', ChevronDown:'ChevronDown', Save:'Save', Check:'Check', Search:'Search', Filter:'Filter',
  Calendar:'Calendar', Globe:'Globe', PenTool:'PenTool', SlidersHorizontal:'SlidersHorizontal', RotateCcw:'RotateCcw',
  HelpCircle:'CircleHelp', Key:'Key', Download:'Download', Upload:'Upload', Copy:'Copy', Lock:'Lock', Unlock:'LockOpen',
  CheckCircle2:'CircleCheck', Building2:'Building2', Trophy:'Trophy' };
const out = [];
out.push("import React from 'react';");
out.push("type P = React.SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number | string };");
out.push("const make = (nodes: [string, Record<string,string>][]) => ({ size = 24, strokeWidth = 2, className = '', ...rest }: P) => (");
out.push("  <svg xmlns=\"http://www.w3.org/2000/svg\" width={size} height={size} viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth={strokeWidth} strokeLinecap=\"round\" strokeLinejoin=\"round\" className={className} {...rest}>");
out.push("    {nodes.map(([tag, attrs], i) => React.createElement(tag, { key: i, ...attrs }))}");
out.push("  </svg>");
out.push(");");
for (const [exp, luName] of Object.entries(map)) {
  const fn = lu['Lu' + luName];
  if (!fn) throw new Error('missing ' + luName);
  const src = fn.toString();
  const json = src.slice(src.indexOf('GenIcon(') + 8, src.lastIndexOf(')(props)'));
  const tree = JSON.parse(json);
  const nodes = tree.child.map(c => [c.tag, c.attr]);
  out.push(`export const ${exp} = make(${JSON.stringify(nodes)});`);
}
process.stdout.write(out.join('\n') + '\n');
