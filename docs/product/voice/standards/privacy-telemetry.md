# Privacy and telemetry language

## Principle

Operational telemetry is not project content.

Keep the distinction explicit in product, support, and AI language.

## Allowed coarse telemetry categories

The current event dictionary uses coarse metadata such as:

- latency;
- format;
- result code;
- operation type;
- object counts;
- device class;
- recovery operation count;
- recoverable crash flag.

## Do not describe telemetry as collecting content when it does not

Avoid:

> We analyse your drawings to improve performance.

unless that becomes explicitly true and approved.

## Do not describe “no raw project content” as “no data”

Metadata is still data.

Prefer:

> This event records the result code and duration, not raw project geometry.

## Support diagnostics

A future support bundle must state:

- what it contains;
- whether project content is included;
- whether identifiers are included;
- where it is sent/stored;
- how the user reviews it before sharing, if supported.

## AI data language

“No training on private project data by default” is a policy claim. Do not strengthen it to “your data never leaves your device” unless the specific AI architecture makes that true.
