import React, { useState, useCallback, useRef, useMemo } from 'react';
import { SectionConfig } from '../../types';
import { parseSectionJson } from './validate/parseSectionJson';
import { formatJsonDocument, lineToIndex, type JsonSyntaxHint } from './validate/parseJsoncSyntax';
import { useWidgetContext } from '../WidgetProvider';
import { maximizeIcon, minimizeIcon } from '../../assets';

export type BuilderNotifyType = 'success' | 'error' | 'info' | 'warn';

const EDITOR_FONT_SIZE = 13;
const EDITOR_LINE_HEIGHT = 1.5;
const EDITOR_LINE_HEIGHT_PX = EDITOR_FONT_SIZE * EDITOR_LINE_HEIGHT;

interface JSONEditorPanelProps {
  initialText: string;
  onChange: (section: SectionConfig) => void;
  onRawDraftChange?: (next: string) => void;
  onRawValidationChange?: (next: { isValid: boolean; errors: string[]; jsonSyntaxValid: boolean }) => void;
  onNotify?: (message: string, type: BuilderNotifyType) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const JSONEditorPanel: React.FC<JSONEditorPanelProps> = ({
  initialText,
  onChange,
  onRawDraftChange,
  onRawValidationChange,
  onNotify,
  isMaximized = false,
  onToggleMaximize,
}) => {
  const { t } = useWidgetContext();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);

  const [rawJsonText, setRawJsonText] = useState<string>(initialText);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>(() => {
    const result = parseSectionJson(initialText);
    return result.jsonSyntaxHint ? [result.jsonSyntaxHint.message] : result.errors;
  });
  const [jsonSyntaxValid, setJsonSyntaxValid] = useState<boolean>(() => parseSectionJson(initialText).jsonSyntaxValid);
  const [jsonSyntaxHint, setJsonSyntaxHint] = useState<JsonSyntaxHint | undefined>(() => {
    return parseSectionJson(initialText).jsonSyntaxHint;
  });

  const lineCount = useMemo(() => rawJsonText.split('\n').length, [rawJsonText]);
  const textLines = useMemo(() => rawJsonText.split('\n'), [rawJsonText]);

  const publishValidation = useCallback(
    (result: ReturnType<typeof parseSectionJson>) => {
      const errors = result.jsonSyntaxHint ? [result.jsonSyntaxHint.message] : result.errors;
      setValidationErrors(errors);
      setJsonSyntaxValid(result.jsonSyntaxValid);
      setJsonSyntaxHint(result.jsonSyntaxHint);
      onRawValidationChange?.({
        isValid: result.isValid,
        errors,
        jsonSyntaxValid: result.jsonSyntaxValid,
      });
    },
    [onRawValidationChange]
  );

  const runParse = useCallback((text: string) => parseSectionJson(text), []);

  const syncEditorScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    const highlightLayer = highlightLayerRef.current;
    const scrollTop = textarea?.scrollTop ?? 0;

    if (lineNumbers) {
      lineNumbers.scrollTop = scrollTop;
    }
    if (highlightLayer) {
      highlightLayer.scrollTop = scrollTop;
    }
  }, []);

  const jumpToErrorLine = useCallback(
    (line: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const index = lineToIndex(rawJsonText, line, true);
      textarea.focus();
      textarea.setSelectionRange(index, index);
      textarea.scrollTop = Math.max(0, (line - 4) * EDITOR_LINE_HEIGHT_PX);
      syncEditorScroll();
      setHighlightedLine(line);
    },
    [rawJsonText, syncEditorScroll]
  );

  const handleRawJsonChange = useCallback(
    (text: string) => {
      setHighlightedLine(null);
      setRawJsonText(text);
      onRawDraftChange?.(text);
      publishValidation(runParse(text));
    },
    [onRawDraftChange, publishValidation, runParse]
  );

  const handleValidate = useCallback(() => {
    const validation = runParse(rawJsonText);
    publishValidation(validation);

    if (validation.isValid && validation.parsed) {
      setHighlightedLine(null);
      onChange(validation.parsed);
      onNotify?.(t?.('sectionBuilder.notifyJsonValid') || 'JSON schema is valid', 'success');
      return;
    }

    if (!validation.jsonSyntaxValid) {
      if (validation.jsonSyntaxHint) {
        jumpToErrorLine(validation.jsonSyntaxHint.line);
      }
      onNotify?.(
        validation.jsonSyntaxHint?.message ||
          (t?.('sectionBuilder.invalidJsonSchema') || 'Invalid JSON schema'),
        'error'
      );
      return;
    }

    onNotify?.(
      t?.('sectionBuilder.notifyValidationFailed', { count: validation.errors.length }) ||
        `Validation failed: ${validation.errors.length} error(s)`,
      'error'
    );
  }, [jumpToErrorLine, onChange, onNotify, publishValidation, rawJsonText, runParse, t]);

  const handleFormat = useCallback(() => {
    const validation = runParse(rawJsonText);
    if (!validation.jsonSyntaxValid) {
      publishValidation(validation);
      if (validation.jsonSyntaxHint) {
        jumpToErrorLine(validation.jsonSyntaxHint.line);
      }
      onNotify?.(
        validation.jsonSyntaxHint?.message ||
          (t?.('sectionBuilder.invalidJsonSchema') || 'Invalid JSON schema'),
        'error'
      );
      return;
    }

    if (!validation.isValid || !validation.parsed) {
      publishValidation(validation);
      onNotify?.(
        t?.('sectionBuilder.notifyCannotFormatSchema', { count: validation.errors.length }) ||
          `Cannot format: fix ${validation.errors.length} schema error(s) first`,
        'error'
      );
      return;
    }

    const formatted = formatJsonDocument(rawJsonText);
    setHighlightedLine(null);
    setRawJsonText(formatted);
    onRawDraftChange?.(formatted);

    const formattedValidation = runParse(formatted);
    if (!formattedValidation.isValid || !formattedValidation.parsed) {
      publishValidation(formattedValidation);
      onNotify?.(
        t?.('sectionBuilder.notifyCannotFormatSchema', { count: formattedValidation.errors.length }) ||
          `Cannot format: fix ${formattedValidation.errors.length} schema error(s) first`,
        'error'
      );
      return;
    }

    publishValidation({ isValid: true, errors: [], parsed: formattedValidation.parsed, jsonSyntaxValid: true });
    onChange(formattedValidation.parsed);
    onNotify?.(t?.('sectionBuilder.notifyJsonFormatted') || 'JSON formatted successfully', 'success');
  }, [jumpToErrorLine, onChange, onRawDraftChange, onNotify, publishValidation, rawJsonText, runParse, t]);

  const handleTextareaScroll = useCallback(() => {
    syncEditorScroll();
  }, [syncEditorScroll]);

  const statusLabel =
    jsonSyntaxValid && validationErrors.length === 0
      ? t?.('sectionBuilder.validJsonSchema') || 'Valid JSON schema'
      : t?.('sectionBuilder.invalidJsonSchema') || 'Invalid JSON schema';
  const statusIsOk = jsonSyntaxValid && validationErrors.length === 0;
  const errorLine = jsonSyntaxHint?.line;
  const isLineHighlighted = (lineNumber: number) => highlightedLine === lineNumber;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0%',
        width: '100%',
        minHeight: 0,
        padding: '0 16px 16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          padding: '16px 4px',
          background: 'var(--owt-color-bg)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--owt-color-text)' }}>
            {t?.('sectionBuilder.jsonEditor') || 'JSON Editor'}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: statusIsOk ? 'var(--owt-color-success)' : 'var(--owt-color-error)',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: statusIsOk ? 'var(--owt-color-success)' : 'var(--owt-color-error)',
              }}
            />
            <span style={{ fontSize: '12px' }}>{statusLabel}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleValidate}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '10px',
              background: 'var(--owt-color-bg)',
              color: 'var(--owt-color-text)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {t?.('sectionBuilder.validate') || 'Validate'}
          </button>
          <button
            type="button"
            onClick={handleFormat}
            style={{
              padding: '6px 12px',
              border: '1px solid var(--owt-color-border)',
              borderRadius: '10px',
              background: 'var(--owt-color-bg)',
              color: 'var(--owt-color-text)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {t?.('sectionBuilder.format') || 'Format'}
          </button>
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              style={{
                padding: '8px',
                border: 'none',
                borderRadius: '4px',
                background: 'transparent',
                color: 'var(--owt-color-text-muted, #727474)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
              }}
              title={isMaximized ? (t?.('sectionBuilder.minimize') || 'Minimize') : (t?.('sectionBuilder.maximize') || 'Maximize')}
            >
              {isMaximized ? (
                <img src={minimizeIcon} alt={t?.('sectionBuilder.minimize') || 'Minimize'} width="16" height="16" />
              ) : (
                <img src={maximizeIcon} alt={t?.('sectionBuilder.maximize') || 'Maximize'} width="16" height="16" />
              )}
            </button>
          )}
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div
          style={{
            marginBottom: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'var(--owt-color-error-light, #fef2f2)',
            border: '1px solid var(--owt-color-error)',
            color: 'var(--owt-color-error)',
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          {validationErrors.map((error, index) => (
            <div key={`${error}-${index}`}>{error}</div>
          ))}
          {errorLine && (
            <button
              type="button"
              onClick={() => jumpToErrorLine(errorLine)}
              style={{
                marginTop: '8px',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid var(--owt-color-error)',
                background: 'var(--owt-color-bg, #FFFFFF)',
                color: 'var(--owt-color-error)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              {t?.('sectionBuilder.goToLine', { line: errorLine }) || `Go to line ${errorLine}`}
            </button>
          )}
        </div>
      )}

      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          overflow: 'hidden',
          background: 'var(--owt-color-bg)',
          border: '1px solid var(--owt-color-border-light)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'row',
        }}
      >
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '52px',
            overflow: 'hidden',
            borderRight: '1px solid var(--owt-color-border-light)',
            background: 'var(--owt-color-bg-alt, #F6F6F6)',
            padding: '20px 8px 20px 12px',
            boxSizing: 'border-box',
            userSelect: 'none',
          }}
        >
          {Array.from({ length: lineCount }, (_, index) => {
            const lineNumber = index + 1;
            const isHighlighted = isLineHighlighted(lineNumber);

            return (
              <div
                key={lineNumber}
                style={{
                  height: `${EDITOR_LINE_HEIGHT_PX}px`,
                  lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                  fontSize: `${EDITOR_FONT_SIZE}px`,
                  textAlign: 'right',
                  color: isHighlighted ? 'var(--owt-color-error)' : 'var(--owt-color-text-muted, #727474)',
                  fontWeight: isHighlighted ? 700 : 400,
                  background: isHighlighted ? 'var(--owt-color-error-light, #fef2f2)' : 'transparent',
                  borderRadius: '4px',
                }}
              >
                {lineNumber}
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: 'relative',
            flex: '1 1 0%',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            ref={highlightLayerRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              overflow: 'hidden',
              pointerEvents: 'none',
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
            {textLines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = isLineHighlighted(lineNumber);

              return (
                <div
                  key={`highlight-${lineNumber}`}
                  style={{
                    minHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                    lineHeight: `${EDITOR_LINE_HEIGHT_PX}px`,
                    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
                    fontSize: `${EDITOR_FONT_SIZE}px`,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: 'transparent',
                    background: isHighlighted ? 'var(--owt-color-error-light, #fef2f2)' : 'transparent',
                    boxShadow: isHighlighted ? 'inset 3px 0 0 var(--owt-color-error)' : 'none',
                  }}
                >
                  {line.length > 0 ? line : ' '}
                </div>
              );
            })}
          </div>
          <textarea
            ref={textareaRef}
            value={rawJsonText}
            onChange={(e) => handleRawJsonChange(e.target.value)}
            onScroll={handleTextareaScroll}
            style={{
              position: 'relative',
              zIndex: 1,
              flex: '1 1 0%',
              width: '100%',
              height: '100%',
              minHeight: 0,
              background: 'transparent',
              color: 'var(--owt-color-text)',
              border: 'none',
              padding: '20px',
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, "source-code-pro", monospace',
              fontSize: `${EDITOR_FONT_SIZE}px`,
              lineHeight: EDITOR_LINE_HEIGHT,
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              borderRadius: '0 10px 10px 0',
            }}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
};
