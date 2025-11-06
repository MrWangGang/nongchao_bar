// pages/board/board.js

// 云存储路径前缀，方便阅读和维护
const CLOUD_PREFIX = 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/';

const BOARD_CONFIG = {
    'LV1_BASIC': { 
        requiredLevel: 1, 
        name: '暹罗喵',
        iconUrl: CLOUD_PREFIX + '暹罗猫.png',
        desc: '新手入驻，来自遥远国度的优雅喵喵。'
    },
    'LV2_ADVANCED': { 
        requiredLevel: 2, 
        name: '奶牛喵',
        iconUrl: CLOUD_PREFIX + '奶牛猫.png',
        desc: '有点幽默感，是群里最精神的小伙伴！'
    },
    'LV3_BRONZE': { 
        requiredLevel: 3, 
        name: '三花喵',
        iconUrl: CLOUD_PREFIX + '三花猫.png',
        desc: '花色复杂，江湖地位开始显现。'
    },
    'LV4_SILVER': { 
        requiredLevel: 4, 
        name: '白喵',
        iconUrl: CLOUD_PREFIX + '白猫.png',
        desc: '高贵典雅，人群中最显眼的一抹纯白。'
    },
    'LV5_GOLD': { 
        requiredLevel: 5, 
        name: '黑喵',
        iconUrl: CLOUD_PREFIX + '黑猫.png',
        desc: '神秘莫测的王者，拥有最高等级的荣耀！'
    },
}

Page({
    
    data: {
        userId: '',
        userLevel: 1,      
        currentBoard: null, 
        currentBoardUrl: null, // 【新增】用于存储当前佩戴灯牌的 URL，方便渲染
        boardList: [],     
    },

    onLoad() {
        const userInfo = wx.getStorageSync('userInfo');
        const userId = userInfo ? userInfo.userId : null;
        const userLevel = userInfo ? (userInfo.vipLevel || 1) : 1; 
        const currentBoard = userInfo ? (userInfo.board || null) : null;
        const currentBoardUrl = userInfo ? (userInfo.boardUrl || null) : null; // 【新增】从缓存读取 boardUrl
        
        if (!userId) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }

        this.setData({
            userId: userId,
            userLevel: userLevel,
            currentBoard: currentBoard,
            currentBoardUrl: currentBoardUrl // 【新增】设置当前 boardUrl
        });

        this.renderBoardList(userLevel, currentBoard);
    },

    /**
     * 根据用户等级和当前佩戴状态渲染灯牌列表
     */
    renderBoardList(level, currentBoardName) {
        const boardList = [];
        for (const key in BOARD_CONFIG) {
            const config = BOARD_CONFIG[key];
            
            // 【核心逻辑修改】:
            // canClaim 只需要判断用户的当前等级是否达到【佩戴此灯牌所需的最低等级】。
            // 因为高等级用户可以佩戴任何低于或等于自己等级的灯牌。
            const canClaim = level >= config.requiredLevel;
            
            const isCurrent = currentBoardName === config.name;

            boardList.push({
                key: key, 
                name: config.name,
                requiredLevel: config.requiredLevel,
                canClaim: canClaim,
                isCurrent: isCurrent,
                iconUrl: config.iconUrl, 
                desc: config.desc // 【新增】
            });
        }
        
        boardList.sort((a, b) => a.requiredLevel - b.requiredLevel);
        this.setData({ boardList });
    },

    /**
     * 佩戴灯牌处理函数
     */
    async handleClaimBoard(e) {
        const boardKey = e.currentTarget.dataset.key;
        const board = this.data.boardList.find(b => b.key === boardKey);

        if (!board || !board.canClaim || board.isCurrent) {
            // 如果等级不足（即 requiredLevel > userLevel），或者已佩戴，则不处理。
            return; 
        }

        const boardName = board.name; 
        const boardUrl = board.iconUrl; // 【新增】获取要佩戴灯牌的 URL
        
        wx.showLoading({ title: `佩戴 ${boardName} 中...` });

        try {
            const res = await wx.cloud.callFunction({
                name: 'claimBoard', 
                data: {
                    userId: this.data.userId, 
                    boardName: boardName, 
                    boardUrl: boardUrl  // 【核心修改】将 boardUrl 传递给云函数
                }
            });

            wx.hideLoading();
            
            if (res.result.success) {
                wx.showToast({ title: res.result.message, icon: 'success' });
                
                const newBoardName = res.result.newBoardName;
                const newBoardUrl = res.result.newBoardUrl; // 【新增】接收云函数返回的 boardUrl
                
                this.setData({ 
                    currentBoard: newBoardName,
                    currentBoardUrl: newBoardUrl // 【新增】更新 state 中的 boardUrl
                });
                this.renderBoardList(this.data.userLevel, newBoardName);
                
                // 更新本地缓存
                let userInfo = wx.getStorageSync('userInfo') || {};
                userInfo.board = newBoardName;
                userInfo.boardUrl = newBoardUrl; // 【新增】更新缓存中的 boardUrl
                wx.setStorageSync('userInfo', userInfo);

            } else {
                wx.showToast({ title: res.result.message || '佩戴失败', icon: 'none' });
            }

        } catch (e) {
            wx.hideLoading();
            console.error('调用云函数失败', e);
            wx.showToast({ title: '网络请求失败', icon: 'none' });
        }
    }
})