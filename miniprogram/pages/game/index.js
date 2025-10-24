// pages/开发中页面/index.js

Page({
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      // 这里的索引要与你在 custom-tab-bar/index.js 中 list 数组的索引对应
      // 菜单是索引 1
      this.getTabBar().setData({
        selected: 2 
      })
    }
  },
  goToHome() {
    // 假设您的首页路径是 /pages/index/index
    wx.switchTab({
      url: '/pages/index/index',
      fail: () => {
        // 如果当前页面不是 TabBar 页面，或者 switchTab 失败
        wx.reLaunch({
          url: '/pages/index/index'
        });
      }
    });
  }
});