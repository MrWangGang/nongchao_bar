// pages/home/home.js
const app = getApp(); // 在文件顶部获取 app 实例

Page({
    data: {
        statusBarHeight: 0,
        menuButtonHeight: 0,
        userInfo: null, // 存储用户信息
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
     */
    reserve: function(e) {
      // 接收 WXML 中 data-item-title 传入的值
      const item = e.currentTarget.dataset.item; 
      wx.navigateTo({ url: `/pages/index/reserve/index?item=${item}`});
      // 在此处执行实际的预订或跳转逻辑
    },

    reserveQuery:function(e) {
      wx.navigateTo({ url: `/pages/index/orders/index`});
    },


    /**
     * @function loadData
     * @description 加载本页面所需的用户数据，如果已登录则从云端刷新数据
     */
    loadData() {
        const localUserInfo = wx.getStorageSync('userInfo');
        
        // 1. 检查缓存中是否有数据，以及关键字段（name, avatar）是否存在 (判断是否登录)
        const isUserLoggedIn = (localUserInfo && localUserInfo.name && localUserInfo.avatar);

        if (isUserLoggedIn) {
            // A. 已登录：先设置本地缓存数据，实现页面快速显示
            this.setData({
                userInfo: localUserInfo,
            });
            
            // B. ⭐ 只有已登录时，才调用云函数获取最新数据
            wx.cloud.callFunction({
                name: 'getLatestUserInfo', // 调用获取最新用户信息的云函数
                data: {
                    // 传递 _id 加速云端查询
                    userId: localUserInfo._id || null 
                },
                success: res => {
                    if (res.result && res.result.success && res.result.userInfo) {
                        const latestUserInfo = res.result.userInfo;

                        // 1. 将最新的数据存回缓存
                        wx.setStorageSync('userInfo', latestUserInfo);

                        // 2. 更新页面 data
                        this.setData({
                            userInfo: latestUserInfo,
                        });
                        console.log('用户信息已从云端刷新并更新。');
                    } else {
                        console.error('云函数返回失败或数据格式错误', res.result ? res.result.errMsg : '未知错误');
                        // 即使云端刷新失败，仍保留本地数据显示
                    }
                },
                fail: err => {
                    console.error('调用云函数 getLatestUserInfo 失败', err);
                }
            });
            
        } else {
            // C. 未登录或数据不完整，设置 userInfo 为 null，不进行云端查询
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