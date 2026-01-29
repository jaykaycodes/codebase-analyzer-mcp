---
name: trace
description: Trace data flow through a codebase
user-invocable: true
---

# Trace Dataflow

Trace how data flows from an entry point through the system.

## Usage

```
/trace <from> [options]
```

**Arguments:**
- `from` - Entry point (function name, file, or description)

**Options:**
- `--to <destination>` - Trace to specific destination
- `--source <path>` - Repository path (default: current directory)

## Examples

```bash
# Trace from user login
/trace "user login"

# Trace from specific function to database
/trace processPayment --to database

# Trace API endpoint
/trace "POST /api/users"

# Trace in specific repo
/trace checkout --source ./ecommerce-app
```

## Workflow

1. **Identify entry point** from user input
2. **Run trace** using dataflow-tracer agent
3. **Map transformations** at each step
4. **Identify risks** and security concerns

## Implementation

```javascript
const from = args.from;
const to = args.to;
const source = args.source || ".";

Task("dataflow-tracer", {
  prompt: `Trace data flow from "${from}"${to ? ` to "${to}"` : ""} in ${source}`
});
```

## Output

Returns dataflow analysis with:
- Step-by-step trace through the system
- Data transformations at each point
- Security observations
- Trust boundary crossings
