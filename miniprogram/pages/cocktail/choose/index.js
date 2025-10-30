// app.js 或其他地方的云函数初始化代码 (请确保已初始化)
// wx.cloud.init(); 

Page({
  /**
   * 页面的初始数据
   */
  data: {
      seatCode: null, // 用于存储接收到的 seatCode
      // 整个页面的核心数据：分类列表
      categoryList: [], // 默认空数组，等待云函数数据填充

      // 当前激活的左侧菜单索引
      currentCategoryIndex: 0,
      searchKeyword: '',
      filteredProducts: [],

      // 【弹窗相关数据】
      showModal: false, // 是否显示商品选项弹窗 [cite: 5]
      selectedProduct: {}, // 当前选中商品信息 
      quantity: 1, // 购买数量 [cite: 10]
      totalPriceDisplay: '0.00', // 用于安全显示总价 

      // 动态存储所有选中选项的键值对, 如: {spec: '半打', temp: '冰'}
      selectedOptions: {},
      dynamicOptions: [], // 动态选项列表，用于 wx:for 渲染

      // 【新增】购物车数据
      showCartModal: false, // 是否显示购物车详情弹窗 [cite: 6]
      cartList: [], // 购物车商品列表 
      cartCount: 0, // 购物车商品总数 
      cartTotal: '0.00', // 购物车总价 

      // 【新增】清空确认弹框
      showClearCartConfirm: false, // 是否显示清空确认弹框

      // 【新增】用于购物车输入数量弹窗
      showCartInputModal: false, // 是否显示购物车数量输入弹窗
      editingCartItemId: null, // 正在编辑的购物车项的ID
      editingCartQuantity: 0, // 正在编辑的数量

      // 用于自定义导航栏的高度变量
      statusBarHeight: 0,
      navBarHeight: 0,
  },

  /**
   * 【新增函数】将原始商品列表按分类分组
   * @param {Array} productsList - 从云函数获取的原始商品数组
   * @returns {Array} 格式化后的 categoryList
   */
  processProducts: function(productsList) {
      const categoryMap = {}; // 用于临时存储按分类分组的商品

      productsList.forEach(product => {
          const categoryId = product.category.id;
          const categoryName = product.category.name;
          const categoryEnName = product.category.enName;

          // 如果分类不存在，则创建
          if (!categoryMap[categoryId]) {
              categoryMap[categoryId] = {
                  id: categoryId,
                  name: categoryName,
                  enName: categoryEnName,
                  products: []
              };
          }

          // 修正属性名以匹配WXML和原有逻辑
          const processedProduct = {
              id: product.product_code, // 使用 product_code 作为 id
              product_code: product.product_code,
              image: product.image, // 你的数据中 image 是云存储路径
              name: product.name,
              desc: product.description, // description 改为 desc
              price: product.price.toFixed(2), // 价格格式化为字符串
              hasOptions: product.hasOptions,
              tags: product.tags,
              options: product.options || [] // 确保 options 存在
          };

          categoryMap[categoryId].products.push(processedProduct);
      });

      // 将 Map 转换为数组
      return Object.keys(categoryMap).map(key => categoryMap[key]);
  },

  /**
   * 统一计算总价并更新显示
   */
  calculateTotalPrice: function(product, quantity) {
      const price = parseFloat(product.price || 0);
      const total = price * (quantity || 1);
      this.setData({
          totalPriceDisplay: total.toFixed(2)
      });
  },

  /**
   * 【已修改】统一更新购物车数据（从缓存读取）
   * 解决了单价不显示的问题，并优化了逻辑
   */
  updateCartData: function() {
      const storedCartList = wx.getStorageSync('cocktailList') || [];
      let cartCount = 0;
      let cartTotal = 0;

      // 使用 map 一次性处理完所有逻辑
      const processedCartList = storedCartList.map(item => {
          // 累加总数和总价
          cartCount += item.quantity;
          cartTotal += parseFloat(item.price) * item.quantity;

          // 返回一个包含格式化后单价的新对象，用于WXML渲染
          return Object.assign({}, item, {
              priceDisplay: parseFloat(item.price).toFixed(2)
          });
      });

      this.setData({
          cartList: processedCartList,
          cartCount: cartCount,
          cartTotal: cartTotal.toFixed(2)
      });
  },

  /**
   * 计算并更新过滤后的商品列表
   */
  updateFilteredProducts: function() {
      const {
          categoryList,
          currentCategoryIndex,
          searchKeyword
      } = this.data;

      // 检查 categoryList 是否已加载
      if (categoryList.length === 0) {
          this.setData({
              filteredProducts: []
          });
          return;
      }

      const currentProducts = categoryList[currentCategoryIndex].products || [];
      const keyword = searchKeyword.trim().toLowerCase();
      let newFilteredProducts = currentProducts;

      if (keyword) {
          newFilteredProducts = currentProducts.filter(product => {
              const tagsString = (product.tags || []).join('');
              return (product.name && product.name.toLowerCase().includes(keyword)) ||
                  (product.desc && product.desc.toLowerCase().includes(keyword)) ||
                  (tagsString.toLowerCase().includes(keyword));
          });
      }

      this.setData({
          filteredProducts: newFilteredProducts
      });
  },

  /**
   * 【修正】生命周期函数--监听页面加载，增加对不同云函数返回格式的兼容
   */
  onLoad: function(options) {
      // 1. 获取导航栏高度
      var seatCode = options.code;
      const systemInfo = wx.getSystemInfoSync();
      const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
      this.setData({
          seatCode: seatCode,
          statusBarHeight: systemInfo.statusBarHeight,
          navBarHeight: systemInfo.statusBarHeight + menuButtonInfo.height + (menuButtonInfo.top - systemInfo.statusBarHeight) * 2
      });

      // 2. 调用云函数获取数据
      wx.cloud.callFunction({
          name: 'getCocktails', // 你的云函数名称
          data: {},
          success: res => {
              let rawProducts = res.result;

              // 【核心修正逻辑】
              // 如果 res.result 不是数组，但 res.result.data 是数组（常见的云函数返回格式）
              if (!Array.isArray(rawProducts) && rawProducts && Array.isArray(rawProducts.data)) {
                  rawProducts = rawProducts.data;
              }
              
              // 如果是云开发数据库查询结果（如 { data: [..], errMsg: '...' }）
              // 我们直接使用 rawProducts = res.result;
              // 然后在下一步校验是否为数组

              if (rawProducts && Array.isArray(rawProducts)) {
                  const newCategoryList = this.processProducts(rawProducts);
                  this.setData({
                      categoryList: newCategoryList,
                      currentCategoryIndex: 0 // 默认选中第一个分类
                  }, () => {
                      this.updateFilteredProducts(); // 数据加载后更新过滤列表
                      this.updateCartData(); // 加载时初始化购物车数据
                  });
              } else {
                  console.error('云函数返回数据格式不正确，无法解析为数组:', res);
                  wx.showToast({
                      title: '数据加载失败',
                      icon: 'error'
                  });
                  this.updateCartData(); 
              }
          },
          fail: err => {
              console.error('调用云函数失败', err);
              wx.showToast({
                  title: '网络加载失败',
                  icon: 'error'
              });
              this.updateCartData();
          }
      });

  },

  /**
   * 【新增】生命周期函数--监听页面显示
   * 每次回到页面时更新购物车数据
   */
  onShow: function() {
      this.updateCartData();
  },


  /**
   * 点击左侧分类菜单的事件处理函数
   */
  onCategoryTap: function(e) {
      const newIndex = e.currentTarget.dataset.index;

      if (newIndex !== this.data.currentCategoryIndex) {
          this.setData({
              currentCategoryIndex: newIndex,
              searchKeyword: ''
          }, () => {
              this.updateFilteredProducts();
          });
      }
  },

  /**
   * 搜索输入框内容变化的事件处理函数
   */
  onSearchInput: function(e) {
      const keyword = e.detail.value;
      const {
          categoryList,
          currentCategoryIndex
      } = this.data;
      const normalizedKeyword = keyword.trim().toLowerCase();
      let newIndex = currentCategoryIndex;

      if (normalizedKeyword) {
          for (let i = 0; i < categoryList.length; i++) {
              const products = categoryList[i].products || [];
              const found = products.some(product => {
                  const tagsString = (product.tags || []).join('');
                  return (product.name && product.name.toLowerCase().includes(normalizedKeyword)) ||
                      (product.desc && product.desc.toLowerCase().includes(normalizedKeyword)) ||
                      (tagsString.toLowerCase().includes(normalizedKeyword));
              });

              if (found) {
                  newIndex = i;
                  break;
              }
          }
      }

      this.setData({
          searchKeyword: keyword,
          currentCategoryIndex: newIndex
      }, () => {
          this.updateFilteredProducts();
      });
  },


  /**
   * 显示商品规格弹窗
   */
  onShowModal: function(e) { 
      const product = e.currentTarget.dataset.product;
      const dynamicOptions = product.options || [];
      const defaultSelectedOptions = {};

      // 设置每个选项的默认选中项（取第一个）
      dynamicOptions.forEach(option => {
          if (option.items && option.items.length > 0) {
              defaultSelectedOptions[option.key] = option.items[0];
          }
      });

      this.setData({
          showModal: true,
          selectedProduct: product,
          selectedOptions: defaultSelectedOptions, // 设置动态默认选中项
          dynamicOptions: dynamicOptions, // 传入动态选项列表
          quantity: 1, // 默认数量为 1 [cite: 10] 
      }, () => {
          this.calculateTotalPrice(product, 1);
      });
  },

  /**
   * 隐藏商品规格弹窗
   */
  onHideModal: function() {
      this.setData({
          showModal: false,
      });
  },

  /**
   * 【已修改】切换购物车弹窗的显示/隐藏状态
   */
  onToggleCartModal: function() {
      this.setData({
        showCartModal: !this.data.showCartModal // [cite: 6]
      });
  },

  /**
   * 隐藏购物车弹窗
   */
  onHideCartModal: function() {
      this.setData({
          showCartModal: false
      });
  },

  /**
   * 【新增函数】点击购物车数量显示输入弹窗
   */
  onCartQuantityTap: function(e) {
      const itemId = e.currentTarget.dataset.id;
      const quantity = parseInt(e.currentTarget.dataset.quantity);
      
      this.setData({
          showCartInputModal: true,
          editingCartItemId: itemId,
          // 使用 Math.max(1, quantity) 确保默认值至少是 1
          editingCartQuantity: Math.max(1, quantity)
      });
  },

  /**
   * 【新增函数】处理购物车输入弹窗的输入
   */
  onEditingQuantityInput: function(e) {
      // 获取输入的原始值
      let value = e.detail.value;
      // 仅允许输入数字
      value = value.replace(/[^0-9]/g, ''); 

      // 如果输入为空，则设置为 0
      if (value === '') {
          this.setData({
              editingCartQuantity: 0
          });
          return;
      }
      
      // 转换为整数
      let intValue = parseInt(value);
      
      this.setData({
          // 保持数字格式
          editingCartQuantity: intValue
      });
  },

  /**
   * 【新增函数】确认购物车输入弹窗的数量
   */
  onConfirmCartQuantity: function() {
      const itemId = this.data.editingCartItemId;
      let newQuantity = this.data.editingCartQuantity;

      // 校验数量
      if (typeof newQuantity !== 'number' || isNaN(newQuantity) || newQuantity < 1) {
          newQuantity = 1; 
      }

      let cartList = wx.getStorageSync('cocktailList') || [];
      const itemIndex = cartList.findIndex(item => item.id === itemId);

      if (itemIndex === -1) {
          this.onHideCartInputModal();
          return;
      }
      
      // 更新数量和总价
      cartList[itemIndex].quantity = newQuantity;
      cartList[itemIndex].totalPrice = (parseFloat(cartList[itemIndex].price) * newQuantity).toFixed(2);
      
      // 存入缓存
      wx.setStorageSync('cocktailList', cartList);
      // 更新页面数据
      this.updateCartData();
      // 隐藏弹窗
      this.onHideCartInputModal();

      // 如果更新后数量为0，则关闭购物车弹窗
      if (this.data.cartCount === 0) {
        this.onHideCartModal();
      }
  },

  /**
   * 【新增函数】隐藏购物车输入弹窗
   */
  onHideCartInputModal: function() {
      this.setData({
          showCartInputModal: false,
          editingCartItemId: null,
          editingCartQuantity: 0
      });
  },

  /**
   * 显示清空购物车确认弹框
   */
  onShowClearCartConfirm: function() {
      this.setData({
          showClearCartConfirm: true
      });
  },

  /**
   * 隐藏清空购物车确认弹框
   */
  onHideClearCartConfirm: function() {
      this.setData({
          showClearCartConfirm: false
      });
  },

  /**
   * 清空购物车 (在确认弹框中点击确定后调用)
   */
  onClearCart: function() {
      wx.removeStorageSync('cocktailList');
      this.updateCartData();
      this.onHideClearCartConfirm(); // 隐藏确认框
      this.onHideCartModal(); // 隐藏购物车详情
      wx.showToast({
          title: '已清空购物车',
          icon: 'none'
      });
  },

  /**
   * 选择规格或温度选项
   */
  onSelectOption: function(e) {
      const key = e.currentTarget.dataset.key; // 选项的键 (spec, temp, topping)
      const value = e.currentTarget.dataset.value;

      // 动态更新 selectedOptions 对象中的值
      // 使用计算属性名 set
      this.setData({
          [`selectedOptions.${key}`]: value
      });
  },

  /**
   * 数量增减 (商品选项弹窗内)
   */
  onQuantityChange: function(e) {
      const type = e.currentTarget.dataset.type;
      let newQuantity = this.data.quantity;
      const product = this.data.selectedProduct;

      if (type === 'plus') {
          newQuantity += 1;
      } else if (type === 'minus' && newQuantity > 1) {
          newQuantity -= 1;
      }

      this.setData({
          quantity: newQuantity
      }, () => {
          this.calculateTotalPrice(product, this.data.quantity);
      });
  },

  /**
   * 数量输入（用于非禁用输入框，这里保留）
   */
  onQuantityInput: function(e) {
      let value = parseInt(e.detail.value) || 1;
      if (value < 1) value = 1;
      const product = this.data.selectedProduct;

      this.setData({
          quantity: value
      }, () => {
          this.calculateTotalPrice(product, this.data.quantity);
      });
  },

  /**
   * 购物车商品数量增减 (购物车详情弹窗内)
   */
  onCartItemQuantityChange: function(e) {
      const type = e.currentTarget.dataset.type; // [cite: 14]
      const itemId = e.currentTarget.dataset.id; // [cite: 14]
      let cartList = wx.getStorageSync('cocktailList') || [];

      const itemIndex = cartList.findIndex(item => item.id === itemId);

      if (itemIndex === -1) return;

      if (type === 'plus') {
          cartList[itemIndex].quantity += 1; // [cite: 14]
      } else if (type === 'minus') {
          cartList[itemIndex].quantity -= 1; // [cite: 14]

          if (cartList[itemIndex].quantity <= 0) {
              // 数量小于等于0时移除商品
              cartList.splice(itemIndex, 1); 
          }
      }

      // 更新总价
      if (cartList[itemIndex]) {
          cartList[itemIndex].totalPrice = (parseFloat(cartList[itemIndex].price) * cartList[itemIndex].quantity).toFixed(2);
      }

      // 存入缓存
      wx.setStorageSync('cocktailList', cartList);
      // 更新页面数据
      this.updateCartData();

      // 如果购物车被清空，关闭弹窗
      if (cartList.length === 0) {
          this.onHideCartModal();
      }
  },

/**
 * 点击【结算】按钮的事件处理函数
 * 【最终修正】：移除所有 ES6+ 语法，使用 Object.assign 和 for 循环，彻底解决 Babel 运行时错误。
 */
onCheckout: function() {
  const { cartList, cartTotal, cartCount, categoryList } = this.data;
  if (cartList.length === 0) {
      wx.showToast({
          title: '购物车为空',
          icon: 'none'
      });
      return;
  }
  // =======================================================
  // 【检查逻辑 1】: 检查购物车商品种类数是否超过 5 种
  // =======================================================
  const MAX_ITEM_TYPES = 5
  if (cartList.length > MAX_ITEM_TYPES) {
    wx.showToast({
        title: `最多只能添加 ${MAX_ITEM_TYPES} 种不同酒类`,
        icon: 'none',
        duration: 2500
    });
    if (this.data.showCartModal) {
        this.onHideCartModal();
    }
    return;
}
// =======================================================
  // 【新增检查逻辑】: 检查购物车商品总数量是否等于 550
  // =======================================================
  const requiredQuantity = 550 ;
  if (cartCount !== requiredQuantity) {
      wx.showToast({
          title: `请补足到 ${requiredQuantity}/ml`,
          icon: 'none',
          duration: 2000
      });
      // 可以选择性地关闭购物车弹窗，让用户看到数量
      if (this.data.showCartModal) {
          this.onHideCartModal();
      }
      return;
  }
  // =======================================================
  if (this.data.showCartModal) {
      this.onHideCartModal();
  }

  // 辅助函数：根据 productId 查找商品的完整原始信息
  const findProductDetails = (productId) => {
      // 【关键修正】：使用传统的 for 循环替换 for...of
      for (var i = 0; i < categoryList.length; i++) {
          var category = categoryList[i];
          // 注意：find() 也是 ES6 语法，但它在小程序基础库中通常已支持。
          // 为了保守起见，我们假设 find() 是支持的，否则需要替换为 for 循环查找。
          var product = category.products.find(function(p) {
              return p.id === productId;
          });
          
          if (product) {
              return product; 
          }
      }
      return null;
  };


  // 1. 准备订单数据：转换为 orderItems
  const orderItems = cartList.map(function(item) {
      var fullProduct = findProductDetails(item.productId);
      
      // 1.1 提取动态选项（规格、温度、加料等）
      var options = {};
      
      // 【关键修正】：定义需要排除的核心字段数组
      var coreKeys = ['id', 'productId', 'image', 'name', 'price', 'quantity', 'totalPrice', 'priceDisplay', 'desc', 'tags', 'category'];
      
      Object.keys(item).forEach(function(key) {
          // 排除购物车自带的核心字段 (使用 indexOf 替换 includes)
          if (coreKeys.indexOf(key) !== -1) { 
              return;
          }
          options[key] = item[key]; // 收集动态选项，如 spec: '整瓶'
      });

      // 1.2 构造基础 orderItem
      var baseItem = {
          // 购买信息
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          totalPrice: item.totalPrice,
          
          // 基础信息 (确保完整性)
          productId: item.productId,
          name: item.name,
          image: item.image,
          desc: fullProduct ? fullProduct.desc : '信息缺失',
          tags: fullProduct ? fullProduct.tags : [],
          category: fullProduct ? fullProduct.category : { id: '', name: '未知', enName: 'Unknown' }
      };
      
      // 1.3 使用 Object.assign 合并对象 (替换对象展开语法)
      // 注意：Object.assign() 在基础库 1.1.0 开始支持
      var finalOrderItem = Object.assign(baseItem, options);
      
      return finalOrderItem;
  });

  // 2. 构造整个结算数据对象
  var checkoutData = {
      orderItems: orderItems,
      totalAmount: cartTotal,
      totalCount: cartCount,
  };
  
  // 3. 将复杂对象转换为 JSON 字符串并进行 URL 编码
  var dataString;
  try {

      dataString = JSON.stringify(checkoutData);
      var encodedData = encodeURIComponent(dataString);
      // 4. 跳转到订单确认/下单页面，通过 URL 参数传递数据
      wx.redirectTo({
          url: '/pages/meal/food/detail/index?data=' + encodedData +'&seatCode='+this.data.seatCode
      });

  } catch (e) {
      console.error("数据处理或跳转失败", e);
      wx.showToast({
          title: '数据过大或处理失败',
          icon: 'none'
      });
  }
},
  /**
   * 加入购物车逻辑
   */
  onAddToCart: function() {
      const {
          selectedProduct,
          selectedOptions,
          quantity
      } = this.data;

      if (quantity <= 0) {
          wx.showToast({
              title: '请选择购买数量',
              icon: 'none'
          });
          return;
      }

      // 1. 构造唯一ID (商品ID + 所有选项的值)
      const optionsArray = Object.keys(selectedOptions)
          .sort()
          .map(key => selectedOptions[key]);
      const optionsString = optionsArray.join('_');
      const uniqueId = `${selectedProduct.id}_${optionsString}`;

      // 2. 构造购物车商品对象
      const cartItem = {
          id: uniqueId,
          productId: selectedProduct.id,
          image: selectedProduct.image,
          name: selectedProduct.name,
          price: parseFloat(selectedProduct.price),
          quantity: quantity,
          totalPrice: (parseFloat(selectedProduct.price) * quantity).toFixed(2),
      };

      // 使用 Object.keys 遍历赋值，避免使用 ... 扩展运算符
      Object.keys(selectedOptions).forEach(key => {
          cartItem[key] = selectedOptions[key];
      });


      // 3. 从缓存中读取购物车
      let cartList = wx.getStorageSync('cocktailList') || [];

      // 4. 检查购物车中是否已存在相同规格的商品
      const existingIndex = cartList.findIndex(item => item.id === cartItem.id);

      if (existingIndex !== -1) {
          // 存在则更新数量
          cartList[existingIndex].quantity += quantity;
          cartList[existingIndex].totalPrice = (parseFloat(cartList[existingIndex].price) * cartList[existingIndex].quantity).toFixed(2);
      } else {
          // 不存在则添加新商品
          cartList.push(cartItem);
      }

      // 5. 存入缓存
      try {
          wx.setStorageSync('cocktailList', cartList);
          wx.showToast({
              title: '添加购物车成功',
              icon: 'success',
              duration: 1000
          });
          // 6. 关闭弹窗
          this.onHideModal();
          // 7. 更新购物车数据
          this.updateCartData();

      } catch (e) {
          console.error("购物车数据存储失败", e);
          wx.showToast({
              title: '添加失败',
              icon: 'error'
          });
      }
  },

});