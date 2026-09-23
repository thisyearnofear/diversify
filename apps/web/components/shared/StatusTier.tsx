import React from "react";

interface StatusTierProps {
  trust: React.ReactNode;
  transition?: React.ReactNode;
  rail?: React.ReactNode;
}

export function StatusTier({ trust, transition, rail }: StatusTierProps) {
  const slots: Array<[string, React.ReactNode]> = [
    ["trust", trust],
    ["transition", transition],
    ["rail", rail],
  ];
  return (
    <div data-testid="status-tier" className="space-y-2">
      {slots.map(([name, node]) =>
        node ? (
          <div key={name} data-status-slot={name}>
            {node}
          </div>
        ) : null,
      )}
    </div>
  );
}
