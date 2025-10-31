// /pages/orderConfirm/orderConfirm.js

// 辅助函数：格式化商品选项描述 (保持不变)
function formatOptions(item) {
  if (item.selectedSpecs && Array.isArray(item.selectedSpecs)) {
      var optionsText = item.selectedSpecs.map(function(spec) {
          return spec.value;
      });
      return optionsText.filter(Boolean).join('，');
  }
  return '';
}

Page({
  data: {
      orderItems: [],     
      totalAmount: '0.00',
      totalCount: 0,      
      // seatCode: null,   // 【已移除】
      recipeName: '',     
      remark: '',         
      isSubmitting: false, 
      uploadedImages: [], 
      MAX_IMAGE_COUNT: 1, 
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
      var encodedData = options.data; 
      // const seatCode = options.seatCode; // 【已移除】
      
      if (encodedData) {
          try {
              var decodedString = decodeURIComponent(encodedData);
              var checkoutData = JSON.parse(decodedString);
              
              if (checkoutData && checkoutData.orderItems) {
                  var processedItems = checkoutData.orderItems.map(function(item) {
                      item.formattedSpec = formatOptions(item); 
                      return item;
                  });
                  
                  this.setData({
                      // seatCode: seatCode, // 【已移除】
                      orderItems: processedItems,
                      totalAmount: checkoutData.totalAmount || '0.00',
                      totalCount: checkoutData.totalCount || 0,
                  });
              } else {
                  throw new Error("解析后的数据结构不正确");
              }
          } catch (e) {
              console.error("订单数据读取失败", e);
              wx.showToast({ title: '订单数据丢失或过长', icon: 'error' });
              setTimeout(function() { wx.navigateBack(); }, 1500);
          }
      } else {
           wx.showToast({ title: '未收到订单数据', icon: 'error' });
           setTimeout(function() { wx.navigateBack(); }, 1500);
      }
  },

  /**
   * 配方名称输入框变化事件
   */
  onRecipeNameInput: function(e) {
      this.setData({
          recipeName: e.detail.value
      });
  },

  /**
   * 备注输入框变化事件
   */
  onRemarkInput: function(e) {
      this.setData({
          remark: e.detail.value
      });
  },
  
  /**
   * 图片选择和上传功能 (避免使用 async/await)
   */
  onChooseImage: function() {
      const that = this;
      
      wx.chooseImage({
          count: 1, // 只允许选择一张图片
          sizeType: ['compressed'], 
          sourceType: ['album', 'camera'], 
      })
      .then(res => {
          const tempFilePath = res.tempFilePaths[0];
          wx.showLoading({ title: '上传中...', mask: true });
          
          const cloudPath = `cocktail-recipes/${Date.now()}-${tempFilePath.match(/\.[^.]+?$/)[0]}`;
          
          // 返回上传 Promise
          return wx.cloud.uploadFile({
              cloudPath: cloudPath,
              filePath: tempFilePath,
          });
      })
      .then(uploadResult => {
          const newFileId = uploadResult.fileID;

          // 用新 fileID 覆盖旧的数组
          that.setData({
              uploadedImages: [newFileId]
          });

          wx.hideLoading();
          wx.showToast({ title: '图片已上传/更新', icon: 'success' });
      })
      .catch(e => {
          wx.hideLoading();
          console.error('图片上传失败', e);
          wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      });
  },

  /**
   * 提交配方
   */
  onSubmitOrder: function() {
      var that = this; 
      if (that.data.isSubmitting) return;

      // 1. 校验配方名称
      if (!that.data.recipeName.trim()) {
          wx.showToast({ title: '请输入配方名称', icon: 'none' });
          return;
      }
      
      // 2. 校验制作流程/备注
      if (!that.data.remark.trim()) {
          wx.showToast({ title: '请输入制作流程/备注', icon: 'none' });
          return;
      }

      // 3. 校验图片数量
      if (that.data.uploadedImages.length !== 1) {
          wx.showToast({ title: '请上传一张配方图片', icon: 'none' });
          return;
      }

      // 4. 用户ID校验
      var userInfo = wx.getStorageSync('userInfo') || {};
      var userId = userInfo.userId || userInfo.openid; 

      if (!userId) {
          wx.showToast({ title: '请先登录获取用户ID', icon: 'none' });
          that.setData({ isSubmitting: false });
          return;
      }

      that.setData({ isSubmitting: true });

      // 5. 构造传递给云函数的订单数据
      var finalOrder = {
          products: that.data.orderItems,
          totalPrice: parseFloat(that.data.totalAmount),
          totalCount: that.data.totalCount,
          recipeName: that.data.recipeName.trim(), 
          remark: that.data.remark.trim(),
          // seatCode: that.data.seatCode, // 【已移除】
          // storeName: "XXXXXX店",       // 【已移除】
          imageFileIds: that.data.uploadedImages, 
      };

      wx.showLoading({
          title: '正在提交配方...',
          mask: true
      });

      // 6. 调用云函数 createStockOrder
      wx.cloud.callFunction({
          name: 'createStockOrder', 
          data: {
              finalOrder: finalOrder,
              userId: userId
          },
          success: function(res) {
              wx.hideLoading();
              
              var result = res.result;

              if (result.success && result.stockId) {
                  wx.showToast({
                      title: '配方提交成功',
                      icon: 'success',
                      duration: 500
                  });
                  
                  wx.removeStorageSync('cocktailList');
                  
                  // 延迟 500 毫秒后返回上一页
                  setTimeout(function() {
                      wx.navigateBack(); 
                  }, 500); 
                  
              } else {
                  that.handleOrderCreationFailure(result.errMsg || '配方提交失败，请重试');
              }
          },
          fail: function(err) {
              wx.hideLoading();
              that.handleOrderCreationFailure('网络错误，请检查连接');
              console.error('云函数 createStockOrder 调用失败', err);
          }
      });
  },

  /**
   * 处理配方提交失败的统一方法
   */
  handleOrderCreationFailure: function(title) {
      wx.showToast({
          title: title,
          icon: 'none'
      });
      this.setData({ isSubmitting: false });
  },
});