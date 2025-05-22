import importPlugin from "eslint-plugin-import";

export default [
    {
        // Specify which files this config applies to.
        files: ["**/*.js"],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module"
            },
            // Replace env: { node: true } with Node globals.
            globals: {
                module: "readonly",
                require: "readonly",
                process: "readonly",
                __dirname: "readonly"
            }
        },
        plugins: {
            import: importPlugin,
        },
        // Instead of "extends", flat config uses "rules" directly,
        // but you can also use recommended configs via plugins if needed.
        rules: {
            "import/no-unresolved": "error",
            // Add any additional rules here...
        },
        settings: {
            "import/resolver": {
                node: {
                    extensions: [".js", ".jsx", ".ts", ".tsx"],
                },
            },
        },
    },
];