import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const requireScrollableTable = {
  meta: {
    type: "problem",
    docs: {
      description: "Require raw tables to be wrapped in an overflow-x-auto div",
    },
    schema: [],
    messages: {
      missingWrapper:
        "Wrap this table in <div className=\"overflow-x-auto\"> to contain horizontal scrolling on narrow screens.",
    },
  },
  create(context) {
    const componentUsages = new Map();
    const tablesToCheck = [];

    const hasScrollableWrapper = (node) => {
      let ancestor = node.parent;

      while (ancestor) {
        if (
          ancestor.type === "JSXElement" &&
          ancestor.openingElement.name.type === "JSXIdentifier"
        ) {
          const className = ancestor.openingElement.attributes.find(
            (attribute) =>
              attribute.type === "JSXAttribute" &&
              attribute.name.name === "className" &&
              attribute.value?.type === "Literal" &&
              typeof attribute.value.value === "string" &&
              attribute.value.value.split(/\s+/).includes("overflow-x-auto"),
          );

          if (className) return true;
        }

        ancestor = ancestor.parent;
      }

      return false;
    };

    const getEnclosingComponentName = (node) => {
      let ancestor = node.parent;

      while (ancestor) {
        if (
          ancestor.type === "FunctionDeclaration" &&
          ancestor.id?.name?.[0] === ancestor.id.name[0]?.toUpperCase()
        ) {
          return ancestor.id.name;
        }

        ancestor = ancestor.parent;
      }

      return null;
    };

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;

        if (node.name.name === "table") {
          if (!hasScrollableWrapper(node)) {
            tablesToCheck.push({
              node,
              componentName: getEnclosingComponentName(node),
            });
          }
          return;
        }

        if (node.name.name[0] === node.name.name[0]?.toUpperCase()) {
          const usages = componentUsages.get(node.name.name) || [];
          usages.push(hasScrollableWrapper(node));
          componentUsages.set(node.name.name, usages);
        }
      },
      "Program:exit"() {
        tablesToCheck.forEach(({ node, componentName }) => {
          const usages = componentName && componentUsages.get(componentName);
          if (usages?.length && usages.every(Boolean)) return;

          context.report({ node, messageId: "missingWrapper" });
        });
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      local: {
        rules: {
          "require-scrollable-table": requireScrollableTable,
        },
      },
    },
    rules: {
      "local/require-scrollable-table": "error",
    },
  },
]);

export default eslintConfig;
