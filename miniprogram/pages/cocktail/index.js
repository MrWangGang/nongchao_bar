// /pages/stockList/stockList.js

Page({
  data: {
      activeTab: 'diy',
      activeSort: { key: '综合排序', order: 'asc' },
      activeList: [],
      page: 0,
      pageSize: 10,
      totalPages: 1,
      isLoading: false,
      isLoadComplete: false,
      currentUserId: null,
      sortKeyMap: {
          '综合排序': 'totalAmount',
          '点赞数量': 'likeCount',
          '收录时间': 'createdAt',
      },
      recipeName: '',
  },
  
  onShow: function () {
      if (typeof this.getTabBar === 'function' && this.getTabBar()) {
          this.getTabBar().setData({
              selected: 3
          });
      }
      // 每次显示时刷新数据
      this.loadStockData(true);
  },
  
  onLoad() {
      const userInfo = wx.getStorageSync('userInfo') || {};
      const userId = userInfo.userId || userInfo.openid;
      
      this.setData({
          currentUserId: userId,
          recipeName: '',
      });

      this.loadStockData(true);
  },

  // ---------------------- 核心数据加载 ----------------------

  loadStockData(isRefresh = false) {
      const that = this;
      
      if (that.data.isLoading) return;
      
      let pageToLoad = isRefresh ? 1 : that.data.page + 1;
      
      if (!isRefresh && pageToLoad > that.data.totalPages) {
          that.setData({ isLoadComplete: true });
          return;
      }

      that.setData({ 
          isLoading: true,
          isLoadComplete: false,
      });

      const isUserList = that.data.activeTab === 'my';
      const functionName = isUserList ? 'getUserStockList' : 'getStockList';
      
      const sortKeyDB = that.data.sortKeyMap[that.data.activeSort.key] || 'totalAmount';
      const sortOrder = that.data.activeSort.order;

      let dataParams = {
          page: pageToLoad,
          pageSize: that.data.pageSize,
          orderBy: sortKeyDB, 
          order: sortOrder 
      };
      
      if (isUserList) {
          if (!that.data.currentUserId) {
              wx.showToast({ title: '请先登录', icon: 'none' });
              that.setData({ isLoading: false, isLoadComplete: true });
              return;
          }
          dataParams.userId = that.data.currentUserId;
      }
      
      if (that.data.currentUserId && !dataParams.userId) {
          dataParams.currentUserId = that.data.currentUserId;
      }


      wx.cloud.callFunction({
          name: functionName,
          data: dataParams,
          success: res => {
              const result = res.result;
              if (result.success && Array.isArray(result.data)) {
                  
                  const formattedData = result.data.map(item => {
                      
                      // ⭐ 1. 主名称修正：只使用 recipeName，没有则用默认值 '未命名配方' ⭐
                      const displayName = item.recipeName || '未命名配方';
                      
                      // 【修复 TypeError】确保 item.products 是一个有效的数组，否则使用空数组 []
                      const productsArray = item.products && Array.isArray(item.products) ? item.products : []; 
                      
                      // ⭐ 2. 标签修正：标签取前 5 个商品的 sampleName ⭐
                      const tags = productsArray.slice(0, 5).map(p => p.sampleName || p.name).filter(Boolean);

                      // ⭐ 3. 新增逻辑：格式化收录时间，只保留日期部分 ⭐
                      let createdDate = '';
                      if (item.createdAt) {
                          const date = new Date(item.createdAt);
                          // 格式化为 YYYY-MM-DD
                          createdDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                      }
                      // -------------------------------------------------------------

                      return {
                          id: item._id, 
                          name: displayName, // 仅使用 recipeName 作为主名称
                          price: (item.totalAmount || 0).toFixed(2), 
                          likes: item.likeCount || 0, 
                          isFollowed: item.isFollowed || false, 
                          image: item.imageFileIds, 
                          tags: tags, // 使用 sampleName 列表作为标签
                          createdDate: createdDate, // 存储格式化后的日期
                      };
                  });

                  const newStockList = isRefresh 
                      ? formattedData
                      : that.data.activeList.concat(formattedData);
                      
                  const isComplete = result.page >= result.totalPages;

                  that.setData({
                      activeList: newStockList,
                      page: result.page,
                      totalPages: result.totalPages,
                      isLoadComplete: isComplete,
                  });
              } else {
                  wx.showToast({ title: result.errMsg || '数据加载失败', icon: 'none' });
              }
          },
          fail: err => {
              wx.showToast({ title: '网络请求失败', icon: 'none' });
          },
          complete: () => {
              that.setData({ isLoading: false });
              if (isRefresh) wx.stopPullDownRefresh();
          }
      });
  },

  // ---------------------- 交互事件 ----------------------

  /**
   * 切换 Tab 的事件处理
   */
  switchTab(e) {
      const newTab = e.currentTarget.dataset.tab;
      
      if (newTab === this.data.activeTab) return;

      this.setData({
          activeTab: newTab,
          activeSort: { key: '综合排序', order: 'asc' }, 
      }, () => {
          this.loadStockData(true); 
      });
  },

  /**
   * 排序项点击事件处理 (实现升降序切换)
   */
  sortBy(e) {
      const newKey = e.currentTarget.dataset.key;
      const currentSort = this.data.activeSort;
      let newOrder; 

      if (newKey === '综合排序') {
          newOrder = currentSort.order === 'desc' ? 'asc' : 'desc'; 
      } else if (newKey === currentSort.key) {
          newOrder = currentSort.order === 'desc' ? 'asc' : 'desc';
      } else {
          newOrder = 'desc';
      }
      
      this.setData({
          activeSort: { key: newKey, order: newOrder }
      }, () => {
          this.loadStockData(true); 
      });
  },
  
  /**
   * 点赞/取消按钮点击事件 (标准逻辑)
   */
  handleLike(e) {
      const { id, index } = e.currentTarget.dataset;
      // 当前状态
      const isFollowed = this.data.activeList[index].isFollowed; 
      
      // 目标状态：当前未点赞 -> 目标是点赞(true)
      const targetIsLiking = !isFollowed; 

      wx.showLoading({ 
          title: isFollowed ? '取消中...' : '点赞中...', 
          mask: true 
      });

      wx.cloud.callFunction({
          name: 'updateStockLike', 
          data: {
              stockId: id, 
              userId: this.data.currentUserId,
              isLiking: targetIsLiking // 发送目标状态 (标准逻辑)
          },
          success: res => {
              wx.hideLoading();
              if (res.result.success) {
                  
                  // 页面更新逻辑：切换到目标状态
                  const keyToUpdate = `activeList[${index}].isFollowed`;
                  const countKey = `activeList[${index}].likes`; 
                  
                  const likeChange = targetIsLiking ? 1 : -1;
                  const newLikeCount = this.data.activeList[index].likes + likeChange;

                  const updateObj = {};
                  updateObj[keyToUpdate] = targetIsLiking; 
                  updateObj[countKey] = newLikeCount; 

                  this.setData(updateObj);

                  // 提示信息根据最终状态确定
                  wx.showToast({ 
                      title: targetIsLiking ? '点赞成功' : '已取消收藏', 
                      icon: 'success' 
                  });
              } else {
                  wx.showToast({ title: res.result.errMsg || '操作失败', icon: 'none' });
              }
          },
          fail: err => {
              wx.hideLoading();
              wx.showToast({ title: '网络错误，操作失败', icon: 'none' });
          }
      });
  },
  
  /**
   * 下单按钮点击事件
   */
  handleOrder(e) {
      // 从事件对象中获取配方的 ID
      const cocktailId = e.currentTarget.dataset.id; 
      
      if (!cocktailId) {
          wx.showToast({ title: '配方ID缺失，无法下单', icon: 'none' });
          return;
      }
  
      // 跳转到 pages/cocktail/choose/bill/index 页面，并传递 cocktailId
      wx.navigateTo({
          url: `/pages/cocktail/choose/bill/index?cocktailId=${cocktailId}`
      });
  },
  
  /**
   * 跳转到创建特调页
   */
  goToCreateCocktail() {
      wx.navigateTo({ url: '/pages/cocktail/choose/index' });
  },
  
  /**
   * 生命周期钩子：上拉加载更多
   */
  onReachBottom: function() {
      if (!this.data.isLoading && !this.data.isLoadComplete) {
          this.loadStockData(false);
      }
  },

  /**
   * 生命周期钩子：下拉刷新
   */
  onPullDownRefresh: function() {
      // 将 loadStockData 包装在 Promise 中以便使用 finally，但如果 loadStockData 是同步的或自身不返回 Promise，需要调整
      // 鉴于它是异步调用 wx.cloud.callFunction，通常需要手动停止刷新。
      // 这里简化为直接调用并依赖 complete 中的 wx.stopPullDownRefresh() (见 loadStockData 内部的 complete)
      this.loadStockData(true);
      // 为了安全起见，这里可以再加一次停止刷新，但 loadStockData 的 complete 已经处理了
  },
});