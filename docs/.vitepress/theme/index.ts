import DefaultTheme from 'vitepress/theme'
import './custom.css'
import TrackkitPlayground from './components/TrackkitPlayground.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('TrackkitPlayground', TrackkitPlayground)
  },
}
