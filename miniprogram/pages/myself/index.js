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

Page({
    data: {
        userInfo: null, 
        
        vipLevel: 1,      
        vipExp: 0,        
        
        currentExp: 0, 
        totalExp: 100, 
        progressPercent: 0,
        currentLevelName: '加载中...', 
        nextLevelText: '加载中...',      
    },

    onLoad() {
        app.registerPageUpdateCallback(this.loadData.bind(this));
        this.loadData();
    },
    
    onShow() {
        this.loadData();
    },
    
    // ===================================================
    // ⬇️ 核心数据刷新函数 ⬇️
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
    
    // ===================================================
    // ⬇️ 经验值计算逻辑 ⬇️
    // ===================================================
    
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
            // 已经是最高等级 (VIP 5)
            const maxLevelStartExp = VIP_LEVELS[VIP_LEVELS.length - 1].requiredExp;
            
            currentExpToSet = vipExp - maxLevelStartExp; 
            totalExpToSet = 1; 
            
            progressToSet = 100;
            // 最高等级提示
            nextLevelText = "已达最高等级";
            
        } else {
            let nextLevelRequiredExp = nextLevelInfo.requiredExp;
            
            currentExpToSet = vipExp - currentLevelStartExp; 
            totalExpToSet = nextLevelRequiredExp - currentLevelStartExp; 
            
            progressToSet = (currentExpToSet / totalExpToSet) * 100;
            
            const remainingExp = totalExpToSet - currentExpToSet;
            // 下一级提示，只显示剩余经验值
            nextLevelText = `距离下一级还需 ${remainingExp} 经验`;
        }

        this.setData({
            currentExp: currentExpToSet,
            totalExp: totalExpToSet,
            progressPercent: Math.min(progressToSet, 100),
            currentLevelName: currentLevelName, 
            nextLevelText: nextLevelText      
        });
    },

    // 导航函数（WXML 中保留的绑定事件）
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