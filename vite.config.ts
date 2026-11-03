import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages phục vụ app tại https://buunq1977.github.io/okrs-kaizen/
export default defineConfig({
  base: '/okrs-kaizen/',
  plugins: [react()],
})
