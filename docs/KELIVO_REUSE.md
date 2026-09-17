# Kelivo compatibility and reuse

Reference: local /Users/neo/Developer/kelivo (Flutter/Dart, AGPL-3.0).

Echo Home keeps its native SwiftUI client, React web client, and Node/SQLite server.
The Dart providers depend on Flutter Provider and Drift and cannot be imported into these runtimes.

Directly reused under AGPL-3.0: Chinese memory extraction and gate prompts from
lib/core/services/memory/memory_prompts.dart, vendored unchanged with the upstream license.
The server combines the upstream gate guidance and extraction rules in one model request, and appends a JSON output adapter and Echo's memory categories. Extraction, merge,
source references, instruction templates, and per-conversation configuration follow Kelivo's
existing workflow, adapted to server ownership and one Echo. No Flutter runtime is embedded.

MCP uses the official @modelcontextprotocol/sdk 1.x (MIT), including Streamable HTTP,
legacy SSE and stdio transports. Documentation: https://ts.sdk.modelcontextprotocol.io/client
Attachments use mammoth for DOCX and pdf-parse for PDF; plain text and image bytes are
preserved. iOS uses PhotosUI, UIImagePickerController, AVFoundation and Speech; Web uses
browser recording and speech APIs plus server ASR/TTS endpoints. Their availability is
reported rather than substituting fake transcripts or audio.

Vectors are an extension to the inspected Kelivo memory pipeline: real provider embeddings,
text/model fingerprint invalidation, hybrid retrieval, and server-persisted provenance.
This repository is used privately; preserve the accompanying license and notices when reusing
these adapted components. Review distribution terms separately if publishing later.
