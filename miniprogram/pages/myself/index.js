// my_page.js
const app = getApp();

Page({
    data: {
        // 确保使用正确的大小写（wx.getUserProfile获取的字段）
        userInfo: null, 
        isLogged: false,
        
        // 经验值和进度条数据
        currentExp: 595,
        requiredExp: 1405,
        totalExp: 595 + 1405,
        progressPercent: 0,
    },

    onLoad() {
        // 【关键修改点 1: 注册回调函数】
        // 传入一个函数，当 app.js 中的 onLoginSuccess 被调用时，这个函数会被执行
        app.registerPageUpdateCallback(this.loadUserInfoFromStorage.bind(this));
        
        this.calculateProgress();
        this.loadUserInfoFromStorage();
    },
    
    // 【关键新增点：在 onShow 中也刷新，确保从其他页面返回时状态是新的】
    onShow() {
        this.loadUserInfoFromStorage();
    },

    calculateProgress() {
        const progressPercent = (this.data.currentExp / this.data.totalExp) * 100;
        this.setData({
            progressPercent: Math.min(progressPercent, 100)
        });
    },

    loadUserInfoFromStorage() {
        // 【注意】此函数被注册为全局回调，会在登录成功后被 app.js 调用。
        try {
            // 假设缓存 key 为 'userInfo'
            const storedUserInfo = wx.getStorageSync('userInfo'); 
            
            if (storedUserInfo && storedUserInfo.nickName) { // 检查 nickName 字段
                this.setData({
                    userInfo: storedUserInfo,
                    isLogged: true
                });
            } else {
                this.setData({ 
                    userInfo: null, // 清空旧数据
                    isLogged: false 
                });
            }
        } catch (e) {
            console.error("读取缓存失败:", e);
            this.setData({ 
                userInfo: null,
                isLogged: false 
            });
        }
    },

    // 登录按钮事件
    onLoginTap() {
        // 实际应用中：调用 wx.getUserProfile 或其他登录逻辑
        wx.showToast({
            title: '请实现登录逻辑',
            icon: 'none'
        });
        
        // 【模拟登录成功】如果你需要在测试时看到效果，可以在这里手动触发：
        // 假设登录成功后，你会将新的用户信息存入缓存，然后调用 app.onLoginSuccess()。
        /*
        wx.setStorageSync('userInfo', {
             nickName: '测试用户',
             avatarUrl: 'xxx',
             userId: 'test12345',
             // ... 其他字段
        });
        app.onLoginSuccess();
        */
    }
});