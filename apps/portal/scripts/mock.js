(function () {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (args[0].includes('database.json')) {
      const data = await response.json();
      console.warn('🚀 Mock 系统已启动：正在注入测试存档...');

      const mockData = [];
      for (let i = 1; i <= 52; i++) {
        const baseItem = data[i % data.length] || data[0];

        // 构造极端情况
        let testName = `测试存档 ${i}`;
        let testTags = ['基础'];

        if (i % 4 === 1) {
          testName = `[超长标题测试] 这是一个超级超级超级超级长长长长长长长长长长的红石机器名称 ${i}`;
          testTags = ['1.16+', '生存友好', '高频率', '模块化', 'SIS', '堆叠式'];
        } else if (i % 4 === 2) {
          testName = `短标题 ${i}`;
          testTags = ['超级超级超级超级超级长的单标签测试'];
        } else {
          testTags = Array((i % 5) + 1)
            .fill(0)
            .map((_, idx) => `标签${idx}`);
        }

        mockData.push({
          ...baseItem,
          id: `test-id-${i}`,
          name: testName,
          preview: baseItem.preview,
          tags: testTags,
        });
      }
      return new Response(JSON.stringify(mockData));
    }
    return response;
  };
})();
