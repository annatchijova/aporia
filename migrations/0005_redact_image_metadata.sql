UPDATE proposals
SET artifact_json = json_remove(
  json_set(artifact_json, '$.content', '', '$.contentHash', ''),
  '$.mimeType',
  '$.byteLength'
)
WHERE json_extract(artifact_json, '$.kind') = 'image';
