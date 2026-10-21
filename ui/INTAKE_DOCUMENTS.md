# Intake documents and shared widgets

The intake save hook resolves profile and direct file uploads before calling
`/api/intake-form/save-intake-form-submission`. Configured file fields receive
document IDs rather than serialized file bodies. Table files retain their own
row association, including when multiple files have the same filename.

The existing APIs and authorization remain unchanged:

- `/api/shared/upload-document` takes multipart `documents` and `bucket` and
  returns an array of `{ document_id, source_filename, ... }`.
- The backend's `G2PDocumentService.upload_documents` returns documents in request
  order. The intake helper checks the result count, IDs, filenames and duplicate
  IDs before saving. Invalid results or deserialization errors stop the save.
- `section_files` entries identify top-level targets through their existing
  `field` and `tag` metadata. An ambiguous multirow target is rejected. Table
  file cells are associated directly with their row and column.
- Section document links are replaced by the save API. Existing IDs identified
  by file/header metadata are retained in `documents`; a replacement or explicit
  clear omits the old link. Supporting-document handling is unchanged.
- Retrying a failed save starts from the original widget values. A successful
  upload followed by a failed save can leave an unattached uploaded document;
  this change does not add storage rollback or garbage collection.

Generic widget behavior:

- Removing a header photo clears both configured `image` and `imageUrl` paths.
- File widgets and table/dialog file cells show filenames and open documents.
  Local files use object URLs. Stored IDs use the host's existing
  `dataSourceRequestHandler('shared', 'get-documents', 'POST', { document_ids })`.
  `widget-data-options.documentSource` can select another service/endpoint with
  the same response contract. Hosts continue to handle cookies, CSRF and errors.
- Document lookup returns an array with the requested `document_id`,
  `source_filename` and an HTTP(S) `presigned_url`. Each open refreshes the URL.
  New tabs have no opener or referrer; failed lookup closes the reserved tab and
  displays an error. A host without a lookup handler can display filenames and
  open an existing HTTP(S) URL, but cannot refresh it.
- Explicit null/empty file clears survive section serialization. Dialog file
  fields can opt into `clearFileWhenHidden: true` when hiding the field should
  clear its reference. Hiding a field alone does not opt into this behavior.
- Header options `showInfo: false` and `showMetadata: false` hide the status/ID
  region and audit metadata respectively; defaults preserve both regions.
- Title formatting preserves already-uppercase acronyms such as GC, EC and API.

No domain field names are required. Derived certificate flags, field definitions,
visibility rules, branding and other registry-specific behavior remain in the
extension/metadata.

## Validation

From `ui/ui-widgets`:

```sh
npm ci
npm test
npm run type-check
npm run build
```

The Node tests load the actual TypeScript helpers using the existing TypeScript
dependency. They include a real loopback multipart request and failure/association
regressions. The UI CI job runs them. These tests do not establish authenticated
backend persistence, approval or register acceptance.

For manual browser acceptance, use a synthetic section containing a header photo,
a file widget and table/dialog file columns. Upload and remove photos, upload
same-name files in different rows, save and reload unchanged attachments, clear a
visible file, and exercise an opted-in conditionally hidden file. Open files by
mouse and Enter, including after the previous signed URL has expired. Verify
failed/forbidden lookups, unsafe URLs and incomplete uploads do not report success.
Verify actual intake approval and register persistence with the published image.

## Publication and integration

Widget source changes require a published `@openg2p/registry-widgets` version and
a shared staff UI image built with that version. The existing
`npm-publish-ui-widgets.yml` workflow publishes widget changes on `1.2`, updates
the staff UI's exact dependency pin and dispatches Build & Publish. This PR does
not invent a package version or change a deployed Registry Platform pin.

A registry consuming the shared UI must first adopt the validated image and any
needed metadata options. Its custom image/compiled-bundle adapters can then be
removed in a separate integration change. Source merge alone does not complete
that migration.
