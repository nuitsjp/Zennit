document.addEventListener('DOMContentLoaded', function() {
  const title = document.getElementById('title');
  const article = document.getElementById('article');
  const saveButton = document.getElementById('save');
  const titleError = document.getElementById('titleError');
  const articleError = document.getElementById('articleError');

  function validateInputs() {
    let isValid = true;

    if (!title.value.trim()) {
      title.classList.add('error');
      titleError.style.display = 'block';
      isValid = false;
    } else {
      title.classList.remove('error');
      titleError.style.display = 'none';
    }

    if (!article.value.trim()) {
      article.classList.add('error');
      articleError.style.display = 'block';
      isValid = false;
    } else {
      article.classList.remove('error');
      articleError.style.display = 'none';
    }

    saveButton.disabled = !isValid;
  }

  title.addEventListener('input', validateInputs);
  article.addEventListener('input', validateInputs);
  saveButton.addEventListener('click', validateInputs);

  // 初期状態でバリデーションを実行
  validateInputs();
});