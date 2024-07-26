# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list


### NOTES 

#### Setup 

##### Init

This template was generated with 

```sh
pnpm create @vite-pwa/pwa . --template react-ts
```

And selecting the default options.


##### Shadcn

Installed following the documentation here. 
https://ui.shadcn.com/docs/installation/vite

On step (7), the shadcn installer, 
I selected all the default _except_ server components. 

### Troubleshooting

#### Firefox no-show

Issue: Connection hangs with nothing rendered.

Solution: Switching the port `packages.json`
```json 
{
  ...
  "scripts": {
    "dev" : "vite --port 8888",
    ...
  },
  ...
}
```


