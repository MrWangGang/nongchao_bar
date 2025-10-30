/**
 * 模拟排序函数：按指定键和升降序对列表排序
 * @param {Array} list - 待排序列表
 * @param {string} key - 排序依据的属性键 ('likes', 'collectionTime', 或 'id')
 * @param {string} order - 排序方向 ('asc' 升序, 'desc' 降序)
 * @returns {Array} 排序后的列表
 */
function sortList(list, key, order) {
  // 综合排序或无键时不进行实际排序
  if (key === '综合排序' || !key) {
    return list;
  }
  
  const isAscending = order === 'asc';

  return list.sort((a, b) => {
    let valA = a[key] || 0;
    let valB = b[key] || 0;

    // 根据 isAscending 决定返回值的正负
    // 如果是升序 (asc)，a < b 返回 -1；如果是降序 (desc)，a < b 返回 1
    if (valA < valB) {
      return isAscending ? -1 : 1;
    }
    if (valA > valB) {
      return isAscending ? 1 : -1;
    }
    return 0;
  });
}

Page({
  data: {
    activeTab: 'diy', 
    // activeSort 包含当前选中的键 (key) 和排序方向 (order)
    activeSort: { key: '综合排序', order: 'desc' }, 
    
    // 自制特调 (DIY) 列表 - 示例数据
    diyCocktails: [{
      id: 1, 
      name: '自定义名称 A', 
      price: '99.0', 
      likes: 313, 
      collectionTime: 1672531200000, 
      isFollowed: true, 
      image: '/images/cocktail1.png', 
      // 【修改】统一为 tags 数组
      tags: ['伏特加', '咖啡蜜', '利口酒']
    }, {
      id: 2, 
      name: '自定义名称 B', 
      price: '88.0', 
      likes: 120, 
      collectionTime: 1680307200000, 
      isFollowed: false, 
      image: '/images/cocktail2.png', 
      // 【修改】统一为 tags 数组
      tags: ['朗姆酒', '朗姆酒', '朗姆酒',  '薄荷', '薄荷'] // 示例多标签
    }, {
      id: 3, 
      name: '果味特调', 
      price: '110.0', 
      likes: 450, 
      collectionTime: 1698710400000, 
      isFollowed: false, 
      image: '/images/cocktail3.png', 
      // 【修改】统一为 tags 数组
      tags: ['威士忌','威士忌','威士忌','威士忌','威士忌']
    }],
    
    // 我的特调 (My) 列表 - 示例数据
    myCocktails: [{
      id: 101, 
      name: '我的自制 1号', 
      price: '120.0', 
      likes: 50, 
      collectionTime: 1669843200000, 
      isFollowed: true, 
      image: '/images/my_cocktail1.png', 
      // 【修改】统一为 tags 数组
      tags: ['威士忌', '柠檬', '糖浆']
    }, {
      id: 102, 
      name: '我的秘制配方', 
      price: '75.0', 
      likes: 30, 
      collectionTime: 1701379200000, 
      isFollowed: false, 
      image: '/images/my_cocktail2.png', 
      // 【修改】统一为 tags 数组
      tags: ['金酒', '青瓜', '汤力水']
    }],
    
    // 列表中实际渲染的数据
    activeList: [],
  },
  
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      // 这里的索引要与你在 custom-tab-bar/index.js 中 list 数组的索引对应
      // 菜单是索引 1
      this.getTabBar().setData({
        selected: 3
      })
    }
  },
  
  onLoad() {
    // 页面加载时初始化数据
    this.updateActiveList('diy', '综合排序', 'desc');
  },
  
  /**
   * 核心方法：更新当前显示的列表数据和排序状态
   */
  updateActiveList(tab, sortKey, sortOrder) {
    // 1. 确定数据源
    let sourceList = tab === 'diy' ? this.data.diyCocktails : this.data.myCocktails;
    let listToRender = [...sourceList]; // 复制一份，避免直接修改源数据

    // 2. 确定排序属性 (用于 sortList 函数)
    let sortProp = 'id'; // 综合排序默认按ID
    if (sortKey === '点赞数量') {
      sortProp = 'likes';
    } else if (sortKey === '收录时间') {
      sortProp = 'collectionTime'; // 时间戳，数字越大越新
    }
    
    // 3. 执行排序
    listToRender = sortList(listToRender, sortProp, sortOrder); 
    
    // 4. 更新视图
    this.setData({
      activeTab: tab,
      activeSort: { key: sortKey, order: sortOrder },
      activeList: listToRender
    });
  },
  
  /**
   * 切换 Tab 的事件处理
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    // Tab 切换时，将排序重置为“综合排序” (desc)
    this.updateActiveList(tab, '综合排序', 'desc');
  },

  /**
   * 排序项点击事件处理 (实现升降序切换)
   */
  sortBy(e) {
    const newKey = e.currentTarget.dataset.key;
    const currentSort = this.data.activeSort;
    let newOrder = 'desc'; // 默认降序 (箭头朝下)
    
    if (newKey === '综合排序') {
      // 综合排序不切换方向
      newOrder = 'desc'; 
    } else if (newKey === currentSort.key) {
      // 再次点击同一项：切换方向
      newOrder = currentSort.order === 'desc' ? 'asc' : 'desc';
    }
    
    // 更新列表并应用新排序
    this.updateActiveList(this.data.activeTab, newKey, newOrder);
  },
  
  /**
   * 点赞/取消按钮点击事件 (避免复杂编译语法)
   */
  handleLike(e) {
    const { index } = e.currentTarget.dataset;
    // 构建标准的 setData 路径
    const keyToUpdate = `activeList[${index}].isFollowed`;
    
    // 获取当前状态并取反
    const currentStatus = this.data.activeList[index].isFollowed;
    
    // 使用兼容性最好的 setData 方式更新
    this.setData({
      [keyToUpdate]: !currentStatus
    });
    
    // 提示：实际项目中，这里需要发送网络请求到服务器，并更新源数据 (diyCocktails/myCocktails)
  },
  
  /**
   * 下单按钮点击事件
   */
  handleOrder(e) {
    console.log('Handling order for ID:', e.currentTarget.dataset.id);
  },
  
  /**
   * 跳转到创建特调页
   */
  goToCreateCocktail() {
    wx.navigateTo({ url: '/pages/cocktail/choose/index' });
  }
})