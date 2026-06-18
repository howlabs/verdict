#!/usr/bin/env python3
# ponytail: stdlib ast mutants; upgrade to mutmut/Stryker if coverage matters
"""Emit JSON list of single-site mutants: [{rule, source}, ...]"""

import ast
import copy
import json
import sys

FLIP_CMP = {
    ast.Lt: ast.LtE,
    ast.LtE: ast.Lt,
    ast.Gt: ast.GtE,
    ast.GtE: ast.Gt,
    ast.Eq: ast.NotEq,
    ast.NotEq: ast.Eq,
    ast.Is: ast.IsNot,
    ast.IsNot: ast.Is,
    ast.In: ast.NotIn,
    ast.NotIn: ast.In,
}


def _key(node):
    return (getattr(node, "lineno", 0), getattr(node, "col_offset", 0), type(node).__name__)


class _Point:
    __slots__ = ("kind", "key", "idx")

    def __init__(self, kind, node, idx=0):
        self.kind = kind
        self.key = _key(node)
        self.idx = idx


class _Find(ast.NodeVisitor):
    def __init__(self):
        self.points = []

    def visit_Compare(self, node):
        for i, op in enumerate(node.ops):
            if type(op) in FLIP_CMP:
                self.points.append(_Point("compare", node, i))
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        if isinstance(node.op, (ast.And, ast.Or)):
            self.points.append(_Point("boolop", node))
        self.generic_visit(node)

    def visit_Constant(self, node):
        if isinstance(node.value, bool):
            self.points.append(_Point("const", node))
        self.generic_visit(node)


class _Apply(ast.NodeTransformer):
    def __init__(self, point):
        self.point = point

    def visit_Compare(self, node):
        node = self.generic_visit(node)
        if self.point.kind != "compare" or _key(node) != self.point.key:
            return node
        ops = list(node.ops)
        ops[self.point.idx] = FLIP_CMP[type(ops[self.point.idx])]()
        return ast.Compare(left=node.left, ops=ops, comparators=node.comparators)

    def visit_BoolOp(self, node):
        node = self.generic_visit(node)
        if self.point.kind != "boolop" or _key(node) != self.point.key:
            return node
        op = ast.Or() if isinstance(node.op, ast.And) else ast.And()
        return ast.BoolOp(op=op, values=node.values)

    def visit_Constant(self, node):
        if self.point.kind != "const" or _key(node) != self.point.key:
            return node
        return ast.Constant(value=not node.value)


def list_mutants(source, limit=12):
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []
    finder = _Find()
    finder.visit(tree)
    out = []
    for pt in finder.points:
        if len(out) >= limit:
            break
        new_tree = _Apply(pt).visit(copy.deepcopy(tree))
        ast.fix_missing_locations(new_tree)
        try:
            mutated = ast.unparse(new_tree)
        except Exception:
            continue
        if mutated == source:
            continue
        if pt.kind == "compare":
            rule = f"compare:{pt.idx}"
        elif pt.kind == "boolop":
            rule = "boolop:and_or"
        else:
            rule = "const:bool"
        out.append({"rule": rule, "source": mutated})
    return out


def main():
    if len(sys.argv) < 3 or sys.argv[1] != "list":
        print("[]")
        return
    path = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    with open(path, encoding="utf-8") as f:
        source = f.read()
    print(json.dumps(list_mutants(source, limit)))


if __name__ == "__main__":
    main()