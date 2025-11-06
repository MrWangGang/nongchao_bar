// pages/ranking/ranking.js
Page({
  data: {
    rankList: [],       
    myRank: null,       
    loading: false,     // 全局加载状态
    pageIndex: 1,       // 当前页码，从 1 开始
    pageSize: 20,       // 每页数量
    hasMore: true,      // 是否还有更多数据
    
    // 图片路径定义 (保持不变)
    rankIcon1: 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/ranks1.png',      
    rankIcon2: 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/ranks2.png',      
    rankIcon3: 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/ranks3.png',      
    pageBackground: 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/Gemini_Generated_Image_7uhfe97uhfe97uhf.png'
  },

  onLoad: function () {
    // 初始加载第一页
    this.getRankList(true); 
  },
  
  // ===================================================
  // 分页核心逻辑
  // ===================================================

  /**
   * @param {boolean} isRefresh 是否是刷新操作 (onLoad/onPullDownRefresh)
   */
  getRankList(isRefresh) {
    if (this.data.loading) return;

    // 如果是刷新操作，重置分页状态
    if (isRefresh) {
      this.setData({
        pageIndex: 1,
        hasMore: true,
        loading: true,
      });
    } else {
      // 如果不是刷新，且没有更多数据，则直接返回
      if (!this.data.hasMore) return;
      this.setData({ loading: true });
    }

    wx.cloud.callFunction({
      name: 'getRankList', 
      data: {
        pageIndex: this.data.pageIndex,
        pageSize: this.data.pageSize,
      }
    }).then(res => {
      if (res.result && res.result.success) {
        const newItems = res.result.data || [];
        const total = res.result.total || 0;
        
        // 处理排行榜列表
        let currentList = isRefresh ? newItems : this.data.rankList.concat(newItems);

        // 查找用户自身排名（只在第一次加载或刷新时查找即可）
        let myRank = this.data.myRank;
        if (isRefresh) {
          // 假设您有一个方法来确定当前用户的ID，例如从缓存中获取
          const selfId = wx.getStorageSync('self_user_id') || 'simulated_user_id'; 
          myRank = currentList.find(item => item._id === selfId); 
          if (!myRank) {
             myRank = { rank: '未上榜', avatarUrl: "cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/默认头像.png", nickName: '我', vipScore: 0, _id: selfId };
          }
        }

        const hasMore = currentList.length < total;

        this.setData({
          rankList: currentList,
          myRank: myRank,
          pageIndex: this.data.pageIndex + 1,
          hasMore: hasMore,
          loading: false,
        });

      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
        this.setData({ loading: false });
      }
    }).catch(err => {
      console.error('获取排行榜数据失败:', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.setData({ loading: false });
    });
  },

  // 监听下拉刷新事件
  onPullDownRefresh: function() {
    this.getRankList(true);
    wx.stopPullDownRefresh();
  },

  // 监听上拉触底事件（如果 scroll-view 在页面上，这个方法会在页面滚动到底部时触发）
  // 注意：由于列表在WXML中是嵌套在固定高度的 `scroll-view` 中，这个方法不会被触发。
  // 我们将改用在 `scroll-view` 上绑定 `bindscrolltolower`。
  
  // 【重要】上拉加载更多，绑定到 WXML 中的 <scroll-view class="rank-list-scroll">
  loadMore() {
    if (!this.data.loading && this.data.hasMore) {
      this.getRankList(false);
    }
  }
})