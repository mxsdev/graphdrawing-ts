import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      assert: 'rollup-plugin-node-polyfills/polyfills/assert',
      util: 'rollup-plugin-node-polyfills/polyfills/util',
    }
  }
})
