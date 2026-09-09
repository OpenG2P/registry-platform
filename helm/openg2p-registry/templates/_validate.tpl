{{/*
Release-name length guard.

Several resources created by this chart (and its subcharts, especially
postgres-init Jobs) embed the release name and a release-derived DB name
in their `metadata.name`. Kubernetes auto-injects `batch.kubernetes.io/job-name`
as a Pod label whose VALUE is limited to 63 characters. With our naming
pattern, release names longer than 30 characters can produce Job names that
exceed this limit, causing `helm install` to fail mid-way with a cryptic
"spec.template.labels: Invalid value: ..." error.

This guard fails the install upfront with a clear, actionable message.

If you absolutely must use a longer release name, override the DB names
explicitly (global.registryDB, global.idGeneratorDB, etc.) to be shorter
than the defaults — the SHA-suffix pattern in values.yaml is designed to
stay within budget but requires a release name <= 30 chars.
*/}}

{{- define "openg2p-registry.validateReleaseName" -}}
{{/*
  $maxLen comes from the worst-case Job name in the chart, namely the
  id-generator's postgres-init Job:

      <release>-idgen-pg-init-<release>-idgenerator
      └─ release + 14 ─┘  └─ release + 12 ─────┘   (separators included)

  Total = 2 * len(release) + 27. For the auto-injected
  `batch.kubernetes.io/job-name` Pod label (max 63 chars), we need:
      2 * len(release) + 27 <= 63   →   len(release) <= 18

  We use 18 as a hard cap. If you ever shorten the DB names or the
  `idgenerator.postgres-init.nameOverride`, this cap can be relaxed.
*/}}
{{- $maxLen := 18 -}}
{{- if gt (len .Release.Name) $maxLen -}}
{{- $msg := printf "\n\nERROR: Helm release name %q is %d characters long.\nMaximum supported length is %d characters.\n\nKubernetes enforces a 63-character limit on label values. The release name appears in resource names (e.g. postgres-init Jobs) and indirectly in the auto-injected `batch.kubernetes.io/job-name` label. With this chart's DB-name template, release names longer than %d chars produce Job names that exceed the 63-char ceiling and cause `helm install` to fail with `spec.template.labels: Invalid value: ... must be no more than 63 characters`.\n\nFix: re-run `helm install` with a shorter release name (e.g. `registry`, `farmer-reg`)." .Release.Name (len .Release.Name) $maxLen $maxLen -}}
{{- fail $msg -}}
{{- end -}}
{{- end -}}

{{/*
Duplicate credential-type guard.

Each entry in `agentPortalApi.vcDefinitions` is keyed by `config_id`, and that id
is used three ways: the register Job pushes one `credential_config` per entry to
Certify, the API resolves a definition by matching it, and the Agent Portal shows
it in the type selector.

Two entries sharing a `config_id` break all three quietly:

  * the register Job POSTs both, the second overwriting the first in Certify, so
    the surviving credential_config is whichever the Job happened to send last;
  * the API's lookup returns the FIRST match, so the other definition becomes
    unreachable -- its view, claim columns and SVG are simply never used;
  * the selector shows two entries the agent cannot tell apart, and picking
    either issues the same credential.

Nothing errors. The registry just issues the wrong credential for one of the
types, which is why this is worth failing the install over: there is no
legitimate reason for two definitions to share an id.
*/}}

{{- define "openg2p-registry.validateVcDefinitions" -}}
{{- $defs := .Values.agentPortalApi.vcDefinitions | default list -}}
{{- $seen := dict -}}
{{- range $defs -}}
  {{- $id := .config_id | default "" -}}
  {{- if eq $id "" -}}
    {{- fail "\n\nERROR: an entry in agentPortalApi.vcDefinitions has no config_id.\n\nEvery credential definition needs one: it is the id registered with Certify\nand the value the Agent Portal sends as vc_type.\n" -}}
  {{- end -}}
  {{- if hasKey $seen $id -}}
    {{- fail (printf "\n\nERROR: agentPortalApi.vcDefinitions contains more than one entry with config_id %q.\n\nCredential ids must be unique. Duplicates do not error at runtime -- they\nsilently collide: the register Job overwrites one credential_config in Certify\nwith the other, the API only ever resolves the first, and the agent is offered\ntwo choices that issue the same credential.\n\nGive each definition its own config_id (and its own Certify credential_config).\n" $id) -}}
  {{- end -}}
  {{- $_ := set $seen $id true -}}
{{- end -}}
{{- end -}}
