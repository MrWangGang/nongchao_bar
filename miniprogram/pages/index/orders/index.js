// /pages/myOrder/index.js
Page({
  data: {
    currentTab: 'store', // ⭐ 默认切换到门店订单
    reserveOrders: [],
    storeOrders: [], // ⭐ 门店订单列表
    isLoading: false,
    
    // 移除门店订单分页状态 (storePageNum, storePageSize, storeTotal, storeHasMore)
    
    // 图片路径映射 (用于预定订单)
    imageMap: {
      '包厢': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_包厢.png',
      '卡座': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_卡座.png',
      '散台': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_散台.png',
      'default': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_散台.png' // 默认值
    },
    // 门店订单：最大展示商品图片数量
    MAX_PRODUCT_IMAGES: 3
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    this.fetchStoreOrders(); // ⭐ 默认加载门店订单
  },
  
  /**
   * 移除 onReachBottom 页面事件处理函数
   */

  /**
   * 【新增】生命周期函数--监听页面显示
   * 每次页面被显示或从其他页面返回时触发，用于刷新列表数据。
   */
  onShow() {
    // 如果列表为空，则重新加载数据
    if (this.data.currentTab === 'store' && this.data.storeOrders.length === 0) {
      this.fetchStoreOrders();
    } else if (this.data.currentTab === 'reserve' && this.data.reserveOrders.length === 0) {
      this.fetchReserveOrders();
    }
  },

  switchTab(e) {
    const newTab = e.currentTarget.dataset.tab;
    if (newTab !== this.data.currentTab) {
      this.setData({
        currentTab: newTab
      });
      if (newTab === 'store') {
        // 切换到门店订单，如果数据为空则加载
        if (this.data.storeOrders.length === 0) {
          this.fetchStoreOrders();
        }
      } else if (newTab === 'reserve') {
        // 切换到预定订单，如果数据为空则加载
        if (this.data.reserveOrders.length === 0) {
          this.fetchReserveOrders(); 
        }
      }
    }
  },

  
  // ⭐ 核心函数：获取门店订单列表 (移除分页逻辑)
  fetchStoreOrders() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载门店订单...' });
    
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo ? userInfo.userId : null;
    if (!userId) {
      wx.hideLoading();
      this.setData({ isLoading: false, storeOrders: [] });
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 【修改点】调用 getUserMealOrders，不再传递分页参数
    wx.cloud.callFunction({
      name: 'getStoreOrders', // 修正云函数名称
      data: { 
        userId: userId,
        // 移除 pageSize 和 pageNum
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isLoading: false });

      if (res.result && res.result.success) {
        const rawOrders = res.result.data || [];
        const processedOrders = rawOrders.map(order => this.processStoreOrderData(order));
        
        // 【修改点】直接覆盖数据，不进行 concate 拼接
        this.setData({
          storeOrders: processedOrders,
        });

      } else {
        wx.showToast({ title: res.result.errMsg || '获取门店订单失败', icon: 'none' });
        this.setData({ storeOrders: [] });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isLoading: false });
      console.error('获取门店订单网络错误:', err);
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    });
  },

  // 核心函数：获取预定订单列表 (更名为 fetchReserveOrders) - 保持不变
  fetchReserveOrders() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载预定订单...' });
    
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo ? userInfo.userId : null;
    if (!userId) {
      wx.hideLoading();
      this.setData({ isLoading: false });
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.cloud.callFunction({
      name: 'getReserveOrders', // 假设云函数名
      data: { userId: userId }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isLoading: false });

      if (res.result && res.result.success) {
        const rawOrders = res.result.data || [];
        const processedOrders = rawOrders.map(order => this.processReserveOrderData(order)); // 修正函数名
        
        this.setData({
          reserveOrders: processedOrders
        });
      } else {
        wx.showToast({ title: res.result.errMsg || '获取订单失败', icon: 'none' });
        this.setData({ reserveOrders: [] });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isLoading: false });
      console.error('获取订单网络错误:', err);
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    });
  },

  // ⭐ 格式化和处理门店订单数据 (多商品展示) - 保持不变
  processStoreOrderData(order) {
    const createDate = new Date(order.createTime);
    const totalAmount = parseFloat(order.totalAmount || order.payment?.totalAmount || 0);

    const products = order.products || []; 
    const displayProducts = (products).slice(0, this.data.MAX_PRODUCT_IMAGES).map(p => ({
        name: p.name,
        image: p.image 
    }));
    
    const productNames = (products).map(p => p.name).join('、');
    
    const statusText = order.orderStatus === '已支付' ? '已完成' : (order.orderStatus || '未知状态'); 

    return {
      ...order,
      orderStatus: statusText, 
      createTime: this.formatDate(createDate, 'yyyy-MM-dd hh:mm:ss'), 
      displayProducts: displayProducts,
      productNames: productNames, 
      
      payment: {
        paidAmount: totalAmount.toFixed(2),
        totalCount: order.totalCount || (products).reduce((sum, p) => sum + (p.quantity || 0), 0)
      }
    };
  },


  // 格式化和处理预定订单数据 (单套餐展示) - 保持不变
  processReserveOrderData(order) {
    const arrivalDate = new Date(order.arrivalTime);
    const createDate = new Date(order.createTime);
    
    // 图片URL查找逻辑
    const seatType = order.seatInfo.seatType || '散台';
    let imageKey = 'default';
    if (seatType.includes('包厢')) {
      imageKey = '包厢';
    } else if (seatType.includes('卡座')) {
      imageKey = '卡座';
    } else if (seatType.includes('散台')) {
      imageKey = '散台';
    }
    const imageUrl = this.data.imageMap[imageKey];
    
    const paidAmount = (order.orderStatus === '待支付' ? order.comboInfo.price : order.payment.paidAmount);

    return {
      ...order,
      // 格式化下单时间
      createTime: this.formatDate(createDate, 'yyyy-MM-dd hh:mm:ss'),
      // 格式化最晚到店时间
      arrivalTime: this.formatDate(arrivalDate, 'yyyy-MM-dd hh:mm:ss'),
      // 处理套餐信息，将图片URL放入 packageInfo
      packageInfo: {
        ...order.comboInfo,
        imageUrl: imageUrl  
      },
      // 格式化价格，确保显示两位小数
      payment: {
        ...order.payment,
        paidAmount: parseFloat(paidAmount).toFixed(2)
      }
    };
  },

  // 日期格式化工具函数 (保持不变)
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

  /**
   * 跳转到订单详情页 (需要区分门店和预定)
   */
  goToDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type; // 'store' 或 'reserve'
    
    if (orderId) {
        let url;
        if (type === 'store') {
            // 假设门店订单详情页路径是 /pages/meal/food/bill/index
            url = `/pages/meal/food/bill/index?orderId=${orderId}`;
        } else {
            // 预定订单详情页路径
            url = `/pages/index/reserve/bill/index?orderId=${orderId}`;
        }
        wx.navigateTo({ url });
    }
  },
})