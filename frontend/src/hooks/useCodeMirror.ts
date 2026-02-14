/**
 * useCodeMirror — React hook for CodeMirror 6 integration.
 *
 * Provides a minimal, performant code editor with JavaScript syntax
 * highlighting and the One Dark theme.
 */

import { useEffect, useRef, type RefObject } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';

interface UseCodeMirrorOptions {
  container: RefObject<HTMLDivElement | null>;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function useCodeMirror({ container, value, onChange, readOnly = false }: UseCodeMirrorOptions) {
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Compartments for dynamic reconfiguration
  const editableCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());

  // Track whether an internal update triggered the change
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    const el = container.current;
    if (!el) return;

    // Don't recreate if already mounted
    if (viewRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isInternalUpdate.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        javascript(),
        oneDark,
        updateListener,
        editableCompartment.current.of(EditorView.editable.of(!readOnly)),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        EditorView.theme({
          '&': {
            fontSize: '13px',
            fontFamily: "'Fira Code', monospace",
            height: '100%',
            minHeight: '400px',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            padding: '12px 0',
          },
          '.cm-gutters': {
            borderRight: '1px solid hsl(var(--border))',
          },
        }),
      ],
    });

    const view = new EditorView({ state, parent: el });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container.current]);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current !== value) {
      isInternalUpdate.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      isInternalUpdate.current = false;
    }
  }, [value]);

  // Update readOnly state
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        editableCompartment.current.reconfigure(EditorView.editable.of(!readOnly)),
        readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
      ],
    });
  }, [readOnly]);
}
