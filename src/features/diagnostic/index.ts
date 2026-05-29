// Diagnostic engine — graph traversal, state management, computations, UI shell

// Engine (pure TypeScript, no React)
export {
  getCurrentNode,
  getNextNodeId,
  isTerminalNode,
  getProgress,
  getNodePath,
} from './engine/graph-traversal';

export type { DiagnosticProgress } from './engine/graph-traversal';

export {
  createInitialState,
  advanceState,
  setExtractedFields,
  markComplete,
  getAnswerForNode,
  canGoBack,
  goBack,
} from './engine/state-manager';

export { evaluateComputation } from './engine/computations';

// Hooks
export { useDiagnostic } from './hooks/use-diagnostic';
export type { UseDiagnosticReturn } from './hooks/use-diagnostic';
export { useDiagnosticPersistence } from './hooks/use-diagnostic-persistence';
