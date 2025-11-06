// components/lightboard-float/lightboard-float.js

// 定义组件的固定宽度 (rpx)
const COMPONENT_WIDTH_RPX = 120;
// 定义组件的固定高度 (rpx)
const COMPONENT_HEIGHT_RPX = 120;
// Rpx 到 Px 的转换比例 (将在 attached 中计算)
let rpxToPxRatio = 1;

// 气泡的固定对话列表
const DIALOG_LIST = [
  '点击可以拖动我哦~', 
  '主人你好呀！', 
  '今天也要开心哦 (^_^)',
  '别忘记给我点赞呀！',
  '天气不错，要不要出去走走？',
  '咦？你好像很久没看我了呢！',
  '有什么烦恼吗？和我说说呀！',
  '偷偷告诉你，我今天又变好看了！',
  '请给我一杯咖啡，谢谢！(假的)',
  '累了吧？休息一下！',
  '前方高能预警！要准备好了！',
  '在干什么呢？别太辛苦哦！',
  '我们老板很大方！',
];

// 气泡自动隐藏时间 (毫秒)，设置为 2 秒
const BUBBLE_HIDE_DURATION = 2000; 

// 气泡随机出现的最小和最大间隔 (毫秒)
const MIN_INTERVAL = 1000; // 最小 10 秒
const MAX_INTERVAL = 5000; // 最大 30 秒

Component({
  properties: {
    // 初始距离顶部的位置 (rpx)，默认 100rpx
    initialTopRpx: {
      type: Number,
      value: 100
    },
    // 初始距离右侧的位置 (rpx)，默认 20rpx
    initialRightRpx: {
      type: Number,
      value: 20
    }
  },
  data: {
    boardUrl: null,       // 从缓存中读取的灯牌URL
    topRpx: 0,            // 当前顶部位置 (rpx)
    leftRpx: 0,           // 当前左侧位置 (rpx)
    isDragging: false,    // 是否正在拖动

    // 屏幕尺寸信息 (rpx)
    windowWidthRpx: 750,
    windowHeightRpx: 1334, 
    
    // 气泡相关 data
    showBubble: false, 
    bubbleText: '点击可以拖动我哦~', 
    bubbleIndex: 0, 
  },
  
  // 用于存储定时器 ID
  bubbleLoopTimer: null,
  bubbleHideTimer: null,

  lifetimes: {
    attached() {
      // 1. 获取系统信息，计算尺寸和比例
      const systemInfo = wx.getSystemInfoSync();
      rpxToPxRatio = systemInfo.windowWidth / 750;

      this.setData({
        windowHeightRpx: systemInfo.windowHeight / rpxToPxRatio
      });
      
      // 2. 初始化位置
      this.initPosition();

      // 3. 加载灯牌URL
      this.loadBoardUrl();
      
      // 启动随机气泡循环
      this.startBubbleLoop();
    },
    
    // 组件销毁时清除所有定时器
    detached() {
        if (this.bubbleLoopTimer) {
            clearTimeout(this.bubbleLoopTimer);
        }
        if (this.bubbleHideTimer) {
            clearTimeout(this.bubbleHideTimer);
        }
    }
  },
  
  pageLifetimes: {
    show() {
      // 页面显示时，重新加载缓存、检查位置并确保定时器启动
      this.loadBoardUrl();
      this.initPosition();
      this.startBubbleLoop();
    },
    // 页面隐藏时，清除循环定时器，节省资源
    hide() {
        if (this.bubbleLoopTimer) {
            clearTimeout(this.bubbleLoopTimer);
            this.bubbleLoopTimer = null;
        }
        if (this.bubbleHideTimer) {
            clearTimeout(this.bubbleHideTimer);
        }
        this.setData({ showBubble: false });
    }
  },

  methods: {
    /**
     * 根据传入的 initialRightRpx 和 initialTopRpx 计算初始 left 和 top 位置
     */
    initPosition() {
      const { initialTopRpx, initialRightRpx, windowWidthRpx } = this.data;
      // 根据右侧距离计算左侧位置
      const initialLeftRpx = windowWidthRpx - COMPONENT_WIDTH_RPX - initialRightRpx;

      this.setData({
        topRpx: initialTopRpx,
        leftRpx: initialLeftRpx
      });
    },

    /**
     * 从缓存中获取灯牌URL
     */
    loadBoardUrl() {
      try {
        const storedUserInfo = wx.getStorageSync('userInfo');
        if (storedUserInfo && storedUserInfo.boardUrl) {
          this.setData({
            boardUrl: storedUserInfo.boardUrl
          });
        } else if (this.data.boardUrl !== null) {
          this.setData({
            boardUrl: null
          });
        }
      } catch (e) {
        console.error("组件加载灯牌URL失败:", e);
      }
    },
    
    /**
     * 启动气泡随机出现循环
     */
    startBubbleLoop() {
        if (this.bubbleLoopTimer) {
            clearTimeout(this.bubbleLoopTimer);
        }
        
        // 生成随机等待时间
        const randomInterval = Math.random() * (MAX_INTERVAL - MIN_INTERVAL) + MIN_INTERVAL;
        
        // 设置定时器，随机时间后显示气泡
        this.bubbleLoopTimer = setTimeout(() => {
            // 确保有图标时才执行显示逻辑
            if (this.data.boardUrl) {
                this.showRandomBubble();
            }
            // 递归：显示后立即开始计算下一次出现的随机时间
            this.startBubbleLoop(); 
        }, randomInterval);
    },

    /**
     * 显示一个随机对话气泡，并在 2 秒后自动隐藏
     */
    showRandomBubble() {
        // 确保清除旧的隐藏定时器
        if (this.bubbleHideTimer) {
            clearTimeout(this.bubbleHideTimer);
        }
        
        // 随机选择一个对话
        const newIndex = Math.floor(Math.random() * DIALOG_LIST.length);

        this.setData({
            bubbleText: DIALOG_LIST[newIndex],
            bubbleIndex: newIndex,
            showBubble: true, // 显示气泡
        });
        
        // 设置 2 秒后自动隐藏
        this.bubbleHideTimer = setTimeout(() => {
            this.setData({
                showBubble: false,
            });
        }, BUBBLE_HIDE_DURATION); 
    },
    
    /**
     * 触摸开始事件：准备拖动
     */
    handleTouchStart(e) {
      if (!this.data.boardUrl) return; 
      
      // 拖动时立即隐藏气泡并清除隐藏定时器
      if (this.bubbleHideTimer) {
          clearTimeout(this.bubbleHideTimer);
      }
      this.setData({
          isDragging: true,
          showBubble: false,
      });
      
      // 记录起始位置
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
      this.startTop = this.data.topRpx * rpxToPxRatio; // px
      this.startLeft = this.data.leftRpx * rpxToPxRatio; // px
    },

    /**
     * 触摸移动事件：计算新位置并应用边界检查
     */
    handleTouchMove(e) {
      if (!this.data.isDragging || !this.data.boardUrl) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      const deltaX = currentX - this.startX;
      const deltaY = currentY - this.startY;

      let newLeftPx = this.startLeft + deltaX;
      let newTopPx = this.startTop + deltaY;

      // --- 边界检查 (使用像素进行) ---
      const maxLeftPx = this.data.windowWidthRpx * rpxToPxRatio - COMPONENT_WIDTH_RPX * rpxToPxRatio;
      const maxTopPx = this.data.windowHeightRpx * rpxToPxRatio - COMPONENT_HEIGHT_RPX * rpxToPxRatio;
      
      newLeftPx = Math.max(0, newLeftPx);
      newLeftPx = Math.min(maxLeftPx, newLeftPx);
      newTopPx = Math.max(0, newTopPx);
      newTopPx = Math.min(maxTopPx, newTopPx);

      // 更新视图
      this.setData({
        leftRpx: newLeftPx / rpxToPxRatio,
        topRpx: newTopPx / rpxToPxRatio
      });
    },

    /**
     * 触摸结束事件：结束拖动状态
     */
    handleTouchEnd() {
      this.setData({
        isDragging: false
      });
      // 拖动结束后，重新启动随机气泡循环
      this.startBubbleLoop();
    },

    /**
     * 气泡点击事件：点击气泡时切换对话，并重置 2 秒隐藏计时
     */
    handleBubbleTap() {
      // 确保清除旧的隐藏定时器
      if (this.bubbleHideTimer) {
          clearTimeout(this.bubbleHideTimer);
      }
      
      let nextIndex = (this.data.bubbleIndex + 1) % DIALOG_LIST.length;
      
      this.setData({
          bubbleText: DIALOG_LIST[nextIndex],
          bubbleIndex: nextIndex,
      });

      // 重新设置 2 秒后自动隐藏
      this.bubbleHideTimer = setTimeout(() => {
          this.setData({
              showBubble: false,
          });
      }, BUBBLE_HIDE_DURATION); 
    }
  }
});