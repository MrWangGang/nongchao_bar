// custom-tab-bar/index.js

Component({
  data: {
    selected: 0,
    color: "#8A8A8A",
    selectedColor: "#1296db",
    list: [
      { "pagePath": "/pages/index/index", "text": "首页" },
      { "pagePath": "/pages/meal/index", "text": "菜单" },
      { "pagePath": "/pages/game/index", "text": "游戏" },
      { "pagePath": "/pages/cocktail/index", "text": "调酒" },
      { "pagePath": "/pages/myself/index", "text": "我的" }
    ]
  },
  methods: {
    // 修改后的 switchTab 方法
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      // 只负责跳转，不设置 data
      wx.switchTab({ url });
    }
  }
});