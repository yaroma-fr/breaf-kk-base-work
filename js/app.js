document.addEventListener("DOMContentLoaded", function () {
  initAuthenticatedUserInfo();

  initDynamicFields();
  initStagesTable();
  initPaymentsTable();

  initExclusiveCheckboxGroup(
    "ipItems",
    "Ні, нічого з цього",
    handleIpDetailsVisibility,
  );

  initExclusiveCheckboxGroup("fileLinks", "Відсутній");

  handleIpDetailsVisibility();

  initCostBlock();

  initDownloadWordButton();
  initValidationReset();
  initDraftAutosave(); // має бути останнім
});

/* ================================
   HELPERS
================================ */

function getRadioValue(name) {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : "";
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function showElementById(id, shouldShow) {
  const element = document.getElementById(id);

  if (!element) {
    console.warn("Element not found:", id);
    return;
  }

  if (shouldShow) {
    element.classList.remove("hidden");
  } else {
    element.classList.add("hidden");
  }
}

function collectCheckedValues(name) {
  const checked = document.querySelectorAll(`input[name="${name}"]:checked`);

  return Array.from(checked).map(function (item) {
    return item.value;
  });
}

function parseNumber(value) {
  const n = parseFloat(String(value).replace(/\s/g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

async function initAuthenticatedUserInfo() {
  try {
    const response = await fetch("/.auth/me");

    if (!response.ok) {
      console.warn("Cannot load authenticated user info");
      return;
    }

    const authData = await response.json();

    if (!authData || !authData.clientPrincipal) {
      console.warn("No authenticated user found");
      return;
    }

    const userEmail = authData.clientPrincipal.userDetails || "";
    const managerEmailInput = document.getElementById("managerEmail");

    if (managerEmailInput && userEmail) {
      managerEmailInput.value = userEmail;
    }
  } catch (error) {
    console.error("Failed to get authenticated user info:", error);
  }
}

/* ================================
   DYNAMIC FIELDS
================================ */

function initDynamicFields() {
  // Який документ потрібно підготувати -> Інше
  document
    .querySelectorAll('input[name="documentType"]')
    .forEach(function (radio) {
      radio.addEventListener("change", function () {
        showElementById(
          "documentOtherRow",
          getRadioValue("documentType") === "Інше",
        );
      });
    });

  // ПДВ -> заголовки «Сума з ПДВ» та поля вартості
  document
    .querySelectorAll('input[name="contractorVat"]')
    .forEach(function (radio) {
      radio.addEventListener("change", function () {
        updateVatHeaders();
        recalcCost();
      });
    });

  updateVatHeaders();

  // Юридична особа
  document
    .querySelectorAll('input[name="legalEntity"]')
    .forEach(function (radio) {
      radio.addEventListener("change", function () {
        showElementById(
          "legalOtherRow",
          getRadioValue("legalEntity") === "Інше",
        );
      });
    });

  // Чи працювали з підрядником раніше
  document
    .querySelectorAll('input[name="workedBefore"]')
    .forEach(function (radio) {
      radio.addEventListener("change", function () {
        showElementById(
          "workedBeforeDetailsRow",
          getRadioValue("workedBefore") === "Так",
        );
      });
    });

  // Чи працює у Вчасно
  document.querySelectorAll('input[name="vchasno"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      showElementById("vchasnoEmailRow", getRadioValue("vchasno") === "Так");
    });
  });

  // Етапи/Акти -> Інше / таблиця етапів
  document
    .querySelectorAll('input[name="timingFormat"]')
    .forEach(function (radio) {
      radio.addEventListener("change", function () {
        const value = getRadioValue("timingFormat");

        showElementById("timingFormatOtherRow", value === "Інше");
        showElementById(
          "section-stages",
          value === "Кілька етапів і окремий акт по кожному етапу",
        );
      });
    });
}

// Заголовки «Сума» у таблицях: для платника ПДВ — «Сума з ПДВ»
function updateVatHeaders() {
  const isVatPayer = getRadioValue("contractorVat") === "Так";
  const text = isVatPayer ? "Сума з ПДВ" : "Сума";

  ["stageAmountHeader", "paymentAmountHeader"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

/* ================================
   COST (розділ 6)
   Платник ПДВ: вводять лише «Загальна вартість з ПДВ»,
   «без ПДВ» і «ПДВ» рахуються автоматично.
   Не платник: вводять «Загальна вартість без ПДВ».
================================ */

function initCostBlock() {
  const withVatEl = document.getElementById("costWithVat");

  if (withVatEl) {
    withVatEl.addEventListener("input", recalcCost);
  }

  recalcCost();
}

function recalcCost() {
  const VAT_RATE = 0.2;
  const isVatPayer = getRadioValue("contractorVat") === "Так";

  const withVatEl = document.getElementById("costWithVat");
  const noVatEl = document.getElementById("costNoVat");
  const vatEl = document.getElementById("vatAmount");

  if (!withVatEl || !noVatEl || !vatEl) return;

  showElementById("costWithVatRow", isVatPayer);
  showElementById("vatAmountRow", isVatPayer);

  if (isVatPayer) {
    noVatEl.readOnly = true;
    noVatEl.placeholder = "Авто";
    vatEl.readOnly = true;
    vatEl.placeholder = "Авто";

    const withVat = parseNumber(withVatEl.value);
    const noVat = withVat / (1 + VAT_RATE);

    noVatEl.value = withVat ? noVat.toFixed(2) : "";
    vatEl.value = withVat ? (withVat - noVat).toFixed(2) : "";
  } else {
    noVatEl.readOnly = false;
    noVatEl.placeholder = "";
    vatEl.value = "";
    withVatEl.value = "";
  }
}

/* ================================
   IP / CHECKBOX GROUPS
================================ */

function initExclusiveCheckboxGroup(groupName, noneValue, afterChange) {
  const checkboxes = document.querySelectorAll(`input[name="${groupName}"]`);

  checkboxes.forEach(function (checkbox) {
    checkbox.addEventListener("change", function () {
      const isNoneOption = checkbox.value === noneValue;

      if (isNoneOption && checkbox.checked) {
        checkboxes.forEach(function (item) {
          if (item.value !== noneValue) {
            item.checked = false;
          }
        });
      }

      if (!isNoneOption && checkbox.checked) {
        checkboxes.forEach(function (item) {
          if (item.value === noneValue) {
            item.checked = false;
          }
        });
      }

      if (typeof afterChange === "function") {
        afterChange();
      }
    });
  });
}

function handleIpDetailsVisibility() {
  const selectedIpItems = collectCheckedValues("ipItems");

  const shouldShowDetails =
    selectedIpItems.length > 0 &&
    !selectedIpItems.includes("Ні, нічого з цього");

  showElementById("ipDetailsBlock", shouldShowDetails);

  if (!shouldShowDetails) {
    ["ipDescription", "usageRestrictions"].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }
}

/* ================================
   STAGES TABLE
================================ */

function initStagesTable() {
  const addStageBtn = document.getElementById("addStageBtn");
  const stagesTable = document.getElementById("stagesTable");

  if (!addStageBtn || !stagesTable) {
    console.warn("Stages elements not found");
    return;
  }

  addStageBtn.addEventListener("click", function () {
    addStageRow();
  });

  stagesTable.addEventListener("click", function (event) {
    if (event.target.classList.contains("remove-row")) {
      const row = event.target.closest("tr");

      if (row) {
        row.remove();
        renumberStages();
      }
    }
  });
}

function addStageRow() {
  const tbody = document.querySelector("#stagesTable tbody");

  if (!tbody) {
    console.warn("Stages tbody not found");
    return;
  }

  const row = document.createElement("tr");

  row.innerHTML = `
        <td class="stage-number"></td>
        <td>
            <textarea name="stageWork[]" placeholder="Опишіть роботи"></textarea>
        </td>
        <td>
            <input name="stagePeriod[]" type="text" placeholder="01.09 - 15.09">
        </td>
        <td>
            <input name="stageAmount[]" type="text" placeholder="10000">
        </td>
        <td>
            <button type="button" class="icon-button remove-row">×</button>
        </td>
    `;

  tbody.appendChild(row);
  renumberStages();
}

function renumberStages() {
  const numbers = document.querySelectorAll("#stagesTable .stage-number");

  numbers.forEach(function (cell, index) {
    cell.textContent = index + 1;
  });
}

/* ================================
   PAYMENTS TABLE
================================ */

function initPaymentsTable() {
  const addPaymentBtn = document.getElementById("addPaymentBtn");
  const paymentsTable = document.getElementById("paymentsTable");

  if (!addPaymentBtn || !paymentsTable) {
    console.warn("Payments elements not found");
    return;
  }

  addPaymentBtn.addEventListener("click", function () {
    addPaymentRow();
  });

  paymentsTable.addEventListener("click", function (event) {
    if (event.target.classList.contains("remove-row")) {
      const row = event.target.closest("tr");

      if (row) {
        row.remove();
        renumberPayments();
      }
    }
  });
}

function addPaymentRow() {
  const tbody = document.querySelector("#paymentsTable tbody");

  if (!tbody) {
    console.warn("Payments tbody not found");
    return;
  }

  const row = document.createElement("tr");

  row.innerHTML = `
        <td class="payment-number"></td>
        <td>
            <input name="paymentAmount[]" type="text" placeholder="10000">
        </td>
        <td>
            <input name="paymentDate[]" type="date">
        </td>
        <td>
            <textarea name="paymentComment[]" placeholder="Коментар"></textarea>
        </td>
        <td>
            <button type="button" class="icon-button remove-row">×</button>
        </td>
    `;

  tbody.appendChild(row);
  renumberPayments();
}

function renumberPayments() {
  const numbers = document.querySelectorAll("#paymentsTable .payment-number");

  numbers.forEach(function (cell, index) {
    cell.textContent = index + 1;
  });
}

/* ================================
   COLLECT DATA
================================ */

function collectBriefData() {
  return {
    general: {
      managerName: getValue("managerName"),
      managerEmail: getValue("managerEmail"),
      clientName: getValue("clientName"),
      projectName: getValue("projectName"),
      documentType: getDocumentType(),
    },

    legal: {
      legalEntity: getLegalEntity(),
      legalOther: getValue("legalOther"),
      legalEntityType: getRadioValue("legalEntity"),
    },

    contractor: {
      contractorName: getValue("contractorName"),
      contractorVat: getRadioValue("contractorVat"),
      worksectionLink: getValue("worksectionLink"),
      contractorEmail: getValue("contractorEmail"),
      contractorPhone: getValue("contractorPhone"),
      workedBefore: getRadioValue("workedBefore"),
      workedBeforeDetails: getValue("workedBeforeDetails"),
      vchasno: getRadioValue("vchasno"),
      vchasnoEmail: getValue("vchasnoEmail"),
    },

    services: {
      serviceShortName: getValue("serviceShortName"),
      serviceDescription: getValue("serviceDescription"),
      serviceExtation: getValue("serviceExtation"),
    },

    timing: {
      startDate: getValue("startDate"),
      finishDate: getValue("finishDate"),
      timingFormat: getTimingFormat(),
    },

    stages: collectStages(),

    cost: {
      costNoVat: getValue("costNoVat"),
      vatAmount: getValue("vatAmount"),
      costWithVat: getValue("costWithVat"),
      currency: getValue("currency"),
    },

    payments: collectPayments(),

    intellectualProperty: {
      ipItems: collectCheckedValues("ipItems"),
      ipDescription: getValue("ipDescription"),
      usageRestrictions: getValue("usageRestrictions"),
    },

    risks: {
      riskConditions: getValue("riskConditions"),
    },

    files: {
      fileLinks: collectCheckedValues("fileLinks"),
      additionalLinks: getValue("additionalLinks"),
    },
  };
}

function getDocumentType() {
  const value = getRadioValue("documentType");

  if (value === "Інше") {
    return getValue("documentOther");
  }

  return value;
}

function getLegalEntity() {
  const value = getRadioValue("legalEntity");

  if (value === "Інше") {
    return getValue("legalOther");
  }

  return value;
}

function getTimingFormat() {
  const value = getRadioValue("timingFormat");

  if (value === "Інше") {
    return getValue("timingFormatOther");
  }

  return value;
}

function collectStages() {
  const timingFormat = getRadioValue("timingFormat");

  if (timingFormat !== "Кілька етапів і окремий акт по кожному етапу") {
    return [];
  }

  const rows = document.querySelectorAll("#stagesTable tbody tr");

  return Array.from(rows).map(function (row, index) {
    return {
      stageNo: index + 1,
      work: row.querySelector('[name="stageWork[]"]')?.value.trim() || "",
      period: row.querySelector('[name="stagePeriod[]"]')?.value.trim() || "",
      amount: row.querySelector('[name="stageAmount[]"]')?.value.trim() || "",
    };
  });
}

function collectPayments() {
  const rows = document.querySelectorAll("#paymentsTable tbody tr");

  return Array.from(rows).map(function (row, index) {
    return {
      paymentNo: index + 1,
      amount: row.querySelector('[name="paymentAmount[]"]')?.value.trim() || "",
      payDate: row.querySelector('[name="paymentDate[]"]')?.value || "",
      comment:
        row.querySelector('[name="paymentComment[]"]')?.value.trim() || "",
    };
  });
}

/* ================================
   DOWNLOAD WORD
================================ */

function initDownloadWordButton() {
  const button = document.getElementById("downloadWordBtn");

  if (!button) {
    console.warn("downloadWordBtn not found");
    return;
  }

  button.addEventListener("click", function () {
    if (!validateForm()) {
      return;
    }

    const data = collectBriefData();
    const html = buildWordDocumentHtml(data);

    downloadWordDocument(html, data);
  });
}

/* ================================
   VALIDATION (усі видимі поля обов'язкові)
================================ */

function isVisible(el) {
  return !el.closest(".hidden");
}

function validateForm() {
  const form = document.getElementById("briefForm");
  const errors = [];

  form.querySelectorAll(".field-error").forEach(function (el) {
    el.classList.remove("field-error");
  });

  // Текстові поля, textarea, дати, email
  form.querySelectorAll("input, textarea, select").forEach(function (el) {
    if (["radio", "checkbox", "button", "file", "hidden"].includes(el.type)) {
      return;
    }

    // Автоматичні (readonly) поля не перевіряємо
    if (el.readOnly || el.disabled || el.dataset.optional === "true") return;
    if (!isVisible(el)) return;

    const emptyValue = !el.value.trim();
    const badEmail = el.type === "email" && el.value && !el.checkValidity();

    if (emptyValue || badEmail) {
      el.classList.add("field-error");
      errors.push(el);
    }
  });

  // Радіокнопки: має бути обрано один варіант
  const radioNames = new Set();

  form.querySelectorAll('input[type="radio"]').forEach(function (radio) {
    radioNames.add(radio.name);
  });

  radioNames.forEach(function (name) {
    const radios = Array.from(
      form.querySelectorAll(`input[type="radio"][name="${name}"]`),
    );

    if (!radios.some(isVisible)) return;

    if (
      !radios.some(function (r) {
        return r.checked;
      })
    ) {
      const box = radios[0].closest(".radio-group") || radios[0];
      box.classList.add("field-error");
      errors.push(box);
    }
  });

  // Чекбокси: має бути обрано хоча б один варіант
  const checkNames = new Set();

  form.querySelectorAll('input[type="checkbox"]').forEach(function (box) {
    checkNames.add(box.name);
  });

  checkNames.forEach(function (name) {
    const boxes = Array.from(
      form.querySelectorAll(`input[type="checkbox"][name="${name}"]`),
    );

    if (!boxes.some(isVisible)) return;

    if (
      !boxes.some(function (b) {
        return b.checked;
      })
    ) {
      const group = boxes[0].closest(".checkbox-grid") || boxes[0];
      group.classList.add("field-error");
      errors.push(group);
    }
  });

  if (errors.length > 0) {
    alert(
      "Заповніть усі обов'язкові поля. Не заповнено: " +
        errors.length +
        ". Незаповнені поля підсвічено червоним.",
    );

    errors[0].scrollIntoView({ behavior: "smooth", block: "center" });

    if (typeof errors[0].focus === "function") {
      errors[0].focus({ preventScroll: true });
    }

    return false;
  }

  return true;
}

function initValidationReset() {
  const form = document.getElementById("briefForm");

  // Червоне підсвічування зникає, щойно поле змінили
  form.addEventListener("input", function (event) {
    event.target.classList.remove("field-error");
  });

  form.addEventListener("change", function (event) {
    event.target.classList.remove("field-error");

    const group = event.target.closest(".radio-group, .checkbox-grid");
    if (group) group.classList.remove("field-error");
  });
}

/* ================================
   AUTOSAVE (збереження чернетки)
   Дані не пропадають при оновленні сторінки
   (зокрема при "pull-to-refresh" на телефоні)
================================ */

const DRAFT_KEY =
  "brief_services_basic_draft_v1:" + location.host + location.pathname;

const DRAFT_TABLES = [
  { id: "stagesTable", addRow: addStageRow, renumber: renumberStages },
  { id: "paymentsTable", addRow: addPaymentRow, renumber: renumberPayments },
];

function collectDraft() {
  const form = document.getElementById("briefForm");
  const state = { fields: {}, radios: {}, checks: {}, tables: {} };

  Array.from(form.elements).forEach(function (el) {
    if (el.closest("table") || el.type === "file" || el.type === "button") {
      return;
    }

    if (el.type === "radio") {
      if (el.checked) state.radios[el.name] = el.value;
    } else if (el.type === "checkbox") {
      if (!state.checks[el.name]) state.checks[el.name] = [];
      if (el.checked) state.checks[el.name].push(el.value);
    } else if (el.id) {
      state.fields[el.id] = el.value;
    }
  });

  DRAFT_TABLES.forEach(function (table) {
    const rows = document.querySelectorAll("#" + table.id + " tbody tr");

    state.tables[table.id] = Array.from(rows).map(function (row) {
      const values = {};

      row.querySelectorAll("input, textarea").forEach(function (el) {
        values[el.name] = el.value;
      });

      return values;
    });
  });

  return state;
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft()));
  } catch (error) {
    console.warn("Cannot save draft:", error);
  }
}

function restoreDraft() {
  let state;

  try {
    state = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch (error) {
    return;
  }

  if (!state) return;

  // Звичайні поля
  Object.keys(state.fields || {}).forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = state.fields[id];
  });

  // Радіокнопки (change запускає показ/приховування залежних полів)
  Object.keys(state.radios || {}).forEach(function (name) {
    document
      .querySelectorAll(`input[type="radio"][name="${name}"]`)
      .forEach(function (radio) {
        if (radio.value === state.radios[name]) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
  });

  // Чекбокси
  Object.keys(state.checks || {}).forEach(function (name) {
    document
      .querySelectorAll(`input[type="checkbox"][name="${name}"]`)
      .forEach(function (box) {
        box.checked = state.checks[name].includes(box.value);
      });
  });

  // Блок деталей IP; його поля повертаємо ще раз,
  // бо handleIpDetailsVisibility міг їх очистити
  handleIpDetailsVisibility();
  ["ipDescription", "usageRestrictions"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el && state.fields && state.fields[id] !== undefined) {
      el.value = state.fields[id];
    }
  });

  // Таблиці
  DRAFT_TABLES.forEach(function (table) {
    const savedRows = (state.tables || {})[table.id];
    if (!savedRows || savedRows.length === 0) return;

    const tbody = document.querySelector("#" + table.id + " tbody");

    while (tbody.rows.length < savedRows.length) {
      table.addRow();
    }

    while (tbody.rows.length > savedRows.length) {
      tbody.deleteRow(tbody.rows.length - 1);
    }

    savedRows.forEach(function (values, index) {
      const row = tbody.rows[index];

      Object.keys(values).forEach(function (name) {
        const el = row.querySelector(`[name="${name}"]`);
        if (el) el.value = values[name];
      });
    });

    table.renumber();
  });

  // Перерахунок після відновлення значень
  recalcCost();
  updateVatHeaders();
}

function initDraftAutosave() {
  const form = document.getElementById("briefForm");
  if (!form) return;

  restoreDraft();

  let timer = null;
  const scheduleSave = function () {
    clearTimeout(timer);
    timer = setTimeout(saveDraft, 300);
  };

  form.addEventListener("input", scheduleSave);
  form.addEventListener("change", scheduleSave);

  // Додавання / видалення рядків таблиць
  form.addEventListener("click", function (event) {
    if (event.target.closest(".remove-row, .secondary-button")) {
      scheduleSave();
    }
  });

  const clearBtn = document.getElementById("clearDraftBtn");

  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (confirm("Очистити всі введені дані?")) {
        localStorage.removeItem(DRAFT_KEY);
        location.reload();
      }
    });
  }
}

/* ================================
   WORD DOCUMENT
================================ */

function buildWordDocumentHtml(data) {
  const isVatPayer = data.contractor.contractorVat === "Так";

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">

    <style>
        body {
            font-family: "Segoe UI", Arial, sans-serif;
            font-size: 11pt;
            color: #222222;
            line-height: 1.35;
        }

        h1 {
            text-align: center;
            font-size: 20pt;
            margin-bottom: 24px;
            color: #263339;
        }

        h2 {
            background: #f3f2f0;
            color: #263339;
            padding: 8px;
            font-size: 14pt;
            margin-top: 24px;
            margin-bottom: 10px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }

        th,
        td {
            border: 1px solid #888888;
            padding: 6px;
            vertical-align: top;
        }

        th {
            background: #465F64;
            color: #ffffff;
            font-weight: bold;
        }

        .label {
            width: 35%;
            font-weight: bold;
            background: #F3F3F3;
        }

        .value {
            width: 65%;
        }

        p {
            margin: 6px 0 12px 0;
        }
    </style>
</head>

<body>

    <h1>Бриф на договір / додаток послуг з підрядником</h1>

    <h2>1. Загальна інформація</h2>

    <table>
        <tr>
            <td class="label">Менеджер</td>
            <td class="value">${escapeHtml(data.general.managerName)}</td>
        </tr>

        <tr>
            <td class="label">Email менеджера</td>
            <td class="value">${escapeHtml(data.general.managerEmail)}</td>
        </tr>

        <tr>
            <td class="label">Клієнт</td>
            <td class="value">${escapeHtml(data.general.clientName)}</td>
        </tr>

        <tr>
            <td class="label">Назва та номер проєкту</td>
            <td class="value">${escapeHtml(data.general.projectName)}</td>
        </tr>

        <tr>
            <td class="label">Який документ потрібно підготувати</td>
            <td class="value">${escapeHtml(data.general.documentType)}</td>
        </tr>
    </table>

    <table>
        <tr>
            <td class="label">Юридична особа зі сторони Adsapience</td>
            <td class="value">${escapeHtml(data.legal.legalEntity)}</td>
        </tr>
    </table>

    <h2>2. Інформація про підрядника</h2>

    <table>
        <tr>
            <td class="label">Повна юридична назва підрядника / ПІБ ФОП</td>
            <td class="value">${escapeHtml(data.contractor.contractorName)}</td>
        </tr>

        <tr>
            <td class="label">Чи є підрядник платником ПДВ</td>
            <td class="value">${escapeHtml(data.contractor.contractorVat)}</td>
        </tr>

        <tr>
            <td class="label">№ перевірки СБ</td>
            <td class="value">${escapeHtml(data.contractor.worksectionLink)}</td>
        </tr>

        <tr>
            <td class="label">Контактний Email підрядника</td>
            <td class="value">${escapeHtml(data.contractor.contractorEmail)}</td>
        </tr>

        <tr>
            <td class="label">Контактний телефон підрядника</td>
            <td class="value">${escapeHtml(data.contractor.contractorPhone)}</td>
        </tr>

        <tr>
            <td class="label">Чи працювали з підрядником раніше</td>
            <td class="value">
                ${
                  data.contractor.workedBefore === "Так"
                    ? "Так: " + escapeHtml(data.contractor.workedBeforeDetails)
                    : escapeHtml(data.contractor.workedBefore)
                }
            </td>
        </tr>

        <tr>
            <td class="label">Чи працює підрядник у Вчасно</td>
            <td class="value">
                ${
                  data.contractor.vchasno === "Так"
                    ? "Так: " + escapeHtml(data.contractor.vchasnoEmail)
                    : escapeHtml(data.contractor.vchasno)
                }
            </td>
        </tr>
    </table>

    <h2>3. Що саме має зробити підрядник</h2>

    <table>
        <tr>
            <td class="label">Коротка назва послуг / робіт</td>
            <td class="value">${escapeHtml(data.services.serviceShortName)}</td>
        </tr>

        <tr>
            <td class="label">Детальний опис послуг / робіт</td>
            <td class="value">${escapeHtml(data.services.serviceDescription)}</td>
        </tr>
    </table>

    <h2>4. Зв’язок із договором/додатком з клієнтом</h2>

    <table>
        <tr>
            <td class="label">Як відображені послуги з клієнтом (вкажіть пункт/и з клієнтом, де вказані послуги, що надаються підрядником)</td>
            <td class="value">${escapeHtml(data.services.serviceExtation)}</td>
        </tr>
    </table>

    <h2>5. Строки виконання</h2>

    <table>
        <tr>
            <td class="label">Дата початку</td>
            <td class="value">${escapeHtml(data.timing.startDate)}</td>
        </tr>

        <tr>
            <td class="label">Дата завершення</td>
            <td class="value">${escapeHtml(data.timing.finishDate)}</td>
        </tr>

        <tr>
            <td class="label">Етапи/Акти</td>
            <td class="value">${escapeHtml(data.timing.timingFormat)}</td>
        </tr>
    </table>

    ${
      data.stages && data.stages.length > 0
        ? `
        <h2>Етапи робіт</h2>
        ${buildStagesWordTable(data.stages, isVatPayer)}
    `
        : ""
    }

    <h2>6. Вартість і порядок оплати</h2>

    <table>
        ${
          isVatPayer
            ? `
        <tr>
            <td class="label">Загальна вартість з ПДВ</td>
            <td class="value">${escapeHtml(data.cost.costWithVat)}</td>
        </tr>

        <tr>
            <td class="label">Загальна вартість без ПДВ</td>
            <td class="value">${escapeHtml(data.cost.costNoVat)}</td>
        </tr>

        <tr>
            <td class="label">ПДВ</td>
            <td class="value">${escapeHtml(data.cost.vatAmount)}</td>
        </tr>
        `
            : `
        <tr>
            <td class="label">Загальна вартість без ПДВ</td>
            <td class="value">${escapeHtml(data.cost.costNoVat)}</td>
        </tr>
        `
        }

        <tr>
            <td class="label">Валюта</td>
            <td class="value">${escapeHtml(data.cost.currency)}</td>
        </tr>
    </table>

    <h2>Порядок оплати</h2>

    ${buildPaymentsWordTable(data.payments, isVatPayer)}

    <h2>7. Інтелектуальна власність</h2>

    <table>
        <tr>
            <td class="label">Підрядник створює</td>
            <td class="value">${escapeHtml(data.intellectualProperty.ipItems.join(", "))}</td>
        </tr>

        ${
          data.intellectualProperty.ipItems.length > 0 &&
          !data.intellectualProperty.ipItems.includes("Ні, нічого з цього")
            ? `
        <tr>
            <td class="label">Якщо так, що саме створюється?</td>
            <td class="value">${escapeHtml(data.intellectualProperty.ipDescription)}</td>
        </tr>

        <tr>
            <td class="label">Чи є обмеження щодо використання результату</td>
            <td class="value">${escapeHtml(data.intellectualProperty.usageRestrictions)}</td>
        </tr>
        `
            : ""
        }
    </table>

    <h2>8. Додаткові та ризикові умови</h2>

    <table>
        <tr>
            <td class="label">Будь-які домовленості з підрядником, які обов’язково потрібно включити в документ</td>
            <td class="value">${escapeHtml(data.risks.riskConditions)}</td>
        </tr>
    </table>

    <h2>9. Файли та посилання</h2>

    <table>
        <tr>
            <td class="label">Чи наявний будь-який документ з підрядником, що описує або деталізує послугу?</td>
            <td class="value">${escapeHtml(data.files.fileLinks.join(", "))}</td>
        </tr>

        <tr>
            <td class="label">Посилання / коментарі</td>
            <td class="value">${escapeHtml(data.files.additionalLinks)}</td>
        </tr>
    </table>

</body>
</html>
    `;
}

function buildStagesWordTable(stages, isVatPayer) {
  if (!stages || stages.length === 0) {
    return "<p>Етапи не заповнені.</p>";
  }

  let rows = "";

  stages.forEach(function (stage) {
    rows += `
            <tr>
                <td>${escapeHtml(stage.stageNo)}</td>
                <td>${escapeHtml(stage.work)}</td>
                <td>${escapeHtml(stage.period)}</td>
                <td>${escapeHtml(stage.amount)}</td>
            </tr>
        `;
  });

  return `
        <table>
            <thead>
                <tr>
                    <th>Етап</th>
                    <th>Що виконується</th>
                    <th>Період</th>
                    <th>${isVatPayer ? "Сума з ПДВ" : "Сума"}</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function buildPaymentsWordTable(payments, isVatPayer) {
  if (!payments || payments.length === 0) {
    return "<p>Графік оплат не заповнений.</p>";
  }

  let rows = "";

  payments.forEach(function (payment) {
    rows += `
            <tr>
                <td>${escapeHtml(payment.paymentNo)}</td>
                <td>${escapeHtml(payment.amount)}</td>
                <td>${escapeHtml(payment.payDate)}</td>
                <td>${escapeHtml(payment.comment)}</td>
            </tr>
        `;
  });

  return `
        <table>
            <thead>
                <tr>
                    <th>№</th>
                    <th>${isVatPayer ? "Сума з ПДВ" : "Сума"}</th>
                    <th>Дата</th>
                    <th>Коментар</th>
                </tr>
            </thead>

            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

function downloadWordDocument(html, data) {
  const projectName = data.general.projectName || "Brief";

  const safeFileName = makeSafeFileName("Brief_" + projectName + ".doc");

  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName;

  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function makeSafeFileName(fileName) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}
