/**
 * Node ESM loader: resolve extensionless relative imports to .ts for strip-types QA.
 */
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !specifier.endsWith(".ts") &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".json") &&
    !specifier.endsWith(".mjs") &&
    !specifier.endsWith(".cjs")
  ) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // fall through
    }
  }
  return nextResolve(specifier, context);
}
