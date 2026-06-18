import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';
import { ExpressionUI } from './ui/expression.js';
import { TextUI } from './ui/text.js';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { solveRegex } from './engine/regex-solver.js';
import { debounce } from './utils/debounce.js';

initTheme();
renderHeader(document.getElementById('appHeader'));

const doc = document.getElementById('appDoc');
doc.innerHTML = '<div id="expressionRoot"></div><div id="textRoot"></div>';

const expr = new ExpressionUI(document.getElementById('expressionRoot'));
const text = new TextUI(document.getElementById('textRoot'));

// Expression CodeMirror
const exprEditor = new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          expr.setPattern(update.state.doc.toString());
          expr.emit();
        }
      }),
    ],
  }),
  parent: document.getElementById('expressionMount'),
});

expr.mountEditor(exprEditor);

// 触发匹配
const runMatch = debounce(async () => {
  const pattern = expr.getPattern();
  const flags = expr.getFlagsString();
  const body = text.getText();

  if (!pattern) {
    expr.setError(null);
    text.setMatches([]);
    return;
  }

  const result = await solveRegex(pattern, flags, body);
  if (result.error && !result.error.warning) {
    expr.setError(result.error.message);
  } else {
    expr.setError(null);
    text.setMatches(result.matches);
  }
}, 300);

expr.onChange(runMatch);
text.onChange(runMatch);
