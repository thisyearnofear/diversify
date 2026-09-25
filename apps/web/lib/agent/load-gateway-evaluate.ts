/**
 * Server-only loader for the AI SDK Gateway evaluator.
 *
 * `ai` is ESM-only. A literal `await import('ai')` here keeps the specifier
 * visible to the file tracer/bundler (`ai` stays in serverExternalPackages).
 * Callers in packages/shared can't do this — that package compiles to
 * CommonJS, where `import('ai')` becomes an incompatible `require('ai')` —
 * so the shared services take an `evaluateGateway` injection instead and the
 * route passes this loader's result in.
 */
export async function loadGatewayEvaluate(): Promise<(...args: any[]) => Promise<any>> {
    const sdk = await import('ai');
    if (!sdk.experimental_evaluate) {
        throw new Error('AI SDK experimental_evaluate is unavailable');
    }
    return sdk.experimental_evaluate;
}
