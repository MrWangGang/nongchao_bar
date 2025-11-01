// pages/开发中页面/index.js

Page({
  onShow: function () {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          // 这里的索引要与你在 custom-tab-bar/index.js 中 list 数组的索引对应
          // 菜单是索引 2
          this.getTabBar().setData({
              selected: 2
          })
      }
  },
  
  /**
   * 清空所有本地缓存的逻辑
   */
  goToHome() {
      const that = this;
      
      wx.showModal({
          title: '确认清空缓存',
          content: '确定要清空小程序的所有本地缓存吗？这可能导致部分数据丢失。',
          confirmText: '确定清空',
          confirmColor: '#FF0000', // 使用红色强调危险操作
          success(res) {
              if (res.confirm) {
                  try {
                      // 清空所有本地缓存
                      wx.clearStorageSync();
                      
                      wx.showToast({
                          title: '缓存已清空',
                          icon: 'success',
                          duration: 1500
                      });
                      
                      // 建议清空后跳转回首页或重新启动，以便刷新数据
                      wx.reLaunch({
                          url: '/pages/index/index'
                      });
                      
                  } catch (e) {
                      wx.showToast({
                          title: '清空失败',
                          icon: 'none',
                          duration: 2000
                      });
                      console.error('清空缓存失败', e);
                  }
              }
          }
      });
  }
});