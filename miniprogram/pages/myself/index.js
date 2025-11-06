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
    // 确保这个云存储链接是有效的默认头像 URL
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
        ],
        // 用于 WXML 控制排行榜主体显示的加载状态
        isRankingLoading: false, 
    },

    onLoad() {
        if (!wx.cloud) {
            console.error('请确保已安装或开启云开发环境');
        } else {
            wx.cloud.init({
                traceUser: true,
            });
        }
        
        // 注册回调和初次加载（确保页面首次快速显示）
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
        
        // 每次显示时强制刷新数据
        this.loadData() 
        this.getRankData();
    },
    
    // ===================================================
    // ⬇️ 云函数调用获取排行榜数据 (使用 wx.showLoading 优化) ⬇️
    // ===================================================
    getRankData: function() {
        // 1. 显示加载提示，阻止用户点击
        wx.showLoading({
            title: '加载排行榜...',
            mask: true // 阻止用户点击页面其他元素
        });
        
        // 2. 开启 WXML 层的加载状态，隐藏排行榜主体
        this.setData({ isRankingLoading: true });

        wx.cloud.callFunction({
            name: 'getTopRankUsers', 
            data: {}, 
            success: res => {
                let finalRankList;
                
                if (res.result && res.result.code === 0 && res.result.data) {
                    let topUsers = res.result.data; // 顺序: [R1, R2, R3]
                    
                    // 严格判断：只有当 topUsers[i] 存在时，才使用它
                    finalRankList = [
                        topUsers[0] ? topUsers[0] : DEFAULT_RANK_USER, // Rank 1
                        topUsers[1] ? topUsers[1] : DEFAULT_RANK_USER, // Rank 2
                        topUsers[2] ? topUsers[2] : DEFAULT_RANK_USER  // Rank 3
                    ];

                    // 立即更新数据
                    this.setData({ rankList: finalRankList });

                } else {
                    console.error('云函数返回数据格式错误或 code 不为 0', res);
                    // 错误时使用默认占位符
                    this.setData({ rankList: [DEFAULT_RANK_USER, DEFAULT_RANK_USER, DEFAULT_RANK_USER] });
                }
            },
            fail: err => {
                console.error('调用云函数 getTopRankUsers 失败', err);
                // 失败时使用默认占位符
                this.setData({
                    rankList: [DEFAULT_RANK_USER, DEFAULT_RANK_USER, DEFAULT_RANK_USER],
                });
            },
            complete: () => {
                // 3. 无论成功或失败，都在完成时隐藏加载提示
                wx.hideLoading();
                // 4. 关闭 WXML 层的加载状态，显示排行榜主体
                this.setData({ isRankingLoading: false }); 
            }
        });
    },
    // ===================================================
    // ⬆️ 云函数调用获取排行榜数据 (使用 wx.showLoading 优化) ⬆️
    // ===================================================

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
    goToLightboard() {
      wx.navigateTo({ url: `/pages/myself/board/index`});
    },
    goToRanking() {
      wx.navigateTo({ url: `/pages/myself/rank/index`});
    },

    goToOrders() {
      wx.navigateTo({ url: `/pages/index/orders/index`});
    },
    goToCellar() {
      wx.navigateTo({ url: `/pages/myself/storage/index`});
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