// /pages/myOrder/index.js
Page({
  data: {
    currentTab: 'store', // 默认切换到门店订单
    reserveOrders: [],
    storeOrders: [], 
    cocktailOrders: [], // 特调订单列表
    isLoading: false,
    
    // 图片路径映射 (用于预定订单)
    imageMap: {
      '包厢': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_包厢.png',
      '卡座': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_卡座.png',
      '散台': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_散台.png',
      'default': 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/预约_散台.png' // 默认值
    },
    // 门店/特调订单：最大展示商品图片数量
    MAX_PRODUCT_IMAGES: 3
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    // ⭐ 修正点：根据 currentTab 的默认值 'store' 来加载数据
    this.fetchStoreOrders(); 
  },
  
  /**
   * 【新增】生命周期函数--监听页面显示
   * 每次页面被显示或从其他页面返回时触发，用于刷新列表数据。
   */
  onShow() {
    // 检查刷新标记
    var shouldRefresh = wx.getStorageSync('orderListShouldRefresh');
    if (shouldRefresh) {
      this.fetchCocktailOrders(); 
      this.fetchStoreOrders();
      this.fetchReserveOrders();
      // 清除标记
      wx.removeStorageSync('orderListShouldRefresh');
    } 
    
    // 检查当前 Tab 的数据是否为空，如果为空则加载（应对 onLoad 只加载默认 Tab 的情况）
    if (this.data.currentTab === 'cocktail' && this.data.cocktailOrders.length === 0) {
      this.fetchCocktailOrders();
    } else if (this.data.currentTab === 'store' && this.data.storeOrders.length === 0) {
      // 这里的逻辑在 onLoad 失败时会执行，保持不变
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
      if (newTab === 'cocktail') { 
        if (this.data.cocktailOrders.length === 0) {
          this.fetchCocktailOrders();
        }
      } else if (newTab === 'store') {
        if (this.data.storeOrders.length === 0) {
          this.fetchStoreOrders();
        }
      } else if (newTab === 'reserve') {
        if (this.data.reserveOrders.length === 0) {
          this.fetchReserveOrders(); 
        }
      }
    }
  },

  
  // 核心函数：获取特调订单列表
  fetchCocktailOrders() {
    if (this.data.isLoading) return;

    this.setData({ isLoading: true });
    wx.showLoading({ title: '加载特调订单...' });
    
    const userInfo = wx.getStorageSync('userInfo');
    const userId = userInfo ? userInfo.userId : null;
    if (!userId) {
      wx.hideLoading();
      this.setData({ isLoading: false, cocktailOrders: [] });
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 调用 getUserCocktailOrders 云函数
    wx.cloud.callFunction({
      name: 'getUserCocktailOrders', // 使用您指定的云函数名称
      data: { 
        userId: userId,
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isLoading: false });

      if (res.result && res.result.success) {
        const rawOrders = res.result.data || [];
        const processedOrders = rawOrders.map(order => this.processCocktailOrderData(order)); 
        
        this.setData({
          cocktailOrders: processedOrders,
        });

      } else {
        wx.showToast({ title: res.result.errMsg || '获取特调订单失败', icon: 'none' });
        this.setData({ cocktailOrders: [] });
      }
    }).catch(err => {
      wx.hideLoading();
      this.setData({ isLoading: false });
      console.error('获取特调订单网络错误:', err);
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    });
  },

  // 核心函数：获取门店订单列表
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

    // 调用 getStoreOrders
    wx.cloud.callFunction({
      name: 'getStoreOrders', // 假设云函数名称
      data: { 
        userId: userId,
      }
    }).then(res => {
      wx.hideLoading();
      this.setData({ isLoading: false });

      if (res.result && res.result.success) {
        const rawOrders = res.result.data || [];
        const processedOrders = rawOrders.map(order => this.processStoreOrderData(order));
        
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

  // 核心函数：获取预定订单列表
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
        const processedOrders = rawOrders.map(order => this.processReserveOrderData(order));
        
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
  
  // 格式化和处理特调订单数据 (已移除状态映射)
  processCocktailOrderData(order) {
    const createDate = new Date(order.createTime);
    const totalAmount = parseFloat(order.totalAmount || order.payment?.totalAmount || 0);

    // 特调订单的 products 字段可能包含一个或多个特调配方
    const products = order.products || []; 
    const displayProducts = (products).slice(0, this.data.MAX_PRODUCT_IMAGES).map(p => ({
        // 特调订单中，商品图片可能存储在 p.image 字段
        image: p.image || '默认图片URL' // 请替换为实际的默认图片URL
    }));
    
    // 【修改点 1】不再将 '已支付' 映射为 '已完成'
    const statusText = order.orderStatus || '未知状态'; 

    // ⭐⭐⭐ 新增逻辑：从 products 中提取 tagList (取前5个 sampleName 或 name) ⭐⭐⭐
    const productsArray = products && Array.isArray(products) ? products : []; 
    
    const tagList = productsArray
        .slice(0, 5)
        .map(p => p.sampleName || p.name) // 优先取 sampleName，其次取 name
        .filter(Boolean); // 过滤掉空值
    // ⭐⭐⭐ 新增逻辑结束 ⭐⭐⭐

    return {
      ...order,
      orderStatus: statusText, // 使用原始状态
      createTime: this.formatDate(createDate, 'yyyy-MM-dd hh:mm:ss'), 
      displayProducts: displayProducts,
      
      // 新增 tagList 字段
      tagList: tagList,
      
      // 特调订单可能有 recipeName 字段
      recipeName: order.recipeName || '用户自定义特调', 
      
      payment: {
        paidAmount: totalAmount.toFixed(2),
        totalCount: order.totalCount || (products).reduce((sum, p) => sum + (p.quantity || 0), 0)
      }
    };
  },

  // 格式化和处理门店订单数据 (多商品展示) - (已移除状态映射)
  processStoreOrderData(order) {
    const createDate = new Date(order.createTime);
    const totalAmount = parseFloat(order.totalAmount || order.payment?.totalAmount || 0);

    const products = order.products || []; 
    const displayProducts = (products).slice(0, this.data.MAX_PRODUCT_IMAGES).map(p => ({
        name: p.name,
        image: p.image 
    }));
    
    const productNames = (products).map(p => p.name).join('、');
    
    // 【修改点 2】不再将 '已支付' 映射为 '已完成'
    const statusText = order.orderStatus || '未知状态'; 

    return {
      ...order,
      orderStatus: statusText, // 使用原始状态
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

  // 日期格式化工具函数 - 保持不变
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
   * 跳转到订单详情页 (需要区分特调/门店/预定) - 保持不变
   */
  goToDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type; // 'cocktail', 'store' 或 'reserve'
    
    if (orderId) {
        let url;
        if (type === 'cocktail') {
            // 假设特调订单详情页路径是 /pages/cocktail/detail/index
            url = `/pages/cocktail/choose/pay/index?orderId=${orderId}`; 
        } else if (type === 'store') {
            // 门店订单详情页路径
            url = `/pages/meal/food/bill/index?orderId=${orderId}`;
        } else {
            // 预定订单详情页路径
            url = `/pages/index/reserve/bill/index?orderId=${orderId}`;
        }
        wx.navigateTo({ url });
    }
  },
})