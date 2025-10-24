// /pages/order/detail/index.js
const app = getApp()

// 图片映射 (保持不变)
const IMAGE_MAP = {
  '包厢': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_包厢.png',
  '卡座': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_卡座.png',
  '散台': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_散台.png',
};

Page({
  data: {
    orderInfo: null,
    // 初始倒计时设置为 15:00
    countdown: '15:00',
    timer: null
  },

  onLoad(options) {
    const orderId = options.orderId;
    if (orderId) {
      this.fetchOrderDetail(orderId);
    } else {
      wx.showToast({ title: '订单ID错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  fetchOrderDetail(orderId) {
    wx.showLoading({ title: '加载中...' });

    wx.cloud.callFunction({
      name: 'getOrderDetail',
      data: { orderId: orderId }
    }).then(res => {
      wx.hideLoading();
      if (res.result && res.result.success) {
        this.renderOrderData(res.result.data);
      } else {
        wx.showToast({ title: res.result.errMsg || '加载失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    });
  },

  renderOrderData(data) {
    const arrivalTime = new Date(data.arrivalTime);
    const bookingFullDate = new Date(data.arrivalTime);
    const createTime = new Date(data.createTime);
    const paymentTime = data.payment.paymentTime ? new Date(data.payment.paymentTime) : null;

    const seatName = data.seatInfo.name;
    let imageKey = '散台';
    if (seatName.includes('包厢')) {
      imageKey = '包厢';
    } else if (seatName.includes('卡座')) {
      imageKey = '卡座';
    }

    const processedData = {
      ...data,
      arrivalTime: `${String(arrivalTime.getHours()).padStart(2, '0')}:${String(arrivalTime.getMinutes()).padStart(2, '0')}`,
      createTime: this.formatDate(createTime, 'yyyy/MM/dd hh:mm:ss'),
      bookingDate: {
        formattedDate: this.formatDate(bookingFullDate, 'yyyy年MM月dd日'),
        dayOfWeek: '周' + '日一二三四五六'.charAt(bookingFullDate.getDay())
      },
      packageInfo: {
        ...data.comboInfo,
        capacity: data.seatInfo.description,
        imageUrl: IMAGE_MAP[imageKey] || IMAGE_MAP['散台'],
      },
      payment: {
        ...data.payment,
        paymentTime: paymentTime ? this.formatDate(paymentTime, 'yyyy/MM/dd hh:mm:ss') : null
      }
    };

    this.setData({
      orderInfo: processedData
    });

    // 仅在订单状态为“待支付”时启动倒计时
    if (data.orderStatus === '待支付') {
      // 假设订单创建后有 15 分钟的支付时间
      const expireTime = createTime.getTime() + 15 * 60 * 1000;
      this.startCountdown(expireTime);
    } else if (this.data.timer) {
      // 如果状态不是待支付，则清除任何可能存在的定时器
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  /**
   * 支付倒计时函数
   */
  startCountdown(endTime) {
    if (this.data.timer) clearInterval(this.data.timer);

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = endTime - now;

      if (distance <= 0) {
        clearInterval(timer);
        
        // **【修改】倒计时结束：只停止定时器并把倒计时显示为 00:00，不自动取消订单**
        this.setData({
          countdown: '00:00',
          timer: null
        });
        
        // TODO: 删除调用云函数通知后端订单已取消的代码
        // wx.showToast({ title: '订单超时，已自动取消', icon: 'none' }); // 删除此行
        // 在此处调用云函数通知后端订单已取消的代码也删除
        
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      this.setData({
        countdown: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      });
    }, 1000);

    this.setData({ timer });
  },

  formatDate(date, fmt) {
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
  },

  // --- 页面事件处理函数：按钮保持禁用状态（功能上阻断）---

/**
   * 【保留】取消订单逻辑：确保只有待支付才能取消
   */
    cancelOrder() {
      const orderId = this.data.orderInfo && this.data.orderInfo._id;
      const status = this.data.orderInfo && this.data.orderInfo.orderStatus;
      
      if (status !== '待支付') {
          wx.showToast({ title: `订单状态为 ${status}，无法取消`, icon: 'none' });
          return;
      }
      if (!orderId) {
          wx.showToast({ title: '订单信息缺失', icon: 'none' });
          return;
      }

      wx.showModal({
          title: '提示',
          content: '确定要取消此订单吗？',
          success: (res) => {
              if (res.confirm) {
                  wx.showLoading({ title: '正在取消...', mask: true });
                  wx.cloud.callFunction({
                      name: 'updateOrder',
                      data: {
                          orderId: orderId,
                          updateData: { orderStatus: '订单取消' }
                      }
                  }).then(res => {
                      wx.hideLoading();
                      if (res.result && res.result.success) {
                          wx.showToast({ title: '订单已取消', icon: 'success' });
                          if (this.data.timer) clearInterval(this.data.timer);
                          setTimeout(() => {
                              wx.navigateBack();
                          }, 1500); 
                      } else {
                          wx.showToast({ title: res.result.errMsg || '取消失败', icon: 'none' });
                      }
                  }).catch(err => {
                      wx.hideLoading();
                      console.error('取消订单失败:', err);
                      wx.showToast({ title: '网络请求失败', icon: 'none' });
                  });
              }
          }
      })
  },

  /**
   * 【保留】立即支付逻辑：确保只有待支付才能支付
   */
  payNow() {
      const orderId = this.data.orderInfo && this.data.orderInfo._id;
      const status = this.data.orderInfo && this.data.orderInfo.orderStatus;

      if (status !== '待支付') {
          wx.showToast({ title: `订单状态为 ${status}，无法支付`, icon: 'none' });
          return;
      }
      if (!orderId) {
          wx.showToast({ title: '订单信息缺失', icon: 'none' });
          return;
      }

      wx.showModal({
          title: '确认支付',
          content: `确定支付 ¥ ${this.data.orderInfo.comboInfo.price} 吗？`,
          success: (res) => {
              if (res.confirm) {
                  wx.showLoading({ title: '正在支付...', mask: true });

                  // 模拟支付成功更新订单状态
                  const transactionId = 'PAY' + Date.now() + Math.floor(Math.random() * 99999);
                  const paymentTime = new Date();

                  wx.cloud.callFunction({
                      name: 'updateOrder',
                      data: {
                          orderId: orderId,
                          updateData: {
                              orderStatus: '已支付',
                              'payment.paymentMethod': '线上支付',
                              'payment.paymentTime': paymentTime,
                              'payment.transactionId': transactionId,
                              'payment.paidAmount': this.data.orderInfo.comboInfo.price
                          }
                      }
                  }).then(res => {
                      wx.hideLoading();
                      if (res.result && res.result.success) {
                          wx.showToast({ title: '支付成功！', icon: 'success' });
                          if (this.data.timer) clearInterval(this.data.timer);

                          setTimeout(() => {
                              wx.navigateBack();
                          }, 1500);

                      } else {
                          wx.showToast({ title: res.result.errMsg || '支付失败', icon: 'none' });
                      }
                  }).catch(err => {
                      wx.hideLoading();
                      console.error('支付失败:', err);
                      wx.showToast({ title: '网络请求失败', icon: 'none' });
                  });
              }
          }
      });
  },

  copyOrderNo() {
    // 修正：使用 orderInfo.orderNo
    wx.setClipboardData({
      data: this.data.orderInfo.orderNo,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      }
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

  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  }
});