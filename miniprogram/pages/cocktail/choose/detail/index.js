// /pages/orderConfirm/orderConfirm.js
// 辅助函数：格式化商品选项描述（从 Page 内部提取为普通函数）
// 传入单个商品项，返回格式化的规格字符串
function formatOptions(item) {
  // 排除掉不属于规格的字段
  var excludedKeys = ['id', 'productId', 'image', 'name', 'price', 'quantity', 'totalPrice', 'priceDisplay', 'desc', 'tags', 'category'];
  var optionsText = [];
  
  // 遍历商品项的所有键
  Object.keys(item).forEach(function(key) {
      if (excludedKeys.indexOf(key) === -1) {
           // 如果该键不是核心字段，则视为规格信息，加入数组
          optionsText.push(item[key]);
      }
  });

  // 将选项用逗号分隔，并去除多余的空项
  return optionsText.filter(Boolean).join('，');
}


Page({
  data: {
      orderItems: [],     // 订单商品列表 (已包含 formattedSpec 字段)
      totalAmount: '0.00',// 订单总金额
      totalCount: 0,      // 商品总件数
      seatCode:null,
      remark: '',         // 备注信息
      isSubmitting: false // 防止重复提交
  },

  /**
   * 生命周期函数--监听页面加载
   * @param {Object} options - 页面跳转的参数 (包含 encodedData)
   */
  onLoad: function(options) {
      var encodedData = options.data; 
      const seatCode = options.seatCode;
      if (encodedData) {
          try {
              var decodedString = decodeURIComponent(encodedData);
              var checkoutData = JSON.parse(decodedString);
              
              if (checkoutData && checkoutData.orderItems) {
                  
                  // 【关键修正】: 在设置数据前，预处理规格信息
                  var processedItems = checkoutData.orderItems.map(function(item) {
                      // 为每个商品项添加一个格式化后的规格描述字段
                      item.formattedSpec = formatOptions(item); 
                      return item;
                  });
                  
                  this.setData({
                      seatCode:seatCode,
                      orderItems: processedItems, // 使用处理后的数据
                      totalAmount: checkoutData.totalAmount || '0.00',
                      totalCount: checkoutData.totalCount || 0,
                  });
              } else {
                  throw new Error("解析后的数据结构不正确");
              }
              
          } catch (e) {
              console.error("订单数据读取失败", e);
              wx.showToast({
                  title: '订单数据丢失或过长',
                  icon: 'error'
              });
              setTimeout(function() {
                  wx.navigateBack(); 
              }, 1500);
          }
      } else {
           wx.showToast({
              title: '未收到订单数据',
              icon: 'error'
          });
          setTimeout(function() {
              wx.navigateBack(); 
          }, 1500);
      }
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
   * 提交订单
   */
  onSubmitOrder: function() {
    var that = this; 
    if (that.data.isSubmitting) return;

    // 【关键修改 1】：从缓存中读取 userId
    var userInfo = wx.getStorageSync('userInfo') || {};
    var userId = userInfo.userId;

    if (!userId) {
        wx.showToast({ title: '请先登录获取用户ID', icon: 'none' });
        that.setData({ isSubmitting: false });
        return;
    }

    that.setData({ isSubmitting: true });

    // 1. 构造传递给云函数的订单数据
    var finalOrder = {
        products: that.data.orderItems,
        totalPrice: parseFloat(that.data.totalAmount),
        totalCount: that.data.totalCount,
        remark: that.data.remark.trim(),
        seatCode: that.data.seatCode, 
        
        // 移除 diningInfo
        storeName: "XXXXXX店", 
    };

    wx.showLoading({
        title: '正在创建订单...',
        mask: true
    });

    // 2. 调用云函数 createOrder
    wx.cloud.callFunction({
        name: 'createOrder', 
        data: {
            finalOrder: finalOrder,
            userId: userId // 【关键修改 2】：将 userId 独立传递
        },
        success: function(res) {
            wx.hideLoading();
            
            var result = res.result;

            if (result.success && result.orderId) {
                wx.showToast({
                    title: '订单已创建',
                    icon: 'success'
                });
                
                // 【关键跳转】：跳到订单详情页
                wx.redirectTo({
                    url: '/pages/meal/food/bill/index?orderId=' + result.orderId 
                });
            } else {
                that.handleOrderCreationFailure(result.errMsg || '订单创建失败，请重试');
            }
        },
        fail: function(err) {
            wx.hideLoading();
            that.handleOrderCreationFailure('网络错误，请检查连接');
            console.error('云函数 createOrder 调用失败', err);
        }
    });
},

    /**
     * 处理订单创建失败的统一方法
     */
    handleOrderCreationFailure: function(title) {
        wx.showToast({
            title: title,
            icon: 'none'
        });
        this.setData({ isSubmitting: false });
    },
});