import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../src/", import.meta.url));
function walk(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(resolve(folder, entry.name))
      : [resolve(folder, entry.name)],
  );
}
const files = walk(root);
const moduleOf = (file: string) =>
  relative(root, file).match(/^modules\/([^/]+)\//)?.[1];
interface Edge {
  target: string;
  runtime: boolean;
}
const graph = new Map<string, Edge[]>();
const clientRoots: string[] = [];
const sources = new Map<string, string>();
function targetOf(specifier: string, file: string): string | undefined {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return;
  const path = specifier.startsWith("@/")
    ? resolve(root, specifier.slice(2))
    : resolve(dirname(file), specifier);
  const clean = path.split("?")[0];
  const target = [
    clean,
    `${clean}.ts`,
    `${clean}.tsx`,
    `${clean}/index.ts`,
    `${clean}/index.tsx`,
  ].find((candidate) => existsSync(candidate) && files.includes(candidate));
  assert.ok(
    target,
    `Unresolved import ${specifier} in ${relative(root, file)}`,
  );
  return target;
}
function parse(source: string, file: string, key = file) {
  const edges: Edge[] = [];
  sources.set(key, source);
  graph.set(key, edges);
  const add = (specifier: string, runtime = true) => {
    const target = targetOf(specifier, file);
    if (target) edges.push({ target, runtime });
  };
  const ast = ts.createSourceFile(
    file + ".ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const onlyTypes =
        clause?.phaseModifier === ts.SyntaxKind.TypeKeyword ||
        (!clause?.name &&
          named &&
          ts.isNamedImports(named) &&
          named.elements.length > 0 &&
          named.elements.every((item) => item.isTypeOnly));
      add(node.moduleSpecifier.text, !onlyTypes);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      add(node.moduleSpecifier.text, !node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      add(node.argument.literal.text, false);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (extname(file) === ".astro") {
    parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "", file);
    let count = 0;
    for (const script of source.matchAll(
      /<script\b[^>]*>([\s\S]*?)<\/script>/g,
    )) {
      const key = `${file}#client${count++}`;
      parse(script[1], file, key);
      clientRoots.push(key);
    }
  } else if ([".ts", ".tsx"].includes(extname(file))) {
    parse(source, file);
    if (
      extname(file) === ".tsx" ||
      /\/modules\/[^/]+\/(hooks|providers)\//.test(file)
    )
      clientRoots.push(file);
  } else if (extname(file) === ".css") {
    const edges: Edge[] = [];
    for (const match of source.matchAll(/@import\s+["']([^"']+)["']/g)) {
      const target = targetOf(match[1], file);
      if (target) edges.push({ target, runtime: true });
    }
    graph.set(file, edges);
  }
}
const allowed: Record<string, string[]> = {
  LandingModule: ["UIModule", "LangModule"],
  TransportModule: ["UIModule", "LangModule", "CoreModule", "RealtimeModule"],
  UIModule: [],
  CoreModule: [],
  LangModule: ["UIModule"],
  SiteModule: ["UIModule", "LangModule"],
  ContentModule: ["UIModule", "LangModule"],
  AuthModule: ["CoreModule", "UIModule", "LangModule"],
  AdsModule: ["UIModule", "LangModule"],
  RealtimeModule: [],
};

test("modules have explicit one-way dependencies, no pages and no hidden application imports", () => {
  assert.deepEqual(
    readdirSync(resolve(root, "modules")).sort(),
    Object.keys(allowed).sort(),
  );
  for (const file of files)
    assert.ok(!/modules\/[^/]+\/pages\//.test(relative(root, file)), file);
  for (const [source, edges] of graph) {
    const owner = moduleOf(source);
    if (!owner) continue;
    for (const { target } of edges) {
      const dependency = moduleOf(target);
      if (dependency && dependency !== owner)
        assert.ok(
          allowed[owner].includes(dependency),
          `${owner} cannot depend on ${dependency}: ${source}`,
        );
      if (!dependency) {
        assert.ok(
          !["UIModule", "LangModule", "CoreModule", "RealtimeModule"].includes(
            owner,
          ),
          `${owner} must not depend on application files: ${target}`,
        );
        assert.ok(
          /^config\/(site|routes|ads)\.ts$/.test(relative(root, target)),
          `Module imports application composition: ${source} -> ${target}`,
        );
      }
    }
  }
});

test("module dependency graph including configuration bridges has no cycles", () => {
  const dependencies = new Map(
    Object.keys(allowed).map((module) => [module, new Set<string>()]),
  );
  for (const [file, edges] of graph) {
    const owner = moduleOf(file);
    if (!owner) continue;
    const visited = new Set<string>();
    const collect = (target: string) => {
      if (visited.has(target)) return;
      visited.add(target);
      const dependency = moduleOf(target);
      if (dependency) {
        if (owner !== dependency) dependencies.get(owner)!.add(dependency);
        return;
      }
      for (const edge of graph.get(target) ?? []) collect(edge.target);
    };
    edges.forEach((edge) => collect(edge.target));
  }
  const visit = (module: string, path: string[]) => {
    assert.ok(
      !path.includes(module),
      `Module cycle: ${[...path, module].join(" -> ")}`,
    );
    for (const next of dependencies.get(module) ?? [])
      visit(next, [...path, module]);
  };
  for (const module of dependencies.keys()) visit(module, []);
});

test("browser scripts, hooks and public providers never import server code transitively", () => {
  const visit = (file: string, path: string[], visited: Set<string>) => {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(
      !relative(root, file).split("/").includes("server"),
      `Server code in browser: ${[...path, file].map((item) => relative(root, item)).join(" -> ")}`,
    );
    const source = sources.get(file) ?? "";
    // Module server secrets must remain behind the explicit server/ boundary.
    assert.ok(!/["']astro:env\/server["']/.test(source), file);
    for (const edge of graph.get(file) ?? [])
      if (edge.runtime) visit(edge.target, [...path, file], visited);
  };
  for (const file of clientRoots) visit(file, [], new Set());
});
