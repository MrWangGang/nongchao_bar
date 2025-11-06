// pages/account/detail/index.js
Page({
  data: {
      currentTab: 'score', // 当前激活的 Tab: 'score' (积分) 或 'exp' (经验)
      currentScore: 0,     // 用户的当前积分
      currentExp: 0,       // 用户的当前经验
      userId: null,        // 用户的唯一ID (_id)，用于云函数查询

      // 积分列表数据
      scoreList: [],
      scorePage: 1,
      scoreTotal: 0,
      scoreLoading: false,
      scoreHasMore: true,

      // 经验列表数据
      expList: [],
      expPage: 1,
      expTotal: 0,
      expLoading: false,
      expHasMore: true,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
      // 1. 从缓存获取用户信息，获取当前积分/经验和 userId
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.userId) {
          this.setData({
              currentScore: userInfo.vipScore || 0,
              currentExp: userInfo.vipExp || 0,
              userId: userInfo.userId
          }, () => {
              // 默认加载积分列表
              this.loadScoreHistory(true);
          });
      } else {
          wx.showToast({
              title: '请先登录',
              icon: 'none'
          });
          // 引导回首页或登录页
          setTimeout(() => { wx.navigateBack(); }, 1000);
      }
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
      const newTab = e.currentTarget.dataset.tab;
      if (this.data.currentTab === newTab) return;

      this.setData({
          currentTab: newTab
      });

      // 如果切换到经验Tab且经验列表未加载，则加载经验列表
      if (newTab === 'exp' && this.data.expList.length === 0) {
          this.loadExpHistory(true);
      }
  },

  /**
   * 加载积分历史记录
   * @param {boolean} refresh - 是否刷新（重置页码）
   */
  loadScoreHistory(refresh) {
      const { userId, scorePage, scoreLoading, scoreHasMore } = this.data;
      if (!userId || scoreLoading || (!scoreHasMore && !refresh)) return;

      const page = refresh ? 1 : scorePage;
      
      this.setData({ scoreLoading: true });

      wx.cloud.callFunction({
          name: 'getScoreHistory',
          data: {
              userId: userId,
              page: page,
              pageSize: 10
          },
          success: res => {
              const result = res.result;
              if (result.success) {
                  const newList = result.list;
                  const total = result.total;
                  const oldList = refresh ? [] : this.data.scoreList;
                  
                  this.setData({
                      scoreList: oldList.concat(newList),
                      scorePage: page + 1,
                      scoreTotal: total,
                      scoreHasMore: (page * 10) < total,
                      scoreLoading: false
                  });
              } else {
                  wx.showToast({ title: result.errMsg, icon: 'none' });
                  this.setData({ scoreLoading: false });
              }
          },
          fail: err => {
              console.error('加载积分历史失败', err);
              wx.showToast({ title: '加载失败', icon: 'error' });
              this.setData({ scoreLoading: false });
          }
      });
  },

  /**
   * 加载经验历史记录
   * @param {boolean} refresh - 是否刷新（重置页码）
   */
  loadExpHistory(refresh) {
      const { userId, expPage, expLoading, expHasMore } = this.data;
      if (!userId || expLoading || (!expHasMore && !refresh)) return;

      const page = refresh ? 1 : expPage;

      this.setData({ expLoading: true });

      wx.cloud.callFunction({
          name: 'getExpHistory',
          data: {
              userId: userId,
              page: page,
              pageSize: 10
          },
          success: res => {
              const result = res.result;
              if (result.success) {
                  const newList = result.list;
                  const total = result.total;
                  const oldList = refresh ? [] : this.data.expList;

                  this.setData({
                      expList: oldList.concat(newList),
                      expPage: page + 1,
                      expTotal: total,
                      expHasMore: (page * 10) < total,
                      expLoading: false
                  });
              } else {
                  wx.showToast({ title: result.errMsg, icon: 'none' });
                  this.setData({ expLoading: false });
              }
          },
          fail: err => {
              console.error('加载经验历史失败', err);
              wx.showToast({ title: '加载失败', icon: 'error' });
              this.setData({ expLoading: false });
          }
      });
  },

  /**
   * 监听用户上拉触底事件 (加载下一页)
   */
  onReachBottom() {
      if (this.data.currentTab === 'score') {
          this.loadScoreHistory(false);
      } else if (this.data.currentTab === 'exp') {
          this.loadExpHistory(false);
      }
  }
})