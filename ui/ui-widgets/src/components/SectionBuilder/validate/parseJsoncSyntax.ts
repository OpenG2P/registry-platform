import { parse, format, applyEdits, printParseErrorCode, type ParseError } from 'jsonc-parser';

export type JsonSyntaxHint = {
  line: number;
  column: number;
  message: string;
};

const PARSE_OPTIONS = {
  disallowComments: true,
  allowTrailingComma: false,
};

function indexToLineColumn(text: string, index: number): { line: number; column: number } {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  let line = 1;
  let column = 1;

  for (let i = 0; i < safeIndex; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }

  return { line, column };
}

function hintFromParseError(text: string, parseError: ParseError): JsonSyntaxHint {
  const { line, column } = indexToLineColumn(text, parseError.offset);
  return {
    line,
    column,
    message: printParseErrorCode(parseError.error),
  };
}

export function formatJsonDocument(text: string): string {
  const edits = format(text, undefined, {
    tabSize: 2,
    insertSpaces: true,
    eol: '\n',
  });
  return applyEdits(text, edits);
}

export function parseJsonSyntax(text: string): {
  jsonSyntaxValid: boolean;
  parsed?: unknown;
  jsonSyntaxHint?: JsonSyntaxHint;
  errors: string[];
} {
  const parseErrors: ParseError[] = [];
  const parsed = parse(text, parseErrors, PARSE_OPTIONS);

  if (parseErrors.length > 0) {
    const hint = hintFromParseError(text, parseErrors[0]);
    return {
      jsonSyntaxValid: false,
      jsonSyntaxHint: hint,
      errors: [hint.message],
    };
  }

  return {
    jsonSyntaxValid: true,
    parsed,
    errors: [],
  };
}

export function lineToIndex(text: string, line: number, atEnd = true): number {
  const lines = text.split('\n');
  const safeLine = Math.max(1, Math.min(line, lines.length));
  let index = 0;

  for (let i = 0; i < safeLine - 1; i++) {
    index += lines[i].length + 1;
  }

  if (atEnd) {
    index += lines[safeLine - 1]?.length ?? 0;
  }

  return Math.min(index, text.length);
}
