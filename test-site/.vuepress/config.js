module.exports = {
  title: 'VuePress 工具集合',
  description: '一站式工具集合',
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '所有工具', link: '/tools' }
    ],
    sidebar: {
      '/tools': 'auto',
      '/': [
        {
          title: '导航',
          collapsable: false,
          children: [
            ['/', '首页'],
            ['/tools', '所有工具']
          ]
        }
      ]
    },
    sidebarDepth: 2
  },
  plugins: [
    ['vuepress-plugin-small-tools']
  ]
};
