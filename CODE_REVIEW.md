## Code Review: feat/add-document-extraction-endpoint

Good first pass at getting something working end-to-end. The instinct to validate the file early and wrap the handler in try/catch is right. The problems here are not cosmetic, though. Several of them are the kind of thing that causes a production incident or a security finding, so I want to walk through them before this merges.

---

**Line 7: hardcoded API key**

```ts
const client = new Anthropic({ apiKey: 'sk-ant-REDACTED' });
```

This is the most urgent thing to fix. Even redacted before review, the pattern of putting a secret in source code is dangerous, because it means the development habit is wrong. If a real key ever lands here and gets committed, it is compromised immediately regardless of who has access to the repo. Secrets belong in environment variables, loaded through centralized config at startup. The key should be `process.env.ANTHROPIC_API_KEY` or equivalent, and the service should refuse to start if it is missing.

---

**Model selection**

`claude-opus-4-6` is the most expensive model in the Claude lineup, roughly 15 times the cost of Haiku per token. For structured document extraction with a fixed output schema, there is no demonstrated reason to start there. Model selection should be a justified decision tied to accuracy requirements, not a default to the most capable option. Start with Haiku, measure whether it meets accuracy requirements on your real documents, and escalate only if there is evidence it falls short. Unconstrained model choice here would make this service economically unviable at any real volume.

---

**Line 13: synchronous file read**

```ts
const fileData = fs.readFileSync(file.path);
```

`readFileSync` blocks the event loop for the duration of the disk read. Every other request the process is handling waits. For a file upload route, this gets noticeable quickly under any real concurrency. Use `fs.promises.readFile` or `fs.createReadStream` instead.

---

**Lines 16-17: permanent file storage with predictable names**

```ts
const savedPath = path.join('./uploads', file.originalname);
fs.copyFileSync(file.path, savedPath);
```

Maritime documents frequently contain PII: passport photos, medical data, national ID numbers. Saving them to disk at a predictable path derived from the original filename creates a permanent store of sensitive data with no retention policy, no access control, and paths that are easy to enumerate. In production, uploaded files should either be processed in memory and discarded, or stored in controlled object storage with generated names, explicit lifecycle rules, and restricted access. This is a privacy and security problem, not just a cleanup issue.

---

**No file type validation**

The handler accepts whatever `req.file` contains. A production extraction endpoint should reject anything that is not jpeg, png, or pdf before processing, both to protect cost and to prevent the LLM from receiving arbitrary file types. Validate MIME type and size at the middleware layer, not inside the handler.

---

**Prompt**

```ts
text: 'Extract all information from this maritime document and return as JSON.'
```

This prompt gives the LLM no schema, no document taxonomy, no field names, and no null-handling instructions. The output will vary by document type, by run, and by model version. When you go to parse and store the result, you will find a different JSON shape for every document you tested. A production extraction prompt needs a defined response contract: required keys, optional fields, a document type taxonomy, and explicit instructions about what to return when a field is absent. The prompt is where consistency is enforced, and right now there is none.

---

**No timeout on the LLM call**

If Anthropic's API is slow or the network stalls, this request hangs indefinitely. One slow response ties up a worker for minutes. Every external call needs a timeout and a clear failure path. Set a 30-second `AbortSignal` on the fetch and handle the timeout case explicitly, not through the generic catch.

---

**Lines 27-29: JSON parse without a fallback**

```ts
const result = JSON.parse(response.content[0].text);
```

LLM responses frequently include markdown fences, preamble text, or truncated JSON. `JSON.parse` will throw on any of those. Right now that falls into the outer catch, returns a generic 500, and discards the original model output permanently. You need to preserve the raw response regardless of whether parsing succeeds, because it is the only thing you can use to debug or repair the failure. Extract JSON from the raw string first, attempt to parse, and on failure store the raw response with a FAILED status before returning an error.

---

**Lines 31-33: global state**

```ts
global.extractions = global.extractions || [];
global.extractions.push(result);
```

Data on `global` disappears on process restart, is not queryable, and breaks immediately if there is more than one server instance. This has to go into the database with an ID, a session reference, timestamps, and a status field. That is the only way polling, deduplication, session listing, and retry logic can work. There is no path from `global.extractions` to those features.

---

**Teaching moment**

The reason so many of these problems cluster together is that the handler is doing everything: reading a file, saving it, calling an external API, parsing the response, and persisting the result. When one function is responsible for that many things, there is no layer where you can add a timeout, a retry, a fallback, or a different storage strategy without touching everything else.

The way out is to split the flow into stages with defined responsibilities: validate the input, hand the file buffer to an extraction service, let the service call the provider and handle failures, and let a storage layer decide where the result goes. Each stage can be tested independently. Each can be changed without touching the others. That structure is what makes the handler code simple, even as the system gets more complex.