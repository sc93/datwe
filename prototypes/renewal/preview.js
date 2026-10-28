// 디자인 검토 전용: 실제 추첨 조회·무작위 생성·영속 저장을 사용하지 않는다.
const byId = (id) => document.getElementById(id);
const checks = [...document.querySelectorAll('input[name="condition"]')];
const names = {
  recent: "최근 5회 제외",
  carry: "직전 번호 1개",
  odd: "홀수 3 · 짝수 3",
  sum: "합계 100~170",
  serial: "3연번 제외",
  balanced: "번호대 고른 분포",
  pattern: "마킹 패턴 제한",
};
const samples = [
  [7, 14, 23, 32, 38, 45],
  [4, 11, 22, 29, 36, 43],
  [2, 17, 24, 31, 39, 44],
];
let lucky = null;
let nameNumber = null;
let current = null;
let saved = [];
let generation = 0;
let mode = "lucky";
let failure = false;
const dialog = byId("number-dialog");
function color(n) {
  return n <= 10
    ? "yellow"
    : n <= 20
      ? "blue"
      : n <= 30
        ? "red"
        : n <= 40
          ? "gray"
          : "green";
}
function balls(numbers) {
  return numbers
    .map((n) => `<span class="ball ${color(n)}">${n}</span>`)
    .join("");
}
function selections() {
  return [
    ...(lucky ? [`행운 번호 ${lucky}`] : []),
    ...(nameNumber ? [`이름 번호 ${nameNumber}`] : []),
    ...checks.filter((c) => c.checked).map((c) => names[c.value]),
  ];
}
function hasConflict() {
  return (
    checks.find((c) => c.value === "recent").checked &&
    checks.find((c) => c.value === "carry").checked
  );
}
function clearResult() {
  current = null;
  byId("action-feedback").textContent = "";
  renderResult();
}
function renderConditions() {
  const selected = selections();
  byId("condition-count").textContent = checks.filter((c) => c.checked).length;
  byId("selected-summary").hidden = selected.length === 0;
  byId("selected-summary").textContent = selected.join(" · ");
  byId("button-condition-count").textContent = selected.length
    ? `선택한 조건 ${selected.length}개`
    : "선택한 조건 없음";
  byId("lucky-value").textContent = lucky ? `${lucky} ✓` : "선택 ＋";
  byId("name-value").textContent = nameNumber ? `${nameNumber} ✓` : "선택 ＋";
  byId("lucky-option").classList.toggle("is-selected", Boolean(lucky));
  byId("name-option").classList.toggle("is-selected", Boolean(nameNumber));
  byId("conflict").hidden = !hasConflict();
  byId("generate").disabled = hasConflict();
}
function renderResult() {
  const generated = Boolean(current);
  byId("empty-result").hidden = generated;
  byId("generated-result").hidden = !generated;
  byId("ticket-actions").hidden = !generated;
  byId("ticket-caption").hidden = generated;
  byId("ticket-stamp").hidden = generated;
  byId("ticket-id").textContent = generated
    ? `NO. ${String(generation).padStart(3, "0")}`
    : "NO. —";
  if (current) {
    byId("result-balls").innerHTML = balls(current);
    byId("result-balls").setAttribute(
      "aria-label",
      `예시 생성번호 ${current.join(", ")}`,
    );
    byId("result-conditions").textContent =
      selections().join(" · ") || "조건 없이 고른 여섯 번호";
    const duplicate = saved.some(
      (item) => item.numbers.join() === current.join(),
    );
    byId("save-result").textContent = duplicate
      ? "✓ 저장 완료"
      : "＋ 번호 저장";
    byId("save-result").disabled = duplicate;
  }
}
function renderSaved() {
  byId("saved-count").textContent = saved.length;
  byId("saved-list").innerHTML = saved.length
    ? saved
        .map(
          (item) =>
            `<article class="saved-item"><div class="saved-item-head"><span>나의 예시 조합</span><span>지금 저장</span></div><div class="saved-item-main"><div class="balls" aria-label="저장한 번호 ${item.numbers.join(", ")}">${balls(item.numbers)}</div><div class="saved-item-actions"><button class="text-button" data-copy="${item.id}" aria-label="${item.numbers.join(", ")} 복사">복사</button><button class="text-button remove-button" data-remove="${item.id}" aria-label="${item.numbers.join(", ")} 삭제">삭제</button></div></div><p class="result-conditions">${item.conditions.join(" · ") || "조건 없이 생성"}</p></article>`,
        )
        .join("")
    : '<div class="empty-saved">마음에 드는 번호를 여기에 모아두세요.</div>';
}
function renderData() {
  byId("draw-content").hidden = failure;
  byId("draw-failure").hidden = !failure;
  document.querySelector(".draw-date").hidden = failure;
  checks
    .filter((c) => ["recent", "carry"].includes(c.value))
    .forEach((c) => {
      c.disabled = failure;
      if (failure) c.checked = false;
    });
  renderConditions();
}
function generate(scroll = true) {
  if (hasConflict()) return;
  generation++;
  // 조건 적용 화면을 보기 위한 고정 예시이며 제품의 생성 규칙을 구현하지 않는다.
  const fixed = [...new Set([lucky, nameNumber].filter(Boolean))];
  current = [
    ...fixed,
    ...samples[(generation - 1) % samples.length].filter(
      (n) => !fixed.includes(n),
    ),
  ]
    .slice(0, 6)
    .sort((a, b) => a - b);
  renderResult();
  byId("action-feedback").textContent = selections().length
    ? "디자인 확인용 예시 결과예요. 실제 조건 계산은 후속 티켓에서 구현해요."
    : "";
  if (scroll)
    byId("result-heading").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  byId("generated-result").classList.remove("reveal");
  requestAnimationFrame(() => byId("generated-result").classList.add("reveal"));
}
function save() {
  if (!current) return;
  if (saved.some((item) => item.numbers.join() === current.join())) {
    byId("action-feedback").textContent = "이미 저장한 번호예요.";
    return;
  }
  if (saved.length >= 10) {
    byId("action-feedback").textContent =
      "최대 10개까지 저장할 수 있어요. 저장한 번호를 정리해 주세요.";
    return;
  }
  saved.unshift({
    id: generation,
    numbers: [...current],
    conditions: selections(),
  });
  renderSaved();
  renderResult();
  byId("action-feedback").textContent =
    "이번 주의 기대를 저장했어요. 시안에서는 새로고침하면 초기화돼요.";
}
async function copy(numbers) {
  try {
    await navigator.clipboard.writeText(numbers.join(", "));
    byId("action-feedback").textContent = "번호를 복사했어요.";
  } catch {
    byId("action-feedback").textContent =
      "복사하지 못했어요. 브라우저의 클립보드 권한을 확인해 주세요.";
  }
}
function openPersonal(kind) {
  mode = kind;
  const isName = kind === "name";
  byId("dialog-title").textContent = isName
    ? "이름으로 고른 번호"
    : "꼭 넣을 번호";
  byId("dialog-description").textContent = isName
    ? "이름이 번호가 되는 화면을 미리 살펴보세요."
    : "생성할 조합에 포함할 번호를 골라주세요.";
  byId("input-label").textContent = isName ? "이름" : "행운 번호 (1~45)";
  const input = byId("personal-input");
  input.type = isName ? "text" : "number";
  input.value = isName ? "" : (lucky ?? "");
  input.maxLength = 20;
  byId("dialog-note").textContent = isName
    ? "시안에서는 입력한 이름을 저장하지 않고 예시 번호 17을 사용해요."
    : "입력한 번호 한 개를 포함해요.";
  dialog.showModal();
}
function resetAll() {
  lucky = null;
  nameNumber = null;
  current = null;
  saved = [];
  generation = 0;
  failure = false;
  checks.forEach((c) => {
    c.checked = false;
    c.disabled = false;
  });
  byId("advanced").open = false;
  document.querySelector(".history").open = false;
  byId("action-feedback").textContent = "";
}
function setState(value) {
  resetAll();
  if (["selected", "generated", "saved"].includes(value)) {
    lucky = 7;
    checks.find((c) => c.value === "odd").checked = true;
  }
  if (value === "conflict") {
    byId("advanced").open = true;
    checks
      .filter((c) => ["recent", "carry"].includes(c.value))
      .forEach((c) => (c.checked = true));
  }
  if (value === "failure") failure = true;
  renderData();
  renderResult();
  renderSaved();
  if (["generated", "saved"].includes(value)) generate(false);
  if (value === "saved") save();
}
byId("history-list").innerHTML = Array.from(
  { length: 5 },
  (_, i) =>
    `<div class="history-row"><div class="history-info"><strong>제 ${5 - i}회 · 예시</strong><small>2026. 10. ${String(24 - i * 7).padStart(2, "0")}</small></div><div class="balls">${balls(i === 0 ? [3, 12, 19, 27, 34, 42] : samples[(i - 1) % samples.length])}<span class="history-plus">+</span>${balls([8 + i])}</div></div>`,
).join("");
// 예시 날짜도 유효한 달력 날짜만 표시한다.
[...document.querySelectorAll(".history-info small")].forEach((el, i) => {
  el.textContent = [
    "2026. 10. 24.",
    "2026. 10. 17.",
    "2026. 10. 10.",
    "2026. 10. 03.",
    "2026. 09. 26.",
  ][i];
});
byId("preview-state").addEventListener("change", (e) =>
  setState(e.target.value),
);
checks.forEach((c) =>
  c.addEventListener("change", () => {
    clearResult();
    renderConditions();
  }),
);
byId("reset").addEventListener("click", () => {
  lucky = null;
  nameNumber = null;
  checks.forEach((c) => (c.checked = false));
  clearResult();
  renderConditions();
});
byId("generate").addEventListener("click", () => generate());
byId("save-result").addEventListener("click", save);
byId("copy-result").addEventListener("click", () => current && copy(current));
byId("retry-draw").addEventListener("click", () => {
  failure = false;
  renderData();
  byId("preview-state").value = "default";
});
byId("lucky-option").addEventListener("click", () => openPersonal("lucky"));
byId("name-option").addEventListener("click", () => openPersonal("name"));
byId("close-dialog").addEventListener("click", () => dialog.close());
byId("clear-personal").addEventListener("click", () => {
  if (mode === "lucky") lucky = null;
  else nameNumber = null;
  clearResult();
  renderConditions();
  dialog.close();
});
byId("number-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (mode === "lucky") {
    const n = Number(byId("personal-input").value);
    if (!Number.isInteger(n) || n < 1 || n > 45) return;
    lucky = n;
  } else {
    if (!byId("personal-input").value.trim()) return;
    nameNumber = 17;
  }
  byId("personal-input").value = "";
  clearResult();
  renderConditions();
  dialog.close();
});
byId("saved-list").addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  if (button.dataset.remove) {
    saved = saved.filter((item) => item.id !== Number(button.dataset.remove));
    renderSaved();
    renderResult();
    byId("action-feedback").textContent = "저장한 번호를 삭제했어요.";
  }
  if (button.dataset.copy) {
    const item = saved.find((item) => item.id === Number(button.dataset.copy));
    if (item) copy(item.numbers);
  }
});
const initial = new URLSearchParams(location.search).get("state");
byId("preview-state").value = [...byId("preview-state").options].some(
  (o) => o.value === initial,
)
  ? initial
  : "default";
setState(byId("preview-state").value);
