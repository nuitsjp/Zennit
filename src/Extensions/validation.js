document.addEventListener('DOMContentLoaded', function() {
  const repositoryPath = document.getElementById('repositoryPath');
  const multilineString = document.getElementById('multilineString');
  const saveButton = document.getElementById('save');
  const repositoryPathError = document.getElementById('repositoryPathError');
  const multilineStringError = document.getElementById('multilineStringError');

  function validateInputs() {
    let isValid = true;

    if (!repositoryPath.value.trim()) {
      repositoryPath.classList.add('error');
      repositoryPathError.style.display = 'block';
      isValid = false;
    } else {
      repositoryPath.classList.remove('error');
      repositoryPathError.style.display = 'none';
    }

    if (!multilineString.value.trim()) {
      multilineString.classList.add('error');
      multilineStringError.style.display = 'block';
      isValid = false;
    } else {
      multilineString.classList.remove('error');
      multilineStringError.style.display = 'none';
    }

    saveButton.disabled = !isValid;
  }

  repositoryPath.addEventListener('input', validateInputs);
  multilineString.addEventListener('input', validateInputs);
  saveButton.addEventListener('click', validateInputs);

  // 初期状態でバリデーションを実行
  validateInputs();
});