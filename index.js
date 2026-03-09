const path = require('path');

module.exports = (options = {}, context) => {
  return {
    name: 'vuepress-theme-plugin-small-tools',
    
    enhanceAppFiles: [
      path.resolve(__dirname, 'enhanceApp.js')
    ],
    
    clientRootMixin: path.resolve(__dirname, 'clientRootMixin.js')
  };
};
