import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local development uses the root path. GitHub Pages builds automatically
// use the repository subpath, avoiding the starter's placeholder base URL.
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  plugins: [react()],
  base,
});
