## Code Review: `feat/add-document-extraction-endpoint`

This is a useful first pass because you proved the happy path quickly, but it is not merge-ready yet. The main problems are around security, data handling, and operational safety rather than style. I want you to keep the momentum from this PR, but the next revision needs to separate "it worked once locally" from "this is safe and supportable in a backend service."

**Line 7**

```ts
const client = new Anthropic({ apiKey: 'sk-ant-REDACTED' });
```

Hardcoded secrets are a stop-ship issue. Even if the key was redacted before review, the coding pattern is still unsafe. Load secrets from environment variables through a config module and fail fast at startup when they are missing. If a real key ever lived in this file, rotate it immediately.

**Lines 7 and 21**

```ts
const client = new Anthropic({ apiKey: 'sk-ant-REDACTED' });
model: 'claude-opus-4-6',
```

The model choice is not justified. Opus is the most expensive Claude tier, and this task is structured extraction, not open-ended reasoning. Starting with the most expensive model without evidence is a product risk, not a code detail. Use a configurable model and default to the cheapest model that meets accuracy targets.

**Line 13**

```ts
const fileData = fs.readFileSync(file.path);
```

This blocks the Node event loop. One slow disk read stalls unrelated requests handled by the same process. Use async file APIs so the route does not serialize concurrent traffic behind synchronous I/O.

**Lines 15-16**

```ts
const savedPath = path.join('./uploads', file.originalname);
fs.copyFileSync(file.path, savedPath);
```

This is a serious data-handling problem. You are writing potentially sensitive maritime identity and medical documents to disk with predictable names, no cleanup, no retention policy, and no access control. That creates privacy risk immediately. If the file does not need to persist, keep it in memory. If it does, use generated names and controlled storage.

**Route section around `req.file`**

There is no file type validation before the content is read and sent to the model. The handler should reject unsupported or unsafe MIME types before doing any disk or model work. Without that check, the endpoint will accept arbitrary input and waste money on files the provider cannot handle correctly.

**Prompt text block**

```ts
text: 'Extract all information from this maritime document and return as JSON.',
```

This prompt is too vague to support reliable downstream parsing. There is no schema, no taxonomy, no null-handling rule, and no definition of what "all information" means across passports, certificates, and medical records. The result will drift by document type and by model run. If the backend needs structured data, the prompt needs to define the structure explicitly.

**Anthropic call**

There is no timeout on the LLM request. If the provider stalls or the network hangs, this request can sit open indefinitely. External calls need a fixed timeout and a failure path that distinguishes provider issues from parsing issues.

**Line 27**

```ts
const result = JSON.parse(response.content[0].text);
```

This assumes the LLM always returns clean JSON. In practice, responses often include preamble text, markdown fences, or malformed JSON. When parse fails here, the outer catch converts it into a generic 500 and the raw model output is lost. Preserve the raw response first, then run a controlled JSON extraction and repair step.

**Lines 28-29**

```ts
global.extractions = global.extractions || [];
global.extractions.push(result);
```

`global` is not application storage. The data disappears on restart, cannot be queried, and breaks the moment you run more than one process. This needs to be stored in the database with IDs, timestamps, and status so later features such as deduplication, job polling, and session reporting are even possible.

Teaching moment: whenever one route is handling file I/O, external API calls, parsing, and persistence all at once, hidden failures get harder to isolate and easier to ship. Split the flow into layers early. The code gets easier to test, and production bugs stop being mysteries.
