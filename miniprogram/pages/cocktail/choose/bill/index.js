const app = getApp()

function formatDate(date, fmt) {
    const o = {
        'M+': date.getMonth() + 1, 'd+': date.getDate(), 'h+': date.getHours(),
        'm+': date.getMinutes(), 's+': date.getSeconds(),
    };
    if (/(y+)/.test(fmt)) {
        fmt = fmt.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (let k in o) {
        if (new RegExp('(' + k + ')').test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (('00' + o[k]).substr(('' + o[k]).length)));
        }
    }
    return fmt;
}

function formatOptions(item) {
    const specs = item.selectedSpecs || [];
    
    var optionsText = specs.map(function(spec) {
        return spec && spec.value ? spec.value : null;
    });

    return optionsText.filter(Boolean).join('，');
}

Page({
    data: {
        orderId: '',
        orderDetail: null,
        loading: true,
        showAllProducts: false,
        personCount: 2,
        tableNumber: 23, // 保持在 data 中，但不再用于下单

        orderItems: [],
        totalCount: 0,
        totalAmount: '0.00',

        recipeName: '',
        remark: '',
        uploadedImages: [],
        isSubmitting: false, // 控制按钮状态
        orderStatusMap: {
            '待支付': { title: '待支付', tip: '请在指定时间内完成支付' },
            '已支付': { title: '订单已支付', tip: '商家正在准备您的商品' },
            // 添加其他可能的订单状态...
        }
    },

    copyOrderNo() {
        if (!this.data.orderDetail || !this.data.orderDetail.no) {
            wx.showToast({ title: '订单编号缺失', icon: 'none' });
            return;
        }
        wx.setClipboardData({
            data: this.data.orderDetail.no,
            success: () => {
                wx.showToast({ title: '已复制', icon: 'success' });
            }
        });
    },

    onLoad: function (options) {
        const orderId = options.cocktailId;
        console.log(orderId)
        if (orderId) {
            this.setData({ orderId });
            this.fetchOrderDetail(orderId);
        } else {
            wx.showToast({ title: '缺少订单ID', icon: 'none' });
            this.setData({ loading: false });
        }
    },
    
    fetchOrderDetail: function (orderId) {
        wx.cloud.callFunction({
            name: 'getStockDetailById',
            data: {
                stockId: orderId
            },
            success: (res) => {
                const result = res.result;
                if (result.success && result.data) {
                    let detail = result.data;
                    
                    if (detail.products && Array.isArray(detail.products)) {
                        detail.products = detail.products.map(function(item) {
                            item.formattedSpec = formatOptions(item);
                            item.price = item.price ? item.price : '0.00'; 
                            item.quantity = item.quantity ? item.quantity : 1;
                            return item;
                        });
                    }

                    const totalCount = detail.products.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const totalAmount = detail.totalAmount || '0.00'; 
                    
                    const initialRecipeName = detail.name || '';
                    const initialRemark = detail.remark || '';
                    const initialImages = detail.image && detail.image !== '/images/default.png' ? [detail.image] : [];
                    
                    const seatNumber = detail.seatInfo ? detail.seatInfo.name : '未知';

                    const createTimeDate = new Date(detail.createTime);
                    detail.formattedCreateTime = formatDate(createTimeDate, 'yyyy/MM/dd hh:mm:ss');

                    this.setData({
                        orderDetail: detail,
                        loading: false,
                        tableNumber: seatNumber,
                        
                        orderItems: detail.products, 
                        totalCount: totalCount, 
                        totalAmount: totalAmount, 

                        recipeName: initialRecipeName,
                        remark: initialRemark,
                        uploadedImages: initialImages,
                    });
                } else {
                    wx.showModal({ title: '查询失败', content: result.errMsg || '未找到订单详情', showCancel: false });
                    this.setData({ loading: false });
                }
            },
            fail: (err) => {
                console.error('调用云函数失败', err);
                wx.showToast({ title: '网络错误', icon: 'none' });
                this.setData({ loading: false });
            }
        });
    },

    // ------------------------------------------------
    // 图片处理逻辑 (仅预览)
    // ------------------------------------------------
    onChooseImage: function() {
        if (this.data.uploadedImages.length > 0) {
            wx.previewImage({
                current: this.data.uploadedImages[0], 
                urls: this.data.uploadedImages      
            });
        }
    },
    
    // ------------------------------------------------
    // 🚀 下单函数 (已移除 seatInfo 传递)
    // ------------------------------------------------
    payNow: function () {
      // 1. 获取 userId
      const userInfo = wx.getStorageSync('userInfo') || {};
      const userId = userInfo.userId || userInfo.openid;
      
      const { orderItems, totalAmount, totalCount, recipeName, remark, uploadedImages } = this.data; // 移除了 tableNumber
      
      // 关键校验：确保用户ID和订单数据存在
      if (!userId) {
          wx.showToast({ title: '用户身份信息缺失，请登录或重试', icon: 'none' });
          return;
      }
      if (orderItems.length === 0 || !totalAmount) {
          wx.showToast({ title: '订单商品或金额信息缺失', icon: 'none' });
          return;
      }

      this.setData({ isSubmitting: true });
      wx.showLoading({ title: `正在创建订单...` });
      
      // 准备发给云函数的数据
      const productsToSend = orderItems;

      wx.cloud.callFunction({
          name: 'createCocktailOrder', // 调用下单云函数
          data: {
              userId: userId, 
              products: productsToSend, // 直接传递完整的商品对象数组
              totalAmount: totalAmount,
              totalCount: totalCount,
              recipeName: recipeName,
              remark: remark,
              uploadedImages: uploadedImages,
              // *** 移除了 seatInfo 传递 ***
              orderStatus: '待支付' // 保持状态为待支付
          },
          success: (res) => {
              wx.hideLoading();
              this.setData({ isSubmitting: false });
              
              const result = res.result;
              if (result.success) {
                  const newOrderId = result.data._id;
                  const orderNo = result.data.orderNo;
                  
                  
                  console.log(`订单创建成功，ID: ${newOrderId}，订单号: ${orderNo}，状态：待支付`);
                  
                  // 订单创建成功后：
                  setTimeout(() => { 
                      // 设置刷新标记
                      this.setRefreshFlag(); 
                      // 跳转到支付页或订单详情页
                      wx.redirectTo({
                        url: '/pages/cocktail/choose/pay/index?orderId='+newOrderId,
                      }); 
                  }, 1000); 

              } else {
                  // 云函数会返回用户有待支付订单的错误提示
                  wx.showModal({ 
                      title: '下单失败', 
                      content: result.errMsg || '请稍后再试', 
                      showCancel: false 
                  });
              }
          },
          fail: (err) => {
              wx.hideLoading();
              this.setData({ isSubmitting: false });
              console.error('调用下单云函数失败', err);
              wx.showToast({ title: '网络错误，下单失败', icon: 'none' });
          }
      });
  },
    
    // ------------------------------------------------
    // 🚀 模拟支付逻辑 (旧的，通常应该移除或重命名)
    // ------------------------------------------------
    mockPayNow: function () {
        const { orderDetail, totalAmount } = this.data;
        
        if (!orderDetail) {
            wx.showToast({ title: '订单信息未加载', icon: 'none' });
            return;
        }

        this.setData({ isSubmitting: true });
        wx.showLoading({ title: `模拟支付 ¥${totalAmount}...` });
        
        // 模拟支付成功
        setTimeout(() => {
            wx.hideLoading();
            this.setData({ isSubmitting: false });
            
            // 模拟清空购物车缓存 (可选)
            try { wx.removeStorageSync('cartList'); } catch (e) { console.error(e); }
            
            wx.showToast({ title: '支付成功', icon: 'success' });

            // 0.5秒后跳转回上级页面
            setTimeout(() => { 
                this.setRefreshFlag(); // 设置刷新标记
                wx.navigateBack(); 
            }, 500); 

        }, 1500); // 模拟网络延迟 1.5 秒
    },

    // ------------------------------------------------
    // 其它辅助功能
    // ------------------------------------------------
    toggleProducts: function () {
        this.setData({
            showAllProducts: true 
        });
    },

    makePhoneCall: function () {
        if (app.globalData.shopInfo && app.globalData.shopInfo.phone) {
            wx.makePhoneCall({ phoneNumber: app.globalData.shopInfo.phone });
        }
    },

    openLocation: function () {
        if (app.globalData.shopInfo) {
            const { latitude, longitude, name, address } = app.globalData.shopInfo;
            wx.openLocation({ latitude, longitude, name, address, scale: 18 });
        }
    },
    setRefreshFlag: function() {
      wx.setStorageSync('orderListShouldRefresh', true);
    },
    // 匹配 WXML 中的取消按钮
    cancelOrder: function() {
        wx.showToast({ title: '取消订单功能待实现', icon: 'none' });
        // TODO: 调用云函数更新订单状态为 '已取消'
    }
});