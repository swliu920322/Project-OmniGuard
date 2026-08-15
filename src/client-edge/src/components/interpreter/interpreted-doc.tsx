/**
 * Content Interpreter — thin app-side adapter.
 *
 * The render engine lives in @omnidocs/interpreter (one engine, N parameter
 * sets). This file only re-exports the pieces the demo needs, so OmniGuard's
 * business layer touches the package surface, never the engine internals.
 */
export { Interpret, getPreset, FORM_PRESETS } from '@omnidocs/interpreter';
export type { FormSpec, FormKey } from '@omnidocs/interpreter';