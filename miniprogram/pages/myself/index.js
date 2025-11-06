// my_page.js
const app = getApp();

// 定义 VIP 等级所需的总经验值（累计经验值）
const VIP_LEVELS = [
    { level: 1, requiredExp: 0, levelName: "青铜会员" },          
    { level: 2, requiredExp: 300, levelName: "白银会员" },      
    { level: 3, requiredExp: 300 + 1000, levelName: "黄金会员" },
    { level: 4, requiredExp: 1300 + 1500, levelName: "铂金会员" },
    { level: 5, requiredExp: 2800 + 3000, levelName: "钻石会员" }, 
];

// 定义排行榜默认占位数据，用于未满 3 人时的显示
const DEFAULT_RANK_USER = { 
    nickName: '虚位以待', 
    // 关键修复：设置一个完整的、有效的云存储默认头像 URL。
    // 这里使用您 WXML 中云链接的格式，您需要确保该链接是存在的默认头像图。
    avatarUrl: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/默认头像.png", 
    vipScore: 0 
};

Page({
    data: {
        userInfo: null, 
        
        vipLevel: 1,              
        vipExp: 0,              
        
        currentExp: 0, 
        totalExp: 100, 
        progressPercent: '0%', 
        currentLevelName: '加载中...', 
        nextLevelText: '加载中...',      
        
        // 排行榜数据字段
        rankList: [
            DEFAULT_RANK_USER, // 占位 Rank 1
            DEFAULT_RANK_USER, // 占位 Rank 2
            DEFAULT_RANK_USER, // 占位 Rank 3
        ]
    },

    onLoad() {
        if (!wx.cloud) {
            console.error('请确保已安装或开启云开发环境');
        } else {
            wx.cloud.init({
                traceUser: true,
            });
        }
        
        app.registerPageUpdateCallback(this.loadData.bind(this));
        this.loadData();
        
        this.getRankData(); 
    },
    
    onShow: function () {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({
                selected: 4
            })
        }
        this.loadData() 
        this.getRankData();
    },
    
    // ===================================================
    // ⬇️ 云函数调用获取排行榜数据 ⬇️
    // ===================================================
    getRankData: function() {
        wx.cloud.callFunction({
            name: 'getTopRankUsers', 
            data: {}, 
            success: res => {
                if (res.result && res.result.code === 0 && res.result.data) {
                    let topUsers = res.result.data; // 顺序: [R1, R2, R3]
                    
                    // 填充逻辑不变，rankList中的每个对象都包含一个avatarUrl，
                    // 无论是真实用户的还是DEFAULT_RANK_USER中的默认链接。
                    const finalRankList = [
                        topUsers[0] || DEFAULT_RANK_USER, // Rank 1
                        topUsers[1] || DEFAULT_RANK_USER, // Rank 2
                        topUsers[2] || DEFAULT_RANK_USER  // Rank 3
                    ];

                    this.setData({
                        rankList: finalRankList
                    });
                } else {
                    console.error('云函数返回数据格式错误或 code 不为 0', res);
                }
            },
            fail: err => {
                console.error('调用云函数 getTopRankUsers 失败', err);
            }
        })
    },
    // ===================================================
    // ⬆️ 云函数调用获取排行榜数据 ⬆️
    // ===================================================

    // ... (其他函数保持不变)
    loadData() {
        try {
            const storedUserInfo = wx.getStorageSync('userInfo'); 
            
            if (storedUserInfo && (storedUserInfo.avatarUrl || storedUserInfo.avatar) && (storedUserInfo.nickName || storedUserInfo.name)) { 
                
                const currentVipLevel = (storedUserInfo.vipLevel !== undefined && storedUserInfo.vipLevel !== null) 
                                                                                        ? storedUserInfo.vipLevel 
                                                                                        : 1; 
                const currentVipExp = storedUserInfo.vipExp || 0; 
                
                this.setData({
                    userInfo: {
                        avatar: storedUserInfo.avatarUrl || storedUserInfo.avatar, 
                        name: storedUserInfo.nickName || storedUserInfo.name,
                        phone: storedUserInfo.phone || '', 
                    },
                    vipLevel: currentVipLevel,      
                    vipExp: currentVipExp,          
                });
            } else {
                this.setData({ 
                    userInfo: null, 
                    vipLevel: 1, 
                    vipExp: 0,
                });
            }
        } catch (e) {
            console.error("读取缓存失败:", e);
            this.setData({ 
                userInfo: null,
                vipLevel: 1, 
                vipExp: 0,
            });
        }
        
        this.calculateProgress(); 
    },
    
    calculateProgress() {
        const { vipExp, vipLevel } = this.data;
        
        const currentLevelIndex = VIP_LEVELS.findIndex(v => v.level === vipLevel);
        const currentLevelInfo = currentLevelIndex !== -1 ? VIP_LEVELS[currentLevelIndex] : VIP_LEVELS[0]; 
        
        const nextLevelInfo = (currentLevelIndex !== -1 && currentLevelIndex + 1 < VIP_LEVELS.length) 
                                                      ? VIP_LEVELS[currentLevelIndex + 1] 
                                                      : null;

        let currentLevelStartExp = currentLevelInfo.requiredExp;
        let currentLevelName = currentLevelInfo.levelName;
        
        let progressToSet = 0;
        let currentExpToSet = 0;
        let totalExpToSet = 1; 
        let nextLevelText = "";

        if (!nextLevelInfo) {
            const maxLevelStartExp = VIP_LEVELS[VIP_LEVELS.length - 1].requiredExp;
            
            currentExpToSet = vipExp - maxLevelStartExp; 
            totalExpToSet = 1; 
            
            progressToSet = 100;
            nextLevelText = "已达最高等级";
            
        } else {
            let nextLevelRequiredExp = nextLevelInfo.requiredExp;
            
            currentExpToSet = vipExp - currentLevelStartExp; 
            totalExpToSet = nextLevelRequiredExp - currentLevelStartExp; 
            
            if (totalExpToSet > 0) {
                 progressToSet = (currentExpToSet / totalExpToSet) * 100;
            } else {
                progressToSet = 100;
            }
           
            const remainingExp = totalExpToSet - currentExpToSet;
            nextLevelText = `距离下一级还需 ${remainingExp} 经验`;
        }

        this.setData({
            currentExp: currentExpToSet,
            totalExp: totalExpToSet,
            progressPercent: Math.min(progressToSet, 100).toFixed(2) + '%', 
            
            currentLevelName: currentLevelName,
            nextLevelText: nextLevelText      
        });
    },

    goToRanking() {
      wx.navigateTo({ url: `/pages/index/rank/index`});
    },

    goToOrders() {
      wx.navigateTo({ url: `/pages/index/orders/index`});
    },
    goToEditProfile() {
        console.log('导航到编辑资料页');
    },
    goToSettings() {
        console.log('导航到设置页');
    },
    
    goToVipRights() {
        console.log('导航到会员权益页');
    }
});