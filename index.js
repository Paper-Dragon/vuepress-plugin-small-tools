import { getDirname, path } from 'vuepress/utils'

const __dirname = getDirname(import.meta.url)

export default (options = {}) => {
  return {
    name: 'vuepress-plugin-small-tools',
    
    clientConfigFile: path.resolve(__dirname, './client.js'),
  }
}
