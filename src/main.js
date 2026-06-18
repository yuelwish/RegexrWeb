import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';
import { ExpressionUI } from './ui/expression.js';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';

initTheme();
renderHeader(document.getElementById('appHeader'));

const doc = document.getElementById('appDoc');
doc.innerHTML = '<div id="expressionRoot"></div>';

const expr = new ExpressionUI(document.getElementById('expressionRoot'));

// 挂载 CodeMirror
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

expr.onChange(({ pattern, flags }) => {
  console.log('pattern:', pattern, 'flags:', flags);
});
