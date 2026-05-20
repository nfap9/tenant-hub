export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/rooms/index',
    'pages/bills/index',
    'pages/apartments/index',
    'pages/apartments/detail',
    'pages/apartments/form',
    'pages/apartments/expense',
    'pages/apartments/room-form',
    'pages/apartments/room-batch',
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
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: 'assets/tabbar/home-normal.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/rooms/index',
        text: '房间',
        iconPath: 'assets/tabbar/room-normal.png',
        selectedIconPath: 'assets/tabbar/room-selected.png'
      },
      {
        pagePath: 'pages/bills/index',
        text: '账单',
        iconPath: 'assets/tabbar/bill-normal.png',
        selectedIconPath: 'assets/tabbar/bill-selected.png'
      },
      {
        pagePath: 'pages/apartments/index',
        text: '公寓',
        iconPath: 'assets/tabbar/apartment-normal.png',
        selectedIconPath: 'assets/tabbar/apartment-selected.png'
      },
      {
        pagePath: 'pages/settings/index',
        text: '更多',
        iconPath: 'assets/tabbar/settings-normal.png',
        selectedIconPath: 'assets/tabbar/settings-selected.png'
      }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0f4f45',
    navigationBarTitleText: 'Tenant Hub',
    navigationBarTextStyle: 'white'
  }
});
