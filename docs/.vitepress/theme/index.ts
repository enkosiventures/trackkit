import DefaultTheme from 'vitepress/theme'
import TrackkitPlayground from './components/TrackkitPlayground.vue'

export default {
  ...DefaultTheme,
  enhanceApp({ app }) {
    app.component('TrackkitPlayground', TrackkitPlayground)
  },
}
