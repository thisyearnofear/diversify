import React from 'react';

/** The small ringed circle overlapping a coin's bottom-right — a flag
 *  mint-mark on the stage, a ✓ seal on a settled destination. */
export function MintMark({
    className = '',
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <span
            aria-hidden
            className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ring-1 ${className}`}
        >
            {children}
        </span>
    );
}
