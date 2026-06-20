/**
 * 将模板字符串中的占位符替换为 match 的实际值。
 *
 * 支持的占位符：
 *   $0, $&    - 完整匹配
 *   $1, $2... - 数字捕获组
 *   ${name}   - 命名捕获组
 *   $`        - 匹配前的文本
 *   $'        - 匹配后的文本
 *   \n        - 换行符
 *   \t        - Tab
 *
 * @param {string} template - 模板字符串
 * @param {{ full: string, groups: Array<{index:number,value:string}>, namedGroups: Object, text?: string }} match
 * @returns {string}
 */
export function applyTemplate(template, match) {
  if (!template) return '';

  // 预处理转义序列（避免和占位符正则冲突）
  const ESC_N = '\x00N\x00';
  const ESC_T = '\x00T\x00';
  let t = template.replace(/\\n/g, ESC_N).replace(/\\t/g, ESC_T);

  // 替换命名捕获组 ${name}（先处理，避免被 $N 干扰）
  t = t.replace(/\$\{(\w+)\}/g, (_, name) => {
    const v = match.namedGroups?.[name];
    return v !== undefined ? v : '';
  });

  // 替换 $& 和 $0（完整匹配）
  // 注意：$0\b 确保 $01 不会被 $0 替换（让 $N 处理）
  t = t.replace(/\$&/g, match.full);
  t = t.replace(/\$0\b/g, match.full);

  // 替换 $` （匹配前的文本）和 $'（匹配后的文本）
  if (match.text !== undefined) {
    const before = match.text.slice(0, match.groups[0]?.index ?? 0);
    const after = match.text.slice((match.groups[0]?.index ?? 0) + match.full.length);
    t = t.replace(/\$`/g, before);
    t = t.replace(/\$'/g, after);
  }

  // 替换数字捕获组 $N（贪婪匹配多位数字，避免 $10 被解析为 $1 + "0"）
  t = t.replace(/\$(\d+)/g, (_, numStr) => {
    const idx = parseInt(numStr, 10);
    const g = match.groups.find((g) => g.index === idx);
    return g ? g.value : '';
  });

  // 还原转义序列
  return t.replace(/\x00N\x00/g, '\n').replace(/\x00T\x00/g, '\t');
}
