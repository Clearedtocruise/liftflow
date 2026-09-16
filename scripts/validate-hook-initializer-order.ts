/**
 * Guards against a render-time hook initialiser reading a binding declared further down the
 * component.
 *
 * The reported failure: "Cannot read property 'find' of undefined" on the error boundary when
 * starting a workout. ActiveWorkoutScreen seeded its Tabata config with
 * `useState(() => tabataConfigFromPlan(planExercises, ...))` while `const planExercises` was
 * declared a hundred lines below. A `useState` initialiser runs during the first render, so the
 * const did not exist yet and the plan arrived as undefined — every workout start crashed on the
 * `.find` inside that helper.
 *
 * `useState` and `useMemo` both run their callback immediately on render, unlike `useCallback` and
 * event handlers, whose bodies run later when every const is initialised. So only those two are
 * checked here.
 *
 * Usage: npm run validate:hook-initializer-order
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

/** Hooks whose callback argument runs during the render that creates it. */
const IMMEDIATE_HOOKS = new Set(['useState', 'useMemo']);

const repoRoot = join(__dirname, '..');

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
    } else if ((entry.endsWith('.tsx') || entry.endsWith('.ts')) && !entry.includes('.test.')) {
      found.push(full);
    }
  }
  return found;
}

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)
  );
}

/** The nearest function that owns `node`, which is the scope its consts live in. */
function enclosingFunction(node: ts.Node): ts.Node | undefined {
  let current = node.parent;
  while (current) {
    if (isFunctionLike(current)) return current;
    current = current.parent;
  }
  return undefined;
}

type Violation = {
  file: string;
  line: number;
  hook: string;
  name: string;
  declaredLine: number;
};

function findViolations(file: string): Violation[] {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];

  const lineOf = (pos: number) => source.getLineAndCharacterOfPosition(pos).line + 1;

  /** Every `const`/`let` name declared directly inside `fn`, with where it is initialised. */
  function bindingsIn(fn: ts.Node): Map<string, number> {
    const bindings = new Map<string, number>();
    const visit = (node: ts.Node) => {
      // A nested function has its own scope, and its body runs later.
      if (node !== fn && isFunctionLike(node)) return;
      if (ts.isVariableDeclarationList(node) && !(node.flags & ts.NodeFlags.Const) && !(node.flags & ts.NodeFlags.Let)) {
        return; // `var` hoists, so reading it early yields undefined rather than a crash we can pin here.
      }
      if (ts.isVariableDeclaration(node)) {
        const declarationStart = node.getStart(source);
        for (const name of namesOf(node.name)) bindings.set(name, declarationStart);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(fn, visit);
    return bindings;
  }

  function namesOf(name: ts.BindingName): string[] {
    if (ts.isIdentifier(name)) return [name.text];
    const collected: string[] = [];
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) collected.push(...namesOf(element.name));
    }
    return collected;
  }

  /** Identifiers actually read inside `node`, skipping property names and object keys. */
  function readsIn(node: ts.Node): ts.Identifier[] {
    const reads: ts.Identifier[] = [];
    const visit = (child: ts.Node) => {
      if (ts.isPropertyAccessExpression(child)) {
        visit(child.expression);
        return;
      }
      if (ts.isPropertyAssignment(child)) {
        visit(child.initializer);
        return;
      }
      if (ts.isIdentifier(child)) reads.push(child);
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return reads;
  }

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      IMMEDIATE_HOOKS.has(node.expression.text)
    ) {
      const hook = node.expression.text;
      const component = enclosingFunction(node);
      if (component) {
        const bindings = bindingsIn(component);
        const callStart = node.getStart(source);
        for (const read of readsIn(node)) {
          const declaredAt = bindings.get(read.text);
          if (declaredAt != null && declaredAt > callStart) {
            violations.push({
              file: file.replace(`${repoRoot}/`, ''),
              line: lineOf(read.getStart(source)),
              hook,
              name: read.text,
              declaredLine: lineOf(declaredAt),
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return violations;
}

console.log('\nThe reported failure: a workout will not start because a hook read a later const\n');

const violations = sourceFiles(join(repoRoot, 'src')).flatMap(findViolations);

for (const violation of violations) {
  console.log(
    `  FAIL — ${violation.file}:${violation.line} — ${violation.hook} reads "${violation.name}", ` +
      `declared below on line ${violation.declaredLine}`,
  );
}

if (violations.length === 0) {
  console.log('  PASS — no render-time hook initialiser reads a binding declared below it');
  console.log('\nAll hook initialiser order checks passed.\n');
  process.exit(0);
}

console.log(`\n${violations.length} hook initialiser order check(s) failed.\n`);
process.exit(1);
