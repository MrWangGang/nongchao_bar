// pages/home/home.js
const app = getApp(); // 在文件顶部获取 app 实例

Page({
    data: {
        statusBarHeight: 0,
        menuButtonHeight: 0,
        userInfo: null, // 存储用户信息
        // 移除了所有默认头像相关的变量
    },
    
    onLoad(options) {
        // 注册全局登录回调, this.loadData 将在登录成功后被 app.js 调用
        app.registerPageUpdateCallback(this.loadData.bind(this));

        // 页面首次加载时直接加载用户数据
        this.loadData();
        
        // 获取设备信息以定位自定义导航栏 (保持不变)
        try {
            const systemInfo = wx.getSystemInfoSync();
            const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
            this.setData({
                statusBarHeight: systemInfo.statusBarHeight,
                menuButtonHeight: menuButtonInfo.height,
            })
        } catch(e) {
            console.error('获取系统信息失败', e);
        }
    },

        /**
     * @function reserve
     * @description 预订处理函数，接收 data-item-title 并存入全局状态
     * @param {Object} e - 事件对象，通过 data-item-title 传入值
     */
    reserve: function(e) {
      // 接收 WXML 中 data-item-title 传入的值
      const item = e.currentTarget.dataset.item; 
      wx.navigateTo({ url: `/pages/index/reserve/index?item=${item}`
    });
      // 在此处执行实际的预订或跳转逻辑
  },

  reserveQuery:function(e) {
    wx.navigateTo({ url: `/pages/index/orders/index`
  });
},


    // 加载本页面所需的用户数据
    loadData() {
        const userInfo = wx.getStorageSync('userInfo');
        // 关键：检查缓存中是否有数据，以及关键字段（name, avatar）是否存在
        if (userInfo && userInfo.name && userInfo.avatar) {
            this.setData({
                userInfo: userInfo,
            });
        } else {
            // 如果缓存中没有，或者数据不完整，强制设置 userInfo 为 null
            this.setData({
                userInfo: null
            });
            console.log('用户未登录或用户信息不完整，请引导用户登录。');
        }
    },

    // 点击头像/卡片区域，用于刷新或检查状态 (保留示例)
    onMemberCardClick() {
        if (!this.data.userInfo) {
            wx.showToast({
                title: '请先完成登录',
                icon: 'none'
            });
            // 示例：跳转到登录页
            // wx.navigateTo({ url: '/pages/login/login' });
        }
    },

    onShow() {
        // TabBar 逻辑保持不变
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({
                selected: 0,
            });
        }
        
        // 确保从其他页面返回时数据能刷新（例如从登录页返回）
        this.loadData();
    },
})