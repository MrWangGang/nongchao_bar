// index.js - 存酒页面逻辑 (完整版，支持分页、唯一单号、数量输入)

Page({
  data: {
      currentTab: 0, 
      displayList: [], 
      isModalVisible: false, 
      currentDate: new Date().toISOString().split('T')[0],

      // === 分页状态变量 ===
      page: 0,        
      pageSize: 10,   
      hasMore: true,  
      isLoading: false, 
      // ==================
      
      // 模态框表单数据
      formData: {
          fileId: '',       
          wineName: '',     
          validityDate: '', 
          remark: '',         
          quantity: 1,      
      },
      
      // ENV 字段已删除
      userId: '', 
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
      const storedUserInfo = wx.getStorageSync('userInfo');
      const userId = storedUserInfo && storedUserInfo.userId ? storedUserInfo.userId : '';

      if (!userId) {
          wx.showToast({ title: '用户ID未获取到', icon: 'error' });
          return;
      }

      this.setData({ userId }, () => {
           // 初始化云开发
           if (!wx.cloud) {
              console.error('请确保你的小程序基础库版本在 2.2.3 及以上，并开通云开发');
          } else {
              // 【修改点】：使用 true 自动识别默认环境
              wx.cloud.init({
                  env: true, 
                  traceUser: true,
              });
          }
          this.resetAndFetchList(this.data.currentTab);
      });
  },

  /**
   * 监听用户上拉触底事件 (实现加载更多)
   */
  onReachBottom() {
      if (this.data.hasMore && !this.data.isLoading) {
          this.fetchList(this.data.currentTab, true); 
      }
  },

  /**
   * 重置分页状态并开始获取列表
   */
  resetAndFetchList(tabIndex) {
      this.setData({
          page: 0,
          hasMore: true,
          displayList: []
      });
      this.fetchList(tabIndex, false); 
  },

  /**
   * 调用云函数获取列表数据
   */
  fetchList(tabIndex, isAppend = false) {
      if (!isAppend) {
          wx.showLoading({ title: '加载中' });
      }
      
      this.setData({ isLoading: true });
      
      const status = tabIndex === 0 ? '已确认寄存' : '已取出';
      const currentPage = isAppend ? this.data.page + 1 : 0;

      wx.cloud.callFunction({
          name: 'getStorageList',
          data: {
              userId: this.data.userId,
              status: status,
              pageIndex: currentPage,
              pageSize: this.data.pageSize
          }
      }).then(res => {
          wx.hideLoading();
          this.setData({ isLoading: false });

          if (res.result && res.result.success) {
              const { list, total } = res.result;

              const formattedList = list.map(item => {
                  item.depositTimeDisplay = this.formatDate(item.depositTime);
                  item.withdrawTimeDisplay = item.withdrawTime ? this.formatDate(item.withdrawTime) : null;
                  return item;
              });

              const newList = isAppend ? this.data.displayList.concat(formattedList) : formattedList;

              this.setData({
                  displayList: newList,
                  page: currentPage,
                  hasMore: newList.length < total 
              });
              
          } else {
              wx.showToast({ title: isAppend ? '加载更多失败' : '列表加载失败', icon: 'error' });
              this.setData({ hasMore: false }); 
              console.error('getStorageList 云函数返回失败:', res);
          }
      }).catch(err => {
          wx.hideLoading();
          this.setData({ isLoading: false, hasMore: false });
          wx.showToast({ title: '网络错误', icon: 'error' });
          console.error('调用 getStorageList 云函数出错:', err);
      });
  },

  /**
   * 格式化日期辅助函数
   */
  formatDate(dateStr) {
      if (!dateStr) return '';
      let date = new Date(dateStr);
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  },

  /**
   * 切换 Tab (重置分页并刷新列表)
   */
  switchTab(e) {
      const index = parseInt(e.currentTarget.dataset.index);
      if (this.data.currentTab !== index) {
          this.setData({ currentTab: index });
          this.resetAndFetchList(index);
      }
  },

  /**
   * 显示模态弹窗
   */
  showModal() {
      this.setData({
          isModalVisible: true,
          formData: {
              fileId: '',
              wineName: '',
              validityDate: '',
              remark: '',
              quantity: 1, 
          }
      });
  },

  /**
   * 隐藏模态弹窗
   */
  hideModal() {
      this.setData({
          isModalVisible: false,
      });
  },

  /**
   * 图片上传：选择图片并上传到云存储
   */
  chooseImage() {
      wx.chooseMedia({
          count: 1, 
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: (res) => {
              const tempFilePath = res.tempFiles[0].tempFilePath;
              wx.showLoading({ title: '上传中...' });
              
              const cloudPath = `wine-images/${this.data.userId}_${Date.now()}.jpg`;
              wx.cloud.uploadFile({
                  cloudPath: cloudPath,
                  filePath: tempFilePath,
                  success: (uploadRes) => {
                      wx.hideLoading();
                      this.setData({
                          'formData.fileId': uploadRes.fileID 
                      });
                      wx.showToast({ title: '图片上传成功', icon: 'success' });
                  },
                  fail: (err) => {
                      wx.hideLoading();
                      wx.showToast({ title: '图片上传失败', icon: 'error' });
                      console.error('图片上传失败', err);
                  }
              });
          }
      });
  },

  /**
   * 日期选择器改变事件
   */
  bindDateChange(e) {
      this.setData({
          'formData.validityDate': e.detail.value
      });
  },

  /**
   * 备注输入事件
   */
  bindRemarkInput(e) {
      this.setData({
          'formData.remark': e.detail.value
      });
  },

  /**
   * 数量输入事件
   */
  bindQuantityInput(e) {
      let quantity = parseInt(e.detail.value) || 1; 
      this.setData({
          'formData.quantity': quantity
      });
  },

  /**
   * 表单提交事件 - 调用云函数
   */
  submitForm(e) {
      const { wineName, quantity: quantityStr, remark } = e.detail.value;
      const { validityDate, fileId } = this.data.formData;

      const finalQuantity = parseInt(quantityStr) || 1; 

      // 1. 校验数据
      if (!wineName || !validityDate || !fileId) {
          wx.showToast({ title: '请填写完整信息并上传图片', icon: 'none' });
          return;
      }
      if (finalQuantity < 1) {
           wx.showToast({ title: '数量必须大于 0', icon: 'none' });
          return;
      }
      
      // 2. 确认弹框
      wx.showModal({
          title: '确认存酒',
          content: `确认存入：${finalQuantity} 瓶 ${wineName} 吗？`,
          confirmText: '确认存酒',
          cancelText: '取消',
          success: (res) => {
              if (res.confirm) {
                  this.processSubmission({
                      wineName,
                      validityDate,
                      remark,
                      fileId,
                      quantity: finalQuantity, 
                  });
              }
          }
      });
  },

  /**
   * 处理实际提交的函数 (调用 addStorage 云函数)
   */
  processSubmission(submitData) {
      wx.showLoading({ title: '存酒中...' });

      wx.cloud.callFunction({
          name: 'addStorage',
          data: {
              data: {
                  userId: this.data.userId,
                  name: submitData.wineName, 
                  endDate: submitData.validityDate, 
                  remark: submitData.remark || '无', 
                  fileId: submitData.fileId,
                  quantity: submitData.quantity, 
              }
          }
      }).then(res => {
          wx.hideLoading();
          if (res.result && res.result.success) {
              wx.showToast({ title: `存酒成功！单号: ${res.result.no}`, icon: 'success', duration: 3000 });
              this.setData({
                  isModalVisible: false, 
              });
              this.resetAndFetchList(this.data.currentTab);
          } else {
              const errorMsg = res.result.errMsg || '未知错误';
              wx.showToast({ title: `存酒失败: ${errorMsg}`, icon: 'none', duration: 3000 });
              console.error('addStorage 云函数返回失败:', res);
          }
      }).catch(err => {
          wx.hideLoading();
          wx.showToast({ title: '网络错误', icon: 'error' });
          console.error('调用 addStorage 云函数出错:', err);
      });
  },

  /**
   * 立刻取酒按钮事件 (调用 withdrawWine 云函数)
   */
  withdrawWine(e) {
      const index = e.currentTarget.dataset.index;
      const wineToWithdraw = this.data.displayList[index];

      wx.showModal({
          title: '确认取酒',
          content: `确认取出 寄存单号 ${wineToWithdraw.no} 的 ${wineToWithdraw.name} (共 ${wineToWithdraw.quantity} 瓶) 吗？`,
          success: (res) => {
              if (res.confirm) {
                  wx.showLoading({ title: '取酒中...' });

                  wx.cloud.callFunction({
                      name: 'withdrawWine',
                      data: {
                          _id: wineToWithdraw._id 
                      }
                  }).then(res => {
                      wx.hideLoading();
                      if (res.result && res.result.success) {
                          wx.showToast({ title: '取酒成功', icon: 'success' });
                          this.resetAndFetchList(this.data.currentTab);
                      } else {
                          wx.showToast({ title: '取酒失败', icon: 'error' });
                          console.error('withdrawWine 云函数返回失败:', res);
                      }
                  }).catch(err => {
                      wx.hideLoading();
                      wx.showToast({ title: '网络错误', icon: 'error' });
                      console.error('调用 withdrawWine 云函数出错:', err);
                  });
              }
          }
      });
  }
});