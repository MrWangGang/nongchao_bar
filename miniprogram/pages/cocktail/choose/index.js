// app.js 或其他地方的云函数初始化代码 (请确保已初始化)
// wx.cloud.init(); 

// 定义最大数量限制
const MAX_QUANTITY = 999; 

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
      showModal: false, // 是否显示商品选项弹窗
      selectedProduct: {}, // 当前选中商品信息 
      quantity: 1, // 购买数量 
      totalPriceDisplay: '0.00', // 用于安全显示总价 

      // 动态存储所有选中选项的键值对, 如: {spec: '半打', temp: '冰'}
      selectedOptions: {},
      dynamicOptions: [], // 动态选项列表，用于 wx:for 渲染

      // 【新增】购物车数据
      showCartModal: false, // 是否显示购物车详情弹窗 
      cartList: [], // 购物车商品列表 
      cartCount: 0, // 购物车商品总数 
      cartTotal: '0.00', // 购物车总价 

      // 【新增】清空确认弹框
      showClearCartConfirm: false, // 是否显示清空确认弹框
      
      // 【新增】统一数量输入弹窗
      showQuantityInputModal: false, // 是否显示数量输入弹窗
      inputQuantityValue: 1, // 弹窗中的输入值
      targetQuantityType: 'cart', // 修正为默认 cart，但逻辑上仅用于 cart
      targetItemId: null, // 仅当 targetQuantityType === 'cart' 时使用

      // 用于自定义导航栏的高度变量
      statusBarHeight: 0,
      navBarHeight: 0,
  },

  // 购物车数量输入定时器，用于防抖
  cartQuantityTimer: null,


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
   * 【已修正】统一更新购物车数据（从缓存读取）
   * 确保返回的 item 包含所有原始属性，包括 selectedSpecs 数组。
   */
  updateCartData: function() {
      const storedCartList = wx.getStorageSync('cartList') || [];
      let cartCount = 0;
      let cartTotal = 0;

      // 使用 map 一次性处理完所有逻辑
      const processedCartList = storedCartList.map(item => {
          // 累加总数和总价
          cartCount += item.quantity;
          cartTotal += parseFloat(item.price) * item.quantity;

          // 确保所有原始属性（包括 selectedSpecs）都被复制，并添加 priceDisplay
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
              if (!Array.isArray(rawProducts) && rawProducts && Array.isArray(rawProducts.data)) {
                  rawProducts = rawProducts.data;
              }
              
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
          quantity: 1, // 默认数量为 1
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
          showCartModal: !this.data.showCartModal
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
      wx.removeStorageSync('cartList');
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
      
      // 限制最大数量
      if (newQuantity > MAX_QUANTITY) {
          newQuantity = MAX_QUANTITY;
          wx.showToast({
              title: `数量不能超过${MAX_QUANTITY}`,
              icon: 'none'
          });
      }
      // 确保数量始终大于等于 1
      if (newQuantity < 1) newQuantity = 1;


      this.setData({
          quantity: newQuantity
      }, () => {
          this.calculateTotalPrice(product, this.data.quantity);
      });
  },
  
  /**
   * 数量输入（商品选项弹窗内 - 直接输入）
   */
  onQuantityInput: function(e) {
      let value = parseInt(e.detail.value) || 1;
      
      // 限制最大数量
      if (value > MAX_QUANTITY) {
          value = MAX_QUANTITY;
          wx.showToast({
              title: `数量不能超过${MAX_QUANTITY}`,
              icon: 'none'
          });
      }
      if (value < 1) value = 1; // 确保数量大于等于 1
      
      const product = this.data.selectedProduct;

      // 延迟更新，避免频繁计算和渲染
      if (this.cartQuantityTimer) {
          clearTimeout(this.cartQuantityTimer);
      }

      this.setData({
          quantity: value
      });

      this.cartQuantityTimer = setTimeout(() => {
          this.calculateTotalPrice(product, this.data.quantity);
      }, 300); // 300ms 延迟
  },

  /**
   * 【新增函数】显示数量输入弹窗 (仅用于购物车)
   */
  onShowQuantityInputModal: function(e) {
      // 仅处理来自购物车的点击
      const { id, quantity } = e.currentTarget.dataset;
      let currentValue = parseInt(quantity) || 1;
      
      this.setData({
          showQuantityInputModal: true,
          inputQuantityValue: currentValue,
          targetItemId: id,
      });
  },
  
  /**
   * 【新增函数】隐藏数量输入弹窗
   */
  onHideQuantityInputModal: function() {
      this.setData({
          showQuantityInputModal: false,
      });
  },

  /**
   * 【新增函数】数量输入弹窗中的输入处理 (实时更新输入值)
   */
  onInputModalQuantity: function(e) {
      let value = parseInt(e.detail.value) || 0;
      
      // 实时限制最大数量
      if (value > MAX_QUANTITY) {
          value = MAX_QUANTITY;
          wx.showToast({ title: `数量不能超过${MAX_QUANTITY}`, icon: 'none' });
      }
      
      this.setData({
          inputQuantityValue: value
      });
  },

  /**
   * 【新增函数】数量输入弹窗确定按钮 (仅用于购物车)
   */
  onQuantityInputModalConfirm: function() {
      let newQuantity = parseInt(this.data.inputQuantityValue) || 1;
      
      // 最终修正：确保数量 >= 1
      newQuantity = Math.max(1, newQuantity);
      
      const itemId = this.data.targetItemId;
      let cartList = wx.getStorageSync('cartList') || [];
      const itemIndex = cartList.findIndex(item => item.id === itemId);

      if (itemIndex !== -1) {
          cartList[itemIndex].quantity = newQuantity;
          
          // 如果数量被设置为 0，移除它
          if (newQuantity === 0) {
              cartList.splice(itemIndex, 1);
          }
          
          this.updateCartItem(cartList, itemIndex);
      }
      this.onHideQuantityInputModal();
  },

  /**
   * 购物车商品数量增减 (购物车详情弹窗内)
   */
  onCartItemQuantityChange: function(e) {
      const type = e.currentTarget.dataset.type;
      const itemId = e.currentTarget.dataset.id;
      let cartList = wx.getStorageSync('cartList') || [];

      const itemIndex = cartList.findIndex(item => item.id === itemId);

      if (itemIndex === -1) return;

      if (type === 'plus') {
          cartList[itemIndex].quantity += 1;
          // 限制最大数量
          if (cartList[itemIndex].quantity > MAX_QUANTITY) {
              cartList[itemIndex].quantity = MAX_QUANTITY;
              wx.showToast({
                  title: `数量不能超过${MAX_QUANTITY}`,
                  icon: 'none'
              });
          }
      } else if (type === 'minus') {
          cartList[itemIndex].quantity -= 1;

          if (cartList[itemIndex].quantity <= 0) {
              // 数量小于等于0时移除商品
              cartList.splice(itemIndex, 1);
          }
      }
      
      this.updateCartItem(cartList, itemIndex);
  },
  
  /**
   * 统一处理购物车项的更新、缓存写入、数据刷新
   */
  updateCartItem: function(cartList, itemIndex) {
      // 检查列表是否为空
      if (cartList.length === 0) {
          wx.removeStorageSync('cartList');
          this.updateCartData(); 
          this.onHideCartModal(); // 购物车清空时关闭详情弹窗
          return;
      }
      
      // 更新总价
      if (cartList[itemIndex]) {
          cartList[itemIndex].totalPrice = (parseFloat(cartList[itemIndex].price) * cartList[itemIndex].quantity).toFixed(2);
      }
      
      // 存入缓存
      wx.setStorageSync('cartList', cartList);
      // 更新页面数据
      this.updateCartData();
  },

  /**
   * 点击【结算】按钮的事件处理函数
   */
  onCheckout: function() {
      const { cartList, cartTotal, cartCount, categoryList, seatCode } = this.data; 
      
      // 1. 检查购物车是否为空
      if (cartList.length === 0) {
          wx.showToast({
              title: '购物车为空',
              icon: 'none'
          });
          return;
      }

      // 2. 检查总数量限制 (必须等于 550)
      if (cartCount !== 550) {
            wx.showToast({
              title: `请补足 550ml ~_~`,
              icon: 'none',
              duration: 2000 
          });
          return;
      }

      // 3. 检查商品种类限制 (不能大于 5 种)
      if (cartList.length > 5) {
            wx.showToast({
              title: `最多选 5 种酒类 ~_~`,
              icon: 'none',
              duration: 2000
          });
          return;
      }

      // 如果通过所有检查，继续结算流程
      if (this.data.showCartModal) {
          this.onHideCartModal();
      }

      // 辅助函数：根据 productId 查找商品的完整原始信息 
      const findProductDetails = (productId) => {
          for (var i = 0; i < categoryList.length; i++) {
              var category = categoryList[i];
              var product = category.products.find(function(p) {
                  return p.id === productId;
              });
              
              if (product) {
                  return product; 
              }
          }
          return null;
      };


      // 4. 准备订单数据：转换为 orderItems
      const orderItems = cartList.map(function(item) {
          var fullProduct = findProductDetails(item.productId);
          
          // 构造 orderItem
          var finalOrderItem = {
              // 购买信息
              id: item.id,
              quantity: item.quantity,
              price: item.price,
              totalPrice: item.totalPrice,
              
              // 基础信息
              productId: item.productId,
              name: item.name,
              image: item.image,
              desc: fullProduct ? fullProduct.desc : '信息缺失',
              tags: fullProduct ? fullProduct.tags : [],
              category: fullProduct ? fullProduct.category : { id: '', name: '未知', enName: 'Unknown' },
              
              // 【核心修改】：直接传递规格数组，它是自由化的关键
              selectedSpecs: item.selectedSpecs || [] 
          };
          
          return finalOrderItem;
      });

      // 5. 构造整个结算数据对象
      var checkoutData = {
          orderItems: orderItems,
          totalAmount: cartTotal,
          totalCount: cartCount,
      };
      
      // 6. 将复杂对象转换为 JSON 字符串并进行 URL 编码
      var dataString;
      try {

          dataString = JSON.stringify(checkoutData);
          var encodedData = encodeURIComponent(dataString);
          
          // 7. 跳转到订单确认/下单页面，通过 URL 参数传递数据
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
          quantity,
          dynamicOptions // 使用 dynamicOptions 来获取规格的 'name' (例如: '规格', '温度')
      } = this.data;

      // 在这里再次校验数量，确保有效
      let finalQuantity = Math.max(1, parseInt(quantity) || 1); 
      
      // 限制最大数量
      if (finalQuantity > MAX_QUANTITY) {
          finalQuantity = MAX_QUANTITY;
      }

      if (finalQuantity <= 0) {
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

      // 【核心修改 A】：构造 selectedSpecs 数组，包含 key, name, value
      const selectedSpecs = [];
      
      // 遍历动态选项 dynamicOptions (来自云端商品数据)，查找用户选定的值
      dynamicOptions.forEach(option => {
          const specKey = option.key;   // 例如: 'spec'
          const specName = option.name; // 例如: '规格'
          
          // 检查用户是否对该规格进行了选择
          if (selectedOptions.hasOwnProperty(specKey)) {
              selectedSpecs.push({
                  key: specKey,
                  name: specName,
                  value: selectedOptions[specKey] // 用户选择的值
              });
          }
      });

      // 2. 构造购物车商品对象 (cartItem)
      const cartItem = {
          id: uniqueId,
          productId: selectedProduct.id,
          image: selectedProduct.image,
          name: selectedProduct.name,
          price: parseFloat(selectedProduct.price),
          quantity: finalQuantity,
          totalPrice: (parseFloat(selectedProduct.price) * finalQuantity).toFixed(2),
          
          // 【核心修改 B】：将规格数组添加到 cartItem
          selectedSpecs: selectedSpecs 
      };

      // 3. 从缓存中读取购物车
      let cartList = wx.getStorageSync('cartList') || [];
      const existingIndex = cartList.findIndex(item => item.id === cartItem.id);

      if (existingIndex !== -1) {
          // 存在则更新数量
          let newQuantity = cartList[existingIndex].quantity + finalQuantity;
          // 限制总和最大数量
          if (newQuantity > MAX_QUANTITY) {
              newQuantity = MAX_QUANTITY;
              wx.showToast({
                  title: `总数量不能超过${MAX_QUANTITY}`,
                  icon: 'none'
              });
          }
          
          cartList[existingIndex].quantity = newQuantity;
          cartList[existingIndex].totalPrice = (parseFloat(cartList[existingIndex].price) * cartList[existingIndex].quantity).toFixed(2);
          
          // 确保 selectedSpecs 存在
          if (!cartList[existingIndex].selectedSpecs || cartList[existingIndex].selectedSpecs.length === 0) {
              cartList[existingIndex].selectedSpecs = selectedSpecs;
          }

      } else {
          // 不存在则添加新商品
          cartList.push(cartItem);
      }

      // 4. 存入缓存
      try {
          wx.setStorageSync('cartList', cartList);
          // 5. 显示成功提示
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