let count = 0;

const displayText = document.getElementById("display-text");
const button = document.getElementById("increment-btn");

function render() {
  const doubleCount = count * 2;
  displayText.textContent = `${count} * 2 = ${doubleCount}`;
}

button.addEventListener("click", () => {
  count++;
  render();
});
