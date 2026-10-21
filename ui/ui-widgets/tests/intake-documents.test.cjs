const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const { prepareIntakeDocuments } = require('../../staff-ui/src/features/intake-form/utils/prepareIntakeDocuments.ts');

const file = (name = 'attachment.pdf', extra = {}) => ({
  __type: 'File', name, size: 3, type: 'application/pdf', lastModified: 1,
  data: 'YWJj', ...extra,
});

test('profile and direct file uploads resolve to configured fields over HTTP before save', async () => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, body });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify([
      { document_id: 'photo-id', source_filename: 'photo.png' },
      { document_id: 'file-id', source_filename: 'attachment.pdf' },
    ]));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const source = [{ name: 'Synthetic record' }];
    const prepared = await prepareIntakeDocuments(source, [
      file('photo.png', { tag: '_profile', field: 'portrait_id', label: 'Portrait' }),
      file('attachment.pdf', { tag: '_direct_file', field: 'attachment_id', label: 'Evidence' }),
    ], async files => {
      const body = new FormData();
      files.forEach(value => body.append('documents', value));
      body.append('bucket', 'documents');
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/shared/upload-document`, {
        method: 'POST', body,
      });
      return response.json();
    });
    assert.deepEqual(prepared.records, [{ name: 'Synthetic record', portrait_id: 'photo-id', attachment_id: 'file-id' }]);
    assert.deepEqual(prepared.documents, [
      { document_id: 'photo-id', label: 'Portrait' }, { document_id: 'file-id', label: 'Evidence' },
    ]);
    assert.deepEqual(source, [{ name: 'Synthetic record' }]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/shared/upload-document');
    assert.match(requests[0].body, /filename="photo.png"/);
    assert.match(requests[0].body, /filename="attachment.pdf"/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('same-name table files stay associated with their own rows', async () => {
  const rows = [{ attachment: file() }, { attachment: file() }];
  const prepared = await prepareIntakeDocuments(rows, [], async () => [
    { document_id: 'first', source_filename: 'attachment.pdf' },
    { document_id: 'second', source_filename: 'attachment.pdf' },
  ]);
  assert.deepEqual(prepared.records, [{ attachment: 'first' }, { attachment: 'second' }]);
  assert.equal(rows[0].attachment.__type, 'File');
});

test('resaving keeps existing profile/table document links and replacement removes old links', async () => {
  const schema = { panels: [{ widgets: [
    { widget: 'header-section', 'widget-label': 'Portrait', 'widget-data-path': { image: 'sample.portrait_id' } },
    { widget: 'dialog-table', 'widget-data-columns': [
      { widget: 'file', 'column-key': 'attachment_id', 'widget-label': 'Evidence' },
    ] },
  ] }] };
  const existing = await prepareIntakeDocuments([{ portrait_id: 'old-photo', attachment_id: 'old-file' }], [],
    () => { throw new Error('Must not upload'); }, schema);
  assert.deepEqual(existing.documents, [{ document_id: 'old-photo', label: 'Portrait' }, { document_id: 'old-file', label: 'Evidence' }]);
  const replacement = await prepareIntakeDocuments([{ portrait_id: 'old-photo', attachment_id: null }], [
    file('photo.png', { field: 'portrait_id', tag: '_profile', label: 'Portrait' }),
  ], async () => [{ document_id: 'new-photo', source_filename: 'photo.png' }], schema);
  assert.deepEqual(replacement.documents, [{ document_id: 'new-photo', label: 'Portrait' }]);
  assert.deepEqual(replacement.records, [{ portrait_id: 'new-photo', attachment_id: null }]);
});

for (const [name, result] of Object.entries({
  missing: null, empty: [], partial: [{ document_id: 'first', source_filename: 'first.pdf' }],
  missingId: [{ source_filename: 'first.pdf' }, { document_id: 'second', source_filename: 'second.pdf' }],
  wrongOrder: [{ document_id: 'second', source_filename: 'second.pdf' }, { document_id: 'first', source_filename: 'first.pdf' }],
  duplicateId: [{ document_id: 'same', source_filename: 'first.pdf' }, { document_id: 'same', source_filename: 'second.pdf' }],
})) {
  test(`rejects ${name} upload result, preserving the retry payload`, async () => {
    const rows = [{ attachment: file('first.pdf') }, { attachment: file('second.pdf') }];
    const before = JSON.stringify(rows);
    await assert.rejects(prepareIntakeDocuments(rows, [], async () => result), /Incomplete/);
    assert.equal(JSON.stringify(rows), before);
  });
}

test('ambiguous records and malformed files fail before any upload', async () => {
  const upload = () => { throw new Error('Must not upload'); };
  await assert.rejects(prepareIntakeDocuments([{}, {}], [file('file.pdf', {
    tag: '_profile', field: 'portrait_id',
  })], upload), /Ambiguous/);
  await assert.rejects(prepareIntakeDocuments([{ attachment: file('bad.pdf', { data: '!' }) }], [], upload));
});

test('existing references and explicit clears survive without re-uploading or reviving deleted rows', async () => {
  const prepared = await prepareIntakeDocuments([
    { attachment: { document_id: 'existing', label: 'Evidence' } },
    { attachment: null },
    { edit_action: 'DELETE', attachment: file() },
  ], [], () => { throw new Error('Must not upload'); });
  assert.deepEqual(prepared.records.slice(0, 2), [{ attachment: 'existing' }, { attachment: null }]);
  assert.deepEqual(prepared.documents, [{ document_id: 'existing', label: 'Evidence' }]);
});
