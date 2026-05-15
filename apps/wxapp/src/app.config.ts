export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/rooms/index',
    'pages/bills/index',
    'pages/apartments/index',
    'pages/settings/index',
    'pages/login/index',
    'pages/settings/leases',
    'pages/settings/organization',
    'pages/settings/account',
    'pages/settings/plan'
  ],
  tabBar: {
    color: '#71827b',
    selectedColor: '#146c5c',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/rooms/index', text: '房间' },
      { pagePath: 'pages/bills/index', text: '账单' },
      { pagePath: 'pages/apartments/index', text: '公寓' },
      { pagePath: 'pages/settings/index', text: '更多' }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0f4f45',
    navigationBarTitleText: 'Tenant Hub',
    navigationBarTextStyle: 'white'
  }
});
