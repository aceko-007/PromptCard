// 覆盖卡片验证逻辑
window.validateCardForm = function() {
  return true; // 总是允许提交
};

// 修改保存逻辑处理空值
window.saveCard = function() {
  // 获取表单数据
  const cardTitle = document.getElementById('cardTitle')?.value.trim() || '未命名卡片';
  const cardDescription = document.getElementById('cardDescription')?.value.trim() || '空白提示词';
  const cardAuthor = document.getElementById('cardAuthor')?.value.trim() || '';
  const categoryName = document.querySelector('.category-name')?.textContent || 'AI对话';
  
  // 获取分类ID
  let categoryId = 'ai-chat'; // 默认分类
  const folders = window.appState?.folders || [];
  const folder = folders.find(f => f.name === categoryName);
  if (folder) {
    categoryId = folder.id;
  }
  
  // 获取模型和网站数据
  const selectedModels = Array.from(document.querySelectorAll('#selectedModels .model-tag'))
    .map(tag => tag.dataset.model);
  
  const selectedWebsites = Array.from(document.querySelectorAll('#selectedWebsites .platform-tag'))
    .map(tag => {
      return {
        name: tag.dataset.platform,
        url: tag.dataset.url || ''
      };
    });
  
  // 获取图片数据（如果有）
  const imageSection = document.querySelector('.image-section');
  let images = [];
  if (imageSection && imageSection.style.display !== 'none') {
    // 这是图片卡片
    const uploadedImages = document.querySelectorAll('.uploaded-image');
    images = Array.from(uploadedImages).map((img, index) => {
      return {
        path: img.dataset.path || img.src,
        isCover: index === 0 // 第一张图片作为封面
      };
    });
  }
  
  // 创建卡片数据
  const cardData = {
    type: images.length > 0 ? 'image' : 'text',
    title: cardTitle,
    description: cardDescription,
    author: cardAuthor,
    category: categoryId,
    models: selectedModels,
    websites: selectedWebsites,
    images: images
  };
  
  // 添加卡片
  const card = window.appState.addCard(cardData);
  
  // 关闭模态框并刷新卡片显示
  window.uiManager.closeModal();
  window.cardRenderer.renderCards();
  window.uiManager.updateCategoryCounts();
  window.uiManager.renderTagClouds();
  
  // 显示成功通知
  window.uiManager.showNotification('卡片创建成功', 'success');
  
  return card;
};