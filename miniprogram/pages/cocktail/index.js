// /pages/stockList/stockList.js
const app = getApp(); // 在文件顶部获取 app 实例
Page({
    data: {
        activeTab: 'diy',
        activeSort: { key: '综合排序', order: 'asc' },
        activeList: [],
        page: 0,
        pageSize: 10,
        totalPages: 1,
        isLoading: false,
        isLoadComplete: false,
        currentUserId: null,
        sortKeyMap: {
            '综合排序': 'totalAmount',
            '点赞数量': 'likeCount',
            '收录时间': 'createdAt',
        },
        recipeName: '',
    },
    
    onShow: function () {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            this.getTabBar().setData({
                selected: 3
            });
        }
        // 每次显示时刷新数据，先更新 userId
        this.updateUserId();
        this.loadStockData(true);
    },
    
    onLoad() {
        // 注册全局登录回调, 登录成功后会自动触发 loadStockData(true)
        app.registerPageUpdateCallback(this.loadStockData.bind(this, true)); 

        this.updateUserId();
        this.loadStockData(true);
    },

    /**
     * 更新页面中的 currentUserId 字段
     */
    updateUserId() {
        const userInfo = wx.getStorageSync('userInfo') || {};
        const userId = userInfo.userId || userInfo.openid;
        this.setData({
            currentUserId: userId,
        });
    },

    /**
     * @function checkLoginOnly
     * @description 检查用户是否登录，未登录则弹出提示。
     * @returns {boolean} - true 表示已登录, false 表示未登录。
     */
    checkLoginOnly() {
        if (!this.data.currentUserId) {
            wx.showModal({
                title: '温馨提示',
                content: '请先登录您的账号，才能进行此操作。',
                confirmText: '好的',
                showCancel: false, 
            });
            return false;
        }
        return true;
    },

    // ---------------------- 核心数据加载 ----------------------

    loadStockData(isRefresh = false) {
        const that = this;
        
        if (that.data.isLoading) return;
        
        let pageToLoad = isRefresh ? 1 : that.data.page + 1;
        
        if (!isRefresh && pageToLoad > that.data.totalPages) {
            that.setData({ isLoadComplete: true });
            return;
        }

        const isUserList = that.data.activeTab === 'my';
        
        // 【加载我的列表时检查登录】
        if (isUserList && !that.data.currentUserId) {
            that.checkLoginOnly(); // 仅提示
            // 清空列表，防止显示旧数据
            that.setData({ 
                activeList: [], 
                isLoading: false, 
                isLoadComplete: true 
            });
            wx.stopPullDownRefresh();
            return;
        }

        that.setData({ 
            isLoading: true,
            isLoadComplete: false,
        });

        const functionName = isUserList ? 'getUserStockList' : 'getStockList';
        
        const sortKeyDB = that.data.sortKeyMap[that.data.activeSort.key] || 'totalAmount';
        const sortOrder = that.data.activeSort.order;

        let dataParams = {
            page: pageToLoad,
            pageSize: that.data.pageSize,
            orderBy: sortKeyDB, 
            order: sortOrder 
        };
        
        if (isUserList) {
            // isUserList 分支在前面已经检查过 userId
            dataParams.userId = that.data.currentUserId;
        }
        
        if (that.data.currentUserId && !dataParams.userId) {
            // 确保在加载公共列表时也传递当前用户ID，用于判断isFollowed
            dataParams.currentUserId = that.data.currentUserId;
        }

        wx.cloud.callFunction({
            name: functionName,
            data: dataParams,
            success: res => {
                const result = res.result;
                if (result.success && Array.isArray(result.data)) {
                    
                    const formattedData = result.data.map(item => {
                        
                        // ⭐ 1. 主名称修正：只使用 recipeName，没有则用默认值 '未命名配方' ⭐
                        const displayName = item.recipeName || '未命名配方';
                        
                        // 【修复 TypeError】确保 item.products 是一个有效的数组，否则使用空数组 []
                        const productsArray = item.products && Array.isArray(item.products) ? item.products : []; 
                        
                        // ⭐ 2. 标签修正：标签取前 5 个商品的 sampleName ⭐
                        const tags = productsArray.slice(0, 5).map(p => p.sampleName || p.name).filter(Boolean);

                        // ⭐ 3. 新增逻辑：格式化收录时间，只保留日期部分 ⭐
                        let createdDate = '';
                        if (item.createdAt) {
                            const date = new Date(item.createdAt);
                            // 格式化为 YYYY-MM-DD
                            createdDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
                        }
                        // -------------------------------------------------------------

                        return {
                            id: item._id, 
                            name: displayName, // 仅使用 recipeName 作为主名称
                            price: (item.totalAmount || 0).toFixed(2), 
                            likes: item.likeCount || 0, 
                            isFollowed: item.isFollowed || false, 
                            image: item.imageFileIds, 
                            tags: tags, // 使用 sampleName 列表作为标签
                            createdDate: createdDate, // 存储格式化后的日期
                        };
                    });

                    const newStockList = isRefresh 
                        ? formattedData
                        : that.data.activeList.concat(formattedData);
                        
                    const isComplete = result.page >= result.totalPages;

                    that.setData({
                        activeList: newStockList,
                        page: result.page,
                        totalPages: result.totalPages,
                        isLoadComplete: isComplete,
                    });
                } else {
                    wx.showToast({ title: result.errMsg || '数据加载失败', icon: 'none' });
                }
            },
            fail: err => {
                wx.showToast({ title: '网络请求失败', icon: 'none' });
            },
            complete: () => {
                that.setData({ isLoading: false });
                if (isRefresh) wx.stopPullDownRefresh();
            }
        });
    },

    // ---------------------- 交互事件 ----------------------

    /**
     * 切换 Tab 的事件处理
     */
    switchTab(e) {
        const newTab = e.currentTarget.dataset.tab;
        
        if (newTab === this.data.activeTab) return;

        // 【切换到“我的特调”时检查登录】
        if (newTab === 'my' && !this.data.currentUserId) {
             this.checkLoginOnly(); // 仅提示
             return; // 不切换Tab，停留在当前Tab
        }

        this.setData({
            activeTab: newTab,
            activeSort: { key: '综合排序', order: 'asc' }, 
        }, () => {
            this.loadStockData(true); 
        });
    },

    /**
     * 排序项点击事件处理 (实现升降序切换)
     */
    sortBy(e) {
        const newKey = e.currentTarget.dataset.key;
        const currentSort = this.data.activeSort;
        let newOrder; 

        if (newKey === '综合排序') {
            newOrder = currentSort.order === 'desc' ? 'asc' : 'desc'; 
        } else if (newKey === currentSort.key) {
            newOrder = currentSort.order === 'desc' ? 'asc' : 'desc';
        } else {
            newOrder = 'desc';
        }
        
        this.setData({
            activeSort: { key: newKey, order: newOrder }
        }, () => {
            this.loadStockData(true); 
        });
    },
    
    /**
     * 点赞/取消按钮点击事件 (标准逻辑)
     */
    handleLike(e) {
        // 【点赞/收藏操作检查登录】
        if (!this.checkLoginOnly()) {
            return; 
        }

        const { id, index } = e.currentTarget.dataset;
        // 当前状态
        const isFollowed = this.data.activeList[index].isFollowed; 
        
        // 目标状态：当前未点赞 -> 目标是点赞(true)
        const targetIsLiking = !isFollowed; 

        wx.showLoading({ 
            title: isFollowed ? '取消中...' : '点赞中...', 
            mask: true 
        });

        wx.cloud.callFunction({
            name: 'updateStockLike', 
            data: {
                stockId: id, 
                userId: this.data.currentUserId,
                isLiking: targetIsLiking // 发送目标状态 (标准逻辑)
            },
            success: res => {
                wx.hideLoading();
                if (res.result.success) {
                    
                    // 页面更新逻辑：切换到目标状态
                    const keyToUpdate = `activeList[${index}].isFollowed`;
                    const countKey = `activeList[${index}].likes`; 
                    
                    const likeChange = targetIsLiking ? 1 : -1;
                    const newLikeCount = this.data.activeList[index].likes + likeChange;

                    const updateObj = {};
                    updateObj[keyToUpdate] = targetIsLiking; 
                    updateObj[countKey] = newLikeCount; 

                    this.setData(updateObj);

                    // 提示信息根据最终状态确定
                    wx.showToast({ 
                        title: targetIsLiking ? '点赞成功' : '已取消收藏', 
                        icon: 'success' 
                    });
                } else {
                    wx.showToast({ title: res.result.errMsg || '操作失败', icon: 'none' });
                }
            },
            fail: err => {
                wx.hideLoading();
                wx.showToast({ title: '网络错误，操作失败', icon: 'none' });
            }
        });
    },
    
    /**
     * 下单按钮点击事件
     */
    handleOrder(e) {
        // 【下单操作检查登录】
        if (!this.checkLoginOnly()) {
            return; 
        }

        // 从事件对象中获取配方的 ID
        const cocktailId = e.currentTarget.dataset.id; 
        
        if (!cocktailId) {
            wx.showToast({ title: '配方ID缺失，无法下单', icon: 'none' });
            return;
        }
    
        // 跳转到 pages/cocktail/choose/bill/index 页面，并传递 cocktailId
        wx.navigateTo({
            url: `/pages/cocktail/choose/bill/index?cocktailId=${cocktailId}`
        });
    },
    
    /**
     * 跳转到创建特调页
     */
    goToCreateCocktail() {
        // 【创建特调检查登录】
        if (!this.checkLoginOnly()) {
            return; 
        }

        wx.navigateTo({ url: '/pages/cocktail/choose/index' });
    },
    
    /**
     * 生命周期钩子：上拉加载更多
     */
    onReachBottom: function() {
        if (!this.data.isLoading && !this.data.isLoadComplete) {
            this.loadStockData(false);
        }
    },

    /**
     * 生命周期钩子：下拉刷新
     */
    onPullDownRefresh: function() {
        this.updateUserId(); // 刷新时也更新一下 userId
        this.loadStockData(true);
    },
});