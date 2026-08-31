/**
 * InstrumentShell — tab layout for the object + inspector + status line.
 *
 * Tabs are instruments, not card stacks. This shell is the only permitted
 * vertical structure: the object (first viewport), an optional inspector
 * bound to selection, and a quiet status/transition line. Do not pass a
 * list of feature modules as children.
 */

import React from "react";

interface InstrumentShellProps {
  /** The manipulable object — ring, dial, ticket, picker. */
  object: React.ReactNode;
  /** Selection-bound inspector. Render `InspectorSheet`; closed when idle. */
  inspector?: React.ReactNode;
  /** Quiet status / trust / transition — one line, not a product. */
  status?: React.ReactNode;
  className?: string;
}

export function InstrumentShell({
  object,
  inspector,
  status,
  className = "",
}: InstrumentShellProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <div className="min-h-0">{object}</div>
      {inspector}
      {status ? <div className="mt-3">{status}</div> : null}
    </div>
  );
}

export default InstrumentShell;
