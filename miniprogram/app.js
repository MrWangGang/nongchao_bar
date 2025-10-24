// app.js
App({
  globalData: {
    selectedTabIndex: 0, // 可以在这里设置一个初始值
    shopInfo: {
      phone: '010-12345678',             // 【请替换】你的全局店铺电话
      name: '三里屯XX酒吧',               // 【请替换】你的店铺名称
      address: '北京市朝阳区三里屯路19号', // 【请替换】你的店铺中文地址
      // ✅ 新增真实的经纬度
      latitude: 39.93411,
      longitude: 116.45502
    }
  },
  onLaunch: function () {
    wx.cloud.init({
      env: "cloud1-7gy6iiv5f0cbcb43",
      traceUser: true,
    });
  },
  // 👇 --- 添加以下代码 --- 👇

  // 1. 创建一个数组，用于存放需要刷新数据的页面回调函数
  pageUpdateCallbacks: [],

  /**
   * 2. 提供一个“登记”方法，让页面可以把自己的刷新函数存进来
   * @param {function} callback 页面里的刷新函数 (例如页面的 loadData)
   */
  registerPageUpdateCallback(callback) {
    if (callback && typeof callback === 'function') {
      this.pageUpdateCallbacks.push(callback);
    }
  },

  /**
   * 3. 登录成功后的全局处理函数
   * authorize 组件登录成功后，会调用这个方法
   */
  onLoginSuccess() {
    console.log("全局登录成功事件被触发！");
    // 遍历执行所有登记过的页面刷新函数
    this.pageUpdateCallbacks.forEach(callback => {
      callback();
    });
    // 你也可以在这里处理其他全局事务...
  }

  // 👆 --- 添加以上代码 --- 👆
});
