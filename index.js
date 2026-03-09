const { resolve } = require('path');

module.exports = (options = {}, context) => {
  return {
    name: 'vuepress-plugin-small-tools',
    
    enhanceAppFiles: [
      resolve(__dirname, 'enhanceApp.js')
    ],
    
    clientConfigFile: resolve(__dirname, './client.js').replace(/\\/g, '/')
  };
};
