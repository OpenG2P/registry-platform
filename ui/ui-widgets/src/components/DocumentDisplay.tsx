import { useEffect, useState } from 'react';
import { useWidgetContext } from './WidgetProvider';
import { openFileInNewTab } from '../utils/filePreview';
import { documentDisplayValue, resolveDocument } from '../utils/documentDisplay';
import { deserializeFile, isSerializedFile } from '../utils/fileSerialization';

/** Shared file-cell display; the host request handler owns authentication/CSRF. */
export function DocumentDisplay({ value, source }: {
  value: unknown;
  source?: { service: string; endpoint: string };
}) {
  const { dataSourceRequestHandler: handler, t } = useWidgetContext();
  const initial = documentDisplayValue(value);
  const id = initial.document_id;
  const service = source?.service || 'shared';
  const endpoint = source?.endpoint || 'get-documents';
  const [resolved, setResolved] = useState<ReturnType<typeof documentDisplayValue> | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [localUrl, setLocalUrl] = useState<string>();

  useEffect(() => {
    setLocalUrl(undefined);
    try {
      const file = value instanceof File ? value : isSerializedFile(value) ? deserializeFile(value) : null;
      if (!file) return;
      const url = URL.createObjectURL(file);
      setLocalUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch { setFailed(true); }
  }, [value]);

  useEffect(() => {
    let active = true;
    setResolved(null);
    setFailed(false);
    if (id && handler) {
      resolveDocument(handler, id, service, endpoint)
        .then(doc => { if (active) setResolved(doc); })
        .catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; };
  }, [id, handler, service, endpoint]);

  if (!value) return <span>-</span>;
  const display = localUrl ? { ...initial, url: localUrl }
    : resolved && resolved.document_id === id ? resolved : initial;
  const translatedLabel = t?.('common.viewDocument', { defaultValue: 'View document' });
  const label = display.name || (translatedLabel && translatedLabel !== 'common.viewDocument'
    ? translatedLabel : 'View document');
  const translatedError = t?.('common.documentUnavailable', { defaultValue: 'Document unavailable' });
  const errorLabel = translatedError && translatedError !== 'common.documentUnavailable'
    ? translatedError : 'Document unavailable';
  const canOpen = Boolean(display.url || (id && handler));

  const open = async () => {
    if (opening) return;
    setOpening(true);
    setFailed(false);
    // Reserve the tab during the user's click, before refreshing the signed URL.
    // Detach its opener and suppress referrer before navigating it.
    const tab = id && handler ? globalThis.window.open('about:blank', '_blank') : null;
    if (tab) {
      tab.opener = null;
    }
    try {
      const doc = id && handler
        ? await resolveDocument(handler, id, service, endpoint) : display;
      if (!doc.url) throw new Error('Document URL unavailable');
      if (tab) {
        const link = tab.document.createElement('a');
        link.href = doc.url;
        link.rel = 'noopener noreferrer';
        link.referrerPolicy = 'no-referrer';
        tab.document.body.appendChild(link);
        link.click();
      }
      else openFileInNewTab(doc.url);
    } catch {
      tab?.close();
      setFailed(true);
    } finally {
      setOpening(false);
    }
  };

  return (
    <span className="inline-flex min-w-0 max-w-full flex-col">
      {canOpen ? (
        <button type="button" onClick={() => void open()} disabled={opening}
          className="min-w-0 truncate text-left underline owt-text" title={label}>
          {label}
        </button>
      ) : <span className="truncate" title={label}>{label}</span>}
      {failed && <span role="alert" className="text-sm owt-field-error">
        {errorLabel}
      </span>}
    </span>
  );
}
