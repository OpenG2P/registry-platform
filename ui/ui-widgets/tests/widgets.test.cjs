const { test } = require('node:test');
const assert = require('node:assert/strict');
const { documentDisplayValue, resolveDocument } = require('../src/utils/documentDisplay.ts');
const { toTitleCase } = require('../src/utils/tSchema.ts');
const { stripSectionFileBlobs, collectAllSectionFilesSync } = require('../src/components/SectionRenderer/utils/sectionFiles.ts');

test('file fields preserve explicit clears while removing serialized blobs', () => {
  const records = [{ attachment_id: null }, { attachment_id: '' }, { attachment_id: { __type: 'File' } }];
  assert.deepEqual(stripSectionFileBlobs(records, ['sample.attachment_id']), [{ attachment_id: null }, { attachment_id: '' }, {}]);
  assert.equal(records[2].attachment_id.__type, 'File');
});

test('stored document IDs without signed URLs remain collectable', () => {
  const section = { panels: [{ widgets: [{ widget: 'file', 'widget-id': 'evidence',
    'widget-label': 'Evidence', 'widget-data-path': 'sample.attachment_id' }] }] };
  const collected = collectAllSectionFilesSync(section, { sample: { attachment_id: 'existing' } });
  assert.equal(collected.length, 1);
  assert.deepEqual(collected[0], {
    tag: '_direct_file', field: 'attachment_id', label: 'Evidence',
    value: { document_id: 'existing', label: 'Evidence' },
  });
});

test('document labels use filenames and signed URLs refresh on each open', async () => {
  let calls = 0;
  const handler = async (service, endpoint, method, params) => {
    assert.deepEqual([service, endpoint, method, params], ['shared', 'get-documents', 'POST', { document_ids: ['id'] }]);
    return [{ document_id: 'id', source_filename: 'evidence.pdf', presigned_url: `https://files.example/file?signature=${++calls}` }];
  };
  assert.equal((await resolveDocument(handler, 'id')).name, 'evidence.pdf');
  assert.equal((await resolveDocument(handler, 'id')).url, 'https://files.example/file?signature=2');
  assert.equal(documentDisplayValue({ name: 'local.pdf' }).name, 'local.pdf');
});

test('missing, mismatched and unsafe document URLs never resolve', async () => {
  for (const result of [null, [], [{ document_id: 'other', presigned_url: 'https://files.example/file' }],
    [{ document_id: 'id', presigned_url: 'javascript:alert(1)' }],
    [{ document_id: 'id', presigned_url: 'data:text/html,unsafe' }]]) {
    await assert.rejects(resolveDocument(async () => result, 'id'));
  }
});

test('title formatting preserves existing uppercase acronyms', () => {
  assert.equal(toTitleCase('birth_date_GC'), 'Birth Date GC');
  assert.equal(toTitleCase('birth-date-EC'), 'Birth Date EC');
  assert.equal(toTitleCase('API response'), 'API Response');
  assert.equal(toTitleCase('ordinary_field'), 'Ordinary Field');
});
