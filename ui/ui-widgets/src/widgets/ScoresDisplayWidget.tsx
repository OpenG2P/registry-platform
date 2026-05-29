import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { BaseWidgetConfig } from '../types';
import { useWidgetContext } from '../components/WidgetProvider';
import { WidgetRootState } from '../store';
import { getValueByPath } from '../utils/pathUtils';

export type ScoreRecord = {
  score_type?: string;
  computed_score?: string | number;
  computed_at?: string;
  triggered_by_cr_id?: string;
  [key: string]: unknown;
};

interface ScoresDisplayWidgetProps {
  config: BaseWidgetConfig;
  schemaData?: Record<string, unknown>;
}

function getValueByPathOrKey(obj: Record<string, unknown>, path: string): unknown {
  if (!obj || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  return getValueByPath(obj, path);
}

function tryFormatDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return value ? String(value) : '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function sortScores(scores: ScoreRecord[]): ScoreRecord[] {
  const withTime = scores
    .map((s, idx) => {
      const t = typeof s?.computed_at === 'string' ? new Date(s.computed_at).getTime() : NaN;
      return { s, t, idx };
    })
    .sort((a, b) => {
      const aHas = !Number.isNaN(a.t);
      const bHas = !Number.isNaN(b.t);
      if (aHas && bHas) return b.t - a.t;
      if (aHas) return -1;
      if (bHas) return 1;
      return a.idx - b.idx;
    });
  return withTime.map((x) => x.s);
}

/**
 * Scores Display Widget - full-width, view-only widget (list)
 *
 * Expected config (reference):
 * {
 *   "widget": "scores-display",
 *   "widget-type": "group",
 *   "widget-id": "record-scores",
 *   "widget-data-path": "scores"
 * }
 */
export const ScoresDisplayWidget = ({
  config,
  schemaData: propSchemaData,
}: ScoresDisplayWidgetProps) => {
  const { schemaData: ctxSchemaData } = useWidgetContext();
  const schemaData = (propSchemaData || ctxSchemaData || {}) as Record<string, unknown>;
  const values = useSelector((state: WidgetRootState) => state.widget.values);

  const dataPath = config['widget-data-path'];

  const rawScores = useMemo((): unknown => {
    if (!dataPath || typeof dataPath !== 'string') return undefined;
    const valuesObj = values as unknown as Record<string, unknown>;

    const tryResolve = (path: string): unknown => {
      const fromValues = getValueByPathOrKey(valuesObj, path);
      if (fromValues !== undefined) return fromValues;
      return getValueByPathOrKey(schemaData, path);
    };

    // 1) Try exact path (works when schema/store is already namespaced)
    const direct = tryResolve(dataPath);
    if (direct !== undefined) return direct;

    // 2) If section/widget config has been namespaced (e.g. "rv-section-0.scores"),
    // fall back to the original path ("scores") so examples still work even when
    // schemaData/store are not namespaced.
    if (dataPath.includes('.')) {
      const unNamespaced = dataPath.split('.').slice(1).join('.');
      const fallback = tryResolve(unNamespaced);
      if (fallback !== undefined) return fallback;
    }

    return undefined;
  }, [dataPath, values, schemaData]);

  const scores = useMemo((): ScoreRecord[] => {
    if (!rawScores) return [];
    if (Array.isArray(rawScores)) return rawScores as ScoreRecord[];
    if (typeof rawScores === 'object') {
      const maybe = (rawScores as { scores?: unknown }).scores;
      if (Array.isArray(maybe)) return maybe as ScoreRecord[];
    }
    return [];
  }, [rawScores]);

  const sortedScores = useMemo(() => sortScores(scores), [scores]);
  const cls = `scores-display-widget-${config['widget-id']}`;

  return (
    <>
      <style>{`
        .${cls} {
          width: 100%;
          font-family: Roboto, sans-serif;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .${cls} .scores-subtle {
          font-size: 13px;
          color: var(--owt-color-text-muted, #727474);
          font-weight: 400;
        }

        .${cls} .scores-grid {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, minmax(220px, 1fr));
          gap: 16px;
        }

        .${cls} .scores-card {
          border: 1px solid var(--owt-color-border-light, #E4E4E4);
          border-radius: 10px;
          background: var(--owt-color-bg, #FFFFFF);
          padding: 14px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
          box-shadow: 0 1px 2px rgba(1, 22, 39, 0.06), 0 6px 16px rgba(1, 22, 39, 0.06);
        }

        .${cls} .scores-type {
          font-size: 16px;
          font-weight: 800;
          color: var(--owt-color-primary-dark, #F07B1A);
          line-height: 1.2;
          word-break: break-word;
        }

        .${cls} .scores-value {
          font-size: 34px;
          font-weight: 800;
          color: var(--owt-color-text, #011627);
          line-height: 1.05;
          letter-spacing: -0.25px;
        }

        .${cls} .scores-separator {
          height: 1px;
          width: 100%;
          background-color: var(--owt-color-border-light, #E4E4E4);
          border: none;
          margin: 2px 0;
        }

        .${cls} .scores-value .scores-muted {
          font-size: 18px;
          font-weight: 600;
          color: var(--owt-color-text-muted, #727474);
          margin-left: 6px;
        }

        .${cls} .scores-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .${cls} .scores-meta-line {
          font-size: 13px;
          color: var(--owt-color-text-muted, #727474);
          font-weight: 500;
        }

        .${cls} .scores-meta-line strong {
          color: var(--owt-color-text, #011627);
          font-weight: 700;
        }

        @media (max-width: 1024px) {
          .${cls} .scores-grid {
            grid-template-columns: repeat(2, minmax(220px, 1fr));
          }
        }

        @media (max-width: 640px) {
          .${cls} .scores-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className={cls}>
        {sortedScores.length === 0 ? (
          <div className="scores-subtle">No scores available.</div>
        ) : (
          <div className="scores-grid">
            {sortedScores.map((s, idx) => {
              const scoreType = s?.score_type ? String(s.score_type) : '-';
              const scoreValue =
                s?.computed_score !== undefined &&
                s?.computed_score !== null &&
                String(s.computed_score) !== ''
                  ? String(s.computed_score)
                  : '-';
              const computedAt = tryFormatDateTime(s?.computed_at);
              const key = `${scoreType}-${String(s?.computed_at || '')}-${idx}`;

              return (
                <div
                  className="scores-card"
                  key={key}
                  aria-live={idx === 0 ? 'polite' : undefined}
                >
                  <div className="scores-type">{scoreType}</div>
                  <div className="scores-value">
                    {scoreValue}
                  </div>
                  <hr className="scores-separator" />
                  <div className="scores-meta">
                    <div className="scores-meta-line">
                      Computed at: <strong>{computedAt}</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

