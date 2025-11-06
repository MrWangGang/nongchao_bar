// vip_rights.js - 解决进度条归零问题，改为全程总进度计算

const VIP_LEVELS = [
  { level: 1, requiredExp: 0, levelName: "青铜会员" },          
  { level: 2, requiredExp: 300, levelName: "白银会员" },      
  { level: 3, requiredExp: 1300, levelName: "黄金会员" }, 
  { level: 4, requiredExp: 2800, levelName: "铂金会员" }, 
  { level: 5, requiredExp: 5800, levelName: "钻石会员" }, // V5 终点经验
];

// V5 升级所需的总经验（即终点）
const MAX_EXP = VIP_LEVELS[VIP_LEVELS.length - 1].requiredExp; // 5800

Page({
  data: {
      vipLevel: 1,              
      vipExp: 0, 
      progressPercent: '0%', 
      currentLevelName: '加载中...', 
      expLevels: VIP_LEVELS,
      activeIndex: 0, 
      
      // 新增：轮播图图片配置 (5张) - 请替换为您的实际图片 URL
      swiperImages: [
          { url: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/vip1.png"}, 
          { url: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/vip2.png" }, 
          { url: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/vip3.png" },
          { url: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/vip4.png" },
          { url: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/vip5.png" },
      ],
      
      // 新增：底部特权列表图片配置 (2张) - 请替换为您的实际图片 URL
      listImages: [
          'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/酒吧广告图设计.png', 
          'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/酒吧广告图设计 (1).png', 
      ]
  },

  onLoad() {
      this.loadVipData(); 
  },
  
  onShow: function () {
      this.loadVipData(); 
  },
  
  loadVipData() {
      try {
          // 假设用户经验 300，现在应该显示 300/5800 的进度
          const storedUserInfo = wx.getStorageSync('userInfo') || {
              vipLevel: 1, // 假定初始等级
              vipExp: 300 // 测试数据：300 经验
          }; 
          
          if (storedUserInfo) { 
              const currentVipExp = storedUserInfo.vipExp || 0; 
              
              this.setData({
                  vipExp: currentVipExp,
              }, () => {
                  this.calculateProgress(); 
                  const activeIndex = this.data.vipLevel - 1; // 基于计算出的等级设置卡片
                  this.setData({ activeIndex });
                  this.updateLevelDisplay(activeIndex);
              });
          } else {
               this.setData({ vipLevel: 1, vipExp: 0, activeIndex: 0 }, this.calculateProgress);
          }
      } catch (e) {
          console.error("读取缓存失败:", e);
           this.setData({ vipLevel: 1, vipExp: 0, activeIndex: 0 }, this.calculateProgress);
      }
  },
  
  /**
   * 【最终修正】计算全程总进度百分比
   */
  calculateProgress() {
      const { vipExp } = this.data;
      
      let calculatedLevel = 1;
      
      // 1. 确定用户当前的实际 VIP 等级 (用于更新 'reached' 刻度点状态)
      for (let i = VIP_LEVELS.length - 1; i >= 0; i--) {
          if (vipExp >= VIP_LEVELS[i].requiredExp) {
              calculatedLevel = VIP_LEVELS[i].level;
              break;
          }
      }
      
      let progressToSet = 0;
      
      // 2. 使用全程经验（V1 0经验 到 V5 5800经验）计算进度
      if (MAX_EXP > 0) {
          progressToSet = (vipExp / MAX_EXP) * 100;
      } else {
          progressToSet = 0;
      }


      
      // 3. 实时更新 vipLevel 和 progressPercent
      this.setData({
          vipLevel: calculatedLevel, // 更新刻度点状态
          progressPercent: Math.min(progressToSet, 100).toFixed(2) + '%'
      });
  },
  
  /**
   * 更新页面显示的 VIP 等级名称
   */
  updateLevelDisplay(index) {
      // ... (保持不变)
      const currentLevelInfo = VIP_LEVELS[index];
      const currentLevelName = currentLevelInfo ? currentLevelInfo.levelName : '未知会员';
      
      this.setData({
          currentLevelName: currentLevelName
      });
  },

  /**
   * Swiper 切换事件监听
   */
  swiperChange(e) {
      // ... (保持不变)
      const newIndex = e.detail.current;
      
      this.setData({
          activeIndex: newIndex,
      });
      
      this.updateLevelDisplay(newIndex);
  }
});