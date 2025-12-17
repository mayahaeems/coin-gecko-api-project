// ===== Global Variables ===== //
//Saves the selected currencies to compare in live reports
let selectedCoins = JSON.parse(localStorage.getItem("selectedCoins")) || [];
//I added an option to select favorites so that the user can easily change selected currencies between favorites for comparison.
let favoritesCoins = JSON.parse(localStorage.getItem("favoritesCoins")) || [];
let coins = []; // displayd coins -100
let allCoinsList = []; // all coin in the api
let coinCache = {}; // { id: { time: timestamp, data: object } }
let cacheOrder = []; // Tracking order of use
const MAX_CACHE_SIZE = 20; // save last 20 coins
const Y_PADDING = 0.02;
const chartState = {
  visibleCoin: [],
  charts: {},
  timer: null,
  series: {},
  basePrice: {},
}; //live chart gogal variables
function saveSelected() {
  localStorage.setItem("selectedCoins", JSON.stringify(selectedCoins));
}
function saveFavorites() {
  localStorage.setItem("favoritesCoins", JSON.stringify(favoritesCoins));
}
//Contains all the main functions of the app
const CryptoApp = {
  async init() {
    await loadAllCoinsList();
    loadTab("currencies");
  },
  getSelectedCoins() {
    return [...selectedCoins];
  },
  addCoin(id) {
    if (selectedCoins.length >= 5) return false;
    if (!selectedCoins.includes(id)) {
      selectedCoins.push(id);
      saveSelected();
    }
    return true;
  },
};
// ===== Page Load ===== //
$(() => {
  CryptoApp.init();
  // Scroll events
  $(window).on("scroll resize", updateBtnTop);
  updateBtnTop();
  // back to top
  $("#btnTop").on("click", () => {
    $("html, body").animate({ scrollTop: $("#navBar").offset().top - 80 }, 800);
  });
  $(".navTab a").on("click", function (e) {
    console.log("CLICKED TAB:", $(this).data("tab"));
  });
  // Tabs
  $(".navTab a").on("click", function (e) {
    e.preventDefault();
    $(".navTab a").removeClass("active");
    $(this).addClass("active");
    const tab = $(this).data("tab");
    loadTab(tab);
  });
  $("#btnInfo").on("click", () => loadTab("info"));
  // Delegated events
  $("#container").on("click", ".btnMoreInfo", function () {
    const coinId = $(this)
      .closest("[id^='coin-']")
      .attr("id")
      .replace("coin-", "");
    showMoreInfo(coinId);
  });

  $("#container").on("change", ".btnSelect", function () {
    const coinId = $(this)
      .closest("[id^='coin-']")
      .attr("id")
      .replace("coin-", "");
    toggleCoin(coinId, this);
  });

  $("#container").on("click", ".btnFan", function () {
    const coinId = $(this).data("id");
    toggleFavorite(coinId, this);
  });

  $("body").on("click", ".chartCoinToggle", function () {
    const id = $(this).data("id");
    const i = chartState.visibleCoin.indexOf(id);
    if (i !== -1) chartState.visibleCoin.splice(i, 1);
    else chartState.visibleCoin.push(id);
    renderChartCoinList();
    startLiveChart();
  });
  window.addEventListener("resize", () => {
    Object.values(chartState.charts).forEach((c) => c.render());
  });
});
// ===== Back to top visibility ===== //
function isNavbarVisible() {
  const rect = $("#navBar")[0].getBoundingClientRect();
  const windowHeight = $(window).height();
  return rect.bottom > 0 && rect.top < windowHeight;
}
function updateBtnTop() {
  if (isNavbarVisible()) $("#btnTop").removeClass("visible");
  else $("#btnTop").addClass("visible");
}
//===== Tabs content and their loaders ===== //
function currenciesLoader() {
  const $TopArea = $('<div id="topArea"></div>');
  $("#container").append($TopArea);
  const $Loader = $(`
    <div class="miniLoader">
    <div class="conCoin"><img width="48" height="48" src="https://img.icons8.com/fluency/48/cheap-2--v1.png" alt="cheap-2--v1"/></div>
    <div class="conPig"><img width="48" height="48" src="https://img.icons8.com/color/48/pig.png" alt="pig"/></div>
    </div>`);
  $TopArea.append($Loader);
  setTimeout(() => $Loader.addClass("active"), 30);
}
function chartLoader() {
  const $TopArea = $('<div id="topArea"></div>');
  $("#container").append($TopArea);
  const $Loader = $(`
    <div class="miniLoader">
    <div class="chartPig1"><img width="48" height="48" src="https://img.icons8.com/color/48/pig.png" alt="pig"/></div>
    <div class="chartPig2"><img width="48" height="48" src="https://img.icons8.com/fluency/48/pig.png" alt="pig"/></div>
    </div>`);
  $TopArea.append($Loader);
  setTimeout(() => $Loader.addClass("active"), 30);
}
function infoLoader() {
  const $TopArea = $('<div id="topArea"></div>');
  $("#container").append($TopArea);
  const $Loader = $(`
     <div class="miniLoader infoKickLoader">
  <div class="pigKick">
    <img src="https://img.icons8.com/color/48/pig.png" width="48" height="48">
  </div>

  <div class="infoIcon">
    <img src="https://img.icons8.com/office/40/info--v1.png" width="40" height="40">
  </div>
</div>
  `);
  $TopArea.append($Loader);
  setTimeout(() => $Loader.addClass("active"), 50);
}
function moreInfoLoader() {
  $(`#coin-${id}`).append(`
    <div class="moreInfoBox loadingBox text-center p-3">
    <img  class="moreInfoPig" width="48" height="48" src="https://img.icons8.com/emoji/48/pig-nose-emoji.png" alt="pig-nose-emoji"/>
    <p class="mt-2">Loading info...</p>
  </div>
    </div>`);
}
async function loadTab(tabName) {
  $("#container").empty();
  if (tabName === "currencies") {
    currenciesLoader();
    setTimeout(() => {
      funCurrencies();
    }, 1500);
  } else if (tabName === "info") {
    infoLoader();
    setTimeout(() => {
      funInfo();
    }, 1500);
  } else if (tabName === "chart") {
    chartLoader();
    setTimeout(() => {
      funChart();
    }, 1500);
  }
}
// ===== Currencies ===== //
function funCurrencies() {
  $.ajax({
    url: "https://api.coingecko.com/api/v3/coins/markets",
    data: {
      vs_currency: "usd",
      order: "market_cap_desc",
      per_page: 100,
      page: 1,
      sparkline: false,
    },
    success: (data) => {
      if (!data || data.length === 0) {
        showError("No coins found. Please try again later.");
        return;
      }
      coins = data;
      renderCoins(coins);
    },
    error: (xhr, status, error) => {
      console.error("API Error:", error);
      if (xhr.status === 429) {
        showError("❌ Too many requests. Please wait a minute and try again.");
      } else if (xhr.status === 0) {
        showError("❌ Internet connection problem. Check your connection.");
      } else {
        showError(`❌ Error loading coins: ${error}`);
      }
    },
    timeout: 10000,
  });
}
function renderCoins(coins) {
  $("#topArea").empty();
  $("#topArea").append(`
    <div class="input-group searchBar">
    <span class="input-group-text">
      <i class="bi bi-search"></i>
    </span>
    <input type="text" id="searchInput" class="form-control" placeholder="Search a currency...">
    <button id="btnClearSearch" class="btn btn-outline-secondary" type="button">
    <i class="bi bi-x-lg"></i></button>
    <div class="dropdown">
      <button
        class="btn btn-outline-secondary dropdown-toggle dropdown-toggle-split"
        data-bs-toggle="dropdown">
      </button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><a class="dropdown-item filterBtn" data-filter="default">Default Display</a></li>
        <li><a class="dropdown-item filterBtn" data-filter="selected">Tracking</a></li>
        <li><a class="dropdown-item filterBtn" data-filter="favorites">Favorites</a></li>
        <li><a class="dropdown-item filterBtn" data-filter="top10">Top 10</a></li>
        <li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item text-danger" id="clearFilters">Clears selections</a></li>
      </ul>
    </div>
  </div>
      `);
  if (!$("#coinsRow").length) {
    $("#container").append(`<div class="row" id="coinsRow"></div>`);
  } else {
    $("#coinsRow").empty();
  }
  displayCoins(coins);

  $("#searchInput").on("keypress", function (e) {
    if (e.key === "Enter") {
      const q = $(this).val().trim().toLowerCase();
      if (!q) {
        displayCoins(coins);
      } else {
        globalSearch(q);
      }
    }
  });
  $("#btnClearSearch").on("click", function () {
    $("#searchInput").val("");
    displayCoins(coins);
  });
  $(".filterBtn").on("click", function (e) {
    e.preventDefault();
    $(".filterBtn").removeClass("active");
    $(this).addClass("active");
    const filter = $(this).data("filter");
    applyFilter(filter);
  });
  $("#clearFilters").on("click", function (e) {
    e.preventDefault();
    selectedCoins = [];
    saveSelected();
    favoritesCoins = [];
    saveFavorites();
    $("#searchInput").val("");
    $(".filterBtn").removeClass("active");
    $(`.filterBtn[data-filter="default"]`).addClass("active");
    displayCoins(coins);
  });
}
function displayCoins(coins) {
  if (!$("#coinsRow").length) {
    $("#container").append('<div class="row" id="coinsRow"></div>');
  } else {
    $("#coinsRow").empty();
  }
  coins.forEach((coin) => {
    const { id, symbol, name, image, current_price } = coin;
    $("#coinsRow").append(`
      <div class="cardAll" id="coin-${id}">
      <div class="cardStart hstack gap-3">
        <button class="btnFan p-2" data-id="${id}">
          <i class="fa-star ${favoritesCoins.includes(id) ? "fas" : "far"}"></i>
        </button>
        <input type="checkbox" name="btnSelect" class="p-2 ms-auto btnSelect" ${
          selectedCoins.includes(id) ? "checked" : ""
        }>
      </div>
      <div class="cardMain">
        <div class="cardHeader">
          <img src="${image}" class="cardImg" alt="${name}">
          <h5 class="coinTitle" data-id="${id}">${name}</h5> 
        </div>
        <div class="cardText">
          <p class="cardSymbol">Symbol: ${symbol.toUpperCase()}</p>
          <p class="cardPirce">Current Price: $${current_price}</p>
        </div>
      </div>
      <div class="cardBtn">
        <button class="btnMoreInfo">More Info</button>
      </div>
      </div>`);
  });
}
function toggleFavorite(id, element) {
  const index = favoritesCoins.indexOf(id);
  //If found in the array, removes it.
  if (index !== -1) {
    favoritesCoins.splice(index, 1);
  } else {
    favoritesCoins.push(id);
  }
  saveFavorites();
  //Changes the star from empty to full and vice versa
  $(element).find("i").toggleClass("fas far");
}
function toggleCoin(id, element) {
  const index = selectedCoins.indexOf(id);
  if (index !== -1) {
    selectedCoins.splice(index, 1);
    saveSelected();
    $(element).prop("checked", false);
    return;
  }
  const success = CryptoApp.addCoin(id);
  if (!success) {
    showLimitModal(id);
    $(element).prop("checked", false);
    return;
  }
  $(element).prop("checked", true);
}
function showLimitModal(id) {
  $("#limitModal").remove();
  $("body").append(`
    <div class="modal fade" id="limitModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-warning text-dark">
            <h5 class="modal-title">
              <i class="bi bi-exclamation-triangle me-2"></i>
              You have reached the maximum number of coins
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body">
            <p>Only <strong>5 currencies</strong> can be tracked.</p>
            <p>Select one currency to replace:</p>
            <select id="replaceSelect" class="form-select mb-3"></select>

            <div class="alert alert-info mb-0">
              <img width="40" height="40" src="https://img.icons8.com/color/48/idea.png"/>
              <strong>Tip:</strong>
              You can save coins to favorites ⭐ without tracking them.
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-primary" id="confirmReplaceBtn">
              Replace
            </button>
          </div>
        </div>
      </div>
    </div>
  `);

  fillReplaceList();
  $("#confirmReplaceBtn").on("click", function () {
    const toRemove = $("#replaceSelect").val();
    const oldElement = $(`#coin-${toRemove} .btnSelect`);
    toggleCoin(toRemove, oldElement);
    const newElement = $(`#coin-${id} .btnSelect`);
    toggleCoin(id, newElement);
    $("#limitModal").modal("hide");
  });

  $("#limitModal").modal("show");
}
function fillReplaceList() {
  const select = $("#replaceSelect");
  select.empty();
  selectedCoins.forEach((id) => {
    const coin = coins.find((c) => c.id === id);
    select.append(`
      <option value="${id}">
        ${coin?.name || id}
      </option>
    `);
  });
}
//Search - Searches all existing coins
async function loadAllCoinsList() {
  const CACHE_KEY = "allCoinsList";
  const CACHE_TIME_KEY = "allCoinsListTime";
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 שעות
  const cachedData = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
  if (cachedData && cachedTime && Date.now() - cachedTime < MAX_AGE) {
    allCoinsList = JSON.parse(cachedData);
    return allCoinsList;
  }
  const data = await $.ajax({
    url: "https://api.coingecko.com/api/v3/coins/list",
    method: "GET",
  });
  allCoinsList = data;
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(CACHE_TIME_KEY, Date.now());

  return data;
}
async function globalSearch(query) {
  // await loadAllCoinsList();
  const matched = allCoinsList.filter(
    (c) =>
      c.name.toLowerCase().includes(query) ||
      c.symbol.toLowerCase().includes(query)
  );
  if (matched.length === 0 || !matched.length) {
    $("#coinsRow").html('<div class="col-12"><p>No results found</p></div>');
    return;
  }
  const top100 = matched.slice(0, 100).map((c) => c.id);
  $.ajax({
    url: "https://api.coingecko.com/api/v3/coins/markets",
    data: {
      vs_currency: "usd",
      ids: top100.join(","),
      per_page: 100,
    },
    success: (data) => {
      displayCoins(data);
    },
    error: () => {
      showError("Error searching coins");
    },
  });
}
async function applyFilter(filter) {
  let baseList = allCoinsList;
  let idsToFetch = [];
  switch (filter) {
    case "selected":
      idsToFetch = baseList
        .filter((c) => selectedCoins.includes(c.id))
        .slice(0, 100)
        .map((c) => c.id);
      break;

    case "favorites":
      idsToFetch = baseList
        .filter((c) => favoritesCoins.includes(c.id))
        .slice(0, 100)
        .map((c) => c.id);
      break;

    case "top10":
      idsToFetch = coins.slice(0, 10).map((c) => c.id);
      break;

    case "default":
    default:
      displayCoins(coins);
      return;
  }
  if (!idsToFetch.length) {
    $("#coinsRow").html('<div class="col-12"><p>No results found</p></div>');
    return;
  }
  await fetchAndDisplayByIds(idsToFetch);
}
async function fetchAndDisplayByIds(ids) {
  try {
    const data = await $.ajax({
      url: "https://api.coingecko.com/api/v3/coins/markets",
      data: {
        vs_currency: "usd",
        ids: ids.join(","),
        per_page: 100,
      },
    });

    displayCoins(data);
  } catch (err) {
    showError("Error loading filtered coins");
  }
}
//-> more info
//Use chase to save the information used by showMoreInfo
function addToCache(id, data) {
  if (coinCache[id]) {
    cacheOrder = cacheOrder.filter((cid) => cid !== id);
  }
  if (cacheOrder.length > MAX_CACHE_SIZE) {
    const oldestId = cacheOrder.shift();
    delete coinCache[oldestId];
  }
  coinCache[id] = { time: Date.now(), data };
  cacheOrder.push(id);
}
function showMoreInfo(id) {
  const $card = $(`#coin-${id}`);
  if ($card.data("open")) {
    $card.find(".moreInfoBox").remove();
    $card.find(".loadingBox").remove();
    $card.data("open", false);
    $card.removeClass("open");
    return;
  }
  $card.addClass("open");
  $card.data("open", true);

  //if the time in the chase is less then 2 minutes use it
  if (coinCache[id] && Date.now() - coinCache[id].time < 120000) {
    renderMoreInfo(id, coinCache[id].data);
    return;
  }
  // loader
  $card.append(`
    <div class="moreInfoBox loadingBox text-center p-3">
      <img class="moreInfoPig" width="48" height="48" 
           src="https://img.icons8.com/emoji/48/pig-nose-emoji.png"/>
      <p class="mt-2">Loading info...</p>
    </div>
  `);
  fetchCoinData(id, $card);
}
function fetchCoinData(id, $card) {
  $.ajax({
    url: `https://api.coingecko.com/api/v3/coins/${id}`,
    data: {
      localization: "false",
      tickers: "false",
      market_data: "true",
      community_data: "false",
      developer_data: "false",
      sparkline: "true",
    },
    success: (data) => {
      addToCache(id, data);
      renderMoreInfo(id, data);
    },
    error: (xhr) => {
      let secondsLeft = 60;
      $card.find(".loadingBox").html(`
      <div class="alert alert-danger mb-0">
          <i class="bi bi-exclamation-triangle me-2"></i>
          ${
            xhr.status === 429
              ? "Too many requests! Retrying in 1 minute..."
              : "Error loading info. Retrying in 1 minute..."
          }
        </div>
        <div class="text-center mt-2">
          <div class="spinner-border spinner-border-sm text-danger" role="status">
            <span class="visually-hidden">Waiting...</span>
          </div>
          <small class="d-block mt-2 text-muted" id="countdown-${id}">${secondsLeft}s</small>
        </div>`);

      const countdownInterval = setInterval(() => {
        secondsLeft--;
        $(`#countdown-${id}`).text(`${secondsLeft}s`);
        if (secondsLeft <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
      //try agein after 1 minute
      setTimeout(() => {
        clearInterval(countdownInterval);
        $card.find(".loadingBox").html(`
            <img class="moreInfoPig" width="48" height="48" 
               src="https://img.icons8.com/emoji/48/pig-nose-emoji.png" 
               alt="pig-nose-emoji"/>
          <p class="mt-2">Retrying...</p>`);
        fetchCoinData(id, $card);
      }, 60000);
    },
  });
}
function renderMoreInfo(id, data) {
  const $card = $(`#coin-${id}`);
  $card.find(".moreInfoBox").remove();
  $card.find(".loadingBox").remove();
  const {
    market_cap_rank,
    description,
    market_data: {
      current_price,
      sparkline_7d,
      price_change_percentage_24h,
      market_cap,
      high_24h,
      low_24h,
      ath,
      ath_date,
    },
  } = data;
  const { usd, eur, ils } = current_price;
  const changeColor = price_change_percentage_24h >= 0 ? "green" : "red";
  const athDateFormatted = ath_date.usd
    ? new Date(ath_date.usd).toLocaleDateString()
    : "N/A";
  $(`#coin-${id}`).append(`
      <div class="moreInfoBox border-top pt-3">
        <div class="rankDescription">
          <div class="rank"><b>Rank: </b>${market_cap_rank}</div>
          <button class="description">
          <img width="48" height="48" src="https://img.icons8.com/sci-fi/48/notepad.png" alt="notepad"/>
          </button> 
        </div>
        <div class="prices">
          <p><b>Price in dollar: </b>$${usd}</p>
          <p><b>Price in euro: </b>€${eur}</p>
          <p><b>Price in ILS: </b>₪${ils}</p>
        </div>
        <hr>
        <p><b>24h Change:</b> <span style="color:${changeColor}">
        ${price_change_percentage_24h.toFixed(2)}%</span></p>
        <p><b>Market Cap:</b> $${
          market_cap.usd?.toLocaleString() || market_cap.toLocaleString()
        }</p>
        <p><b>24h High:</b> $${high_24h.usd || high_24h}</p>
        <p><b>24h Low:</b> $${low_24h.usd || low_24h}</p>
        <hr>
        <div>
          <p><b>All-Time-High:</b> $${ath.usd}</p>
          <p><b>ATH Date:</b> ${athDateFormatted}</p>
        </div>
        <div id="chart-${id}" style="height:130px; width:100%;"></div>
        <hr>
        <button class="btnCloseInfo">Close </button>
        </div>
      </div>
    `);
  $(`#coin-${id} .btnCloseInfo`).on("click", () => {
    $(`#coin-${id} .moreInfoBox`).slideUp(300, function () {
      $(this).remove();
    });
    $(`#coin-${id}`).data("open", false);
    $(`#coin-${id}`).removeClass("open");
  });
  $(`#coin-${id} .description`).on("click", () => {
    descriptionModal(data.description.en, data.name);
  });
  // CanvasJS mini-chart
  if (!sparkline_7d || !sparkline_7d.price) {
    $(`#chart-${id}`).html("<small>No chart data available</small>");
    return;
  }
  const prices = sparkline_7d.price.map((p, i) => ({ x: i, y: p }));
  $(`#chart-${id}`).CanvasJSChart({
    animationEnabled: true,
    backgroundColor: "transparent",
    axisX: {
      labelFormatter: () => "",
      tickLength: 0,
      gridThickness: 0,
    },
    axisY: {
      labelFormatter: () => "",
      tickLength: 0,
      gridThickness: 0,
    },
    data: [
      {
        type: "line",
        dataPoints: prices,
        markerSize: 0,
        lineThickness: 2,
        color:
          prices[0].y <= prices[prices.length - 1].y ? "#00c853" : "#d50000",
      },
    ],
  });
}
function descriptionModal(text, coinName) {
  if ($("#descriptionModal").length) {
    $("#descriptionModal").remove();
  }
  $("body").append(`
    <div class="modal fade" id="descriptionModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-warning text-dark">
            <h5 class="modal-title">
              <i class="bi bi-journal-text me-2"></i>
              ${coinName} Description
            </h5>
          </div>
          <div class="modal-body">
            ${
              text
                ? `<p class="lh-lg">${text}</p>`
                : `<p class="text-muted">No description available.</p>`
            }
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  `);
  $("#descriptionModal").modal("show");
}
// ===== Live Chart ===== //
function funChart() {
  $("#container").empty();
  $("#container").append('<div id="topArea"></div>');
  chartState.visibleCoin = [...selectedCoins];
  chartState.series = {};
  chartState.basePrice = {};
  chartState.charts = {}; //Data reset every time you log in to reports
  $("#topArea").append(`
    <div class="chartHeader">
    <h2>Live Crypto Chart</h2>
    <div id="chartCoinList" class="coinToggleBar"></div>
    </div>
    `);
  $("#container").append('<div id="chartsWrap" class="d-grid gap-3"></div>');
  renderChartCoinList();
  startLiveChart();
}
function renderChartCoinList() {
  $("#chartCoinList").empty();
  if (!selectedCoins.length) {
    $("#chartCoinList").append(
      '<div class="alert alert-info mb-0">No tracked coins selected.</div>'
    );
    setTimeout(() => loadTab("currencies"), 60000);
    return;
  }
  const iconShow = `<img width="18" height="18" src="https://img.icons8.com/pulsar-line/48/plus-math.png" alt="show"/>`;
  const iconHide = `<img width="18" height="18" src="https://img.icons8.com/pulsar-line/48/minus-math.png" alt="hide"/>`;
  selectedCoins.forEach((id) => {
    const sym = getSymbolByID(id) || id;
    const isVisible = chartState.visibleCoin.includes(id);
    $("#chartCoinList").append(`
      <button class="btn btn-sm ${
        isVisible ? "btn-success" : "btn-outline-secondary"
      } chartCoinToggle" data-id="${id}">
        <span class="ms-1">${
          isVisible ? iconHide : iconShow
        }</span><span class="me-1"> ${sym}</span>
      </button>`);
  });
}
function stopLiveChart() {
  if (chartState.timer) clearInterval(chartState.timer);
  chartState.timer = null;
  chartState.charts = {};
}
function startLiveChart() {
  stopLiveChart();
  const ids = chartState.visibleCoin;
  if (!ids || ids.length === 0) {
    $("#chartsWrap").html(`
      <div class="alert alert-warning text-center">
        No coins visible on chart. Use the buttons above to show coins.
      </div>
    `);
    return;
  }
  ids.forEach((id) => {
    if (!chartState.series[id]) chartState.series[id] = [];
  });
  const CHART_COLORS = ["#e74c3c", "#2ecc71", "#3498db", "#9b59b6", "#f39c12"];
  $("#chartsWrap").empty();
  ids.forEach((id) => {
    const color = CHART_COLORS[ids.indexOf(id) % CHART_COLORS.length];
    const sym = getSymbolByID(id) || id;
    $("#chartsWrap").append(`
      <div class="p-2 border rounded">
        <div class="fw-semibold mb-2">${sym} to USD</div>
        <div id="chartContainer-${id}" style="height:260px; width:100%;"></div>
      </div>
      `);
      chartState.charts[id] = new CanvasJS.Chart(`chartContainer-${id}`, {
      animationEnabled: true,
      backgroundColor: "white",
      toolTip: {
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        cornerRadius: 6,
        contentFormatter: function (e) {
          const y = e.entries[0].dataPoint.y;
          const decimals = y < 1 ? 8 : y < 100 ? 4 : 2;
          return `${sym}: $${y.toLocaleString("en-US", {
            maximumFractionDigits: decimals,
          })}`;
        },
      },
      axisX: {
        valueFormatString: "HH:mm",
        interval: 1,
        intervalType: "minute",
      },
      axisY: {
        title: "Coin Value",
        prefix: "$",
        includeZero: false,
        labelFormatter: function (e) {
          const v = e.value;
          const decimals = v < 1 ? 8 : v < 100 ? 4 : 2;
          return v.toLocaleString("en-US", { maximumFractionDigits: decimals });
        },
      },
      data: [
        {
          type: "line",
          markerType: "circle",
          markerSize: 0,
          lineThickness: 2,
          color: color,
          markerColor: color,
          dataPoints: chartState.series[id],
        },
      ],
    });
    chartState.charts[id].render();
  });
  fetchPrices(ids);
  chartState.timer = setInterval(() => fetchPrices(ids), 2000);
}
function niceStep(raw) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
async function fetchPrices(ids) {
  try {
    const fsyms = ids
      .map((id) => getSymbolByID(id))
      .filter(Boolean)
      .join(",");
    if (!fsyms) return;
    const data = await $.ajax({
      url: "https://min-api.cryptocompare.com/data/pricemulti",
      data: { fsyms, tsyms: "USD" },
      timeout: 10000,
    });
    const now = new Date();
    ids.forEach((id) => {
      const sym = getSymbolByID(id);
      const price = data?.[sym]?.USD;
      if (typeof price !== "number") return;
      const s = chartState.series[id] || (chartState.series[id] = []);
      const last = s[s.length - 1];
      const changed = !last || last.y !== price;
      // First point + any price change: with a circle
      //No change: no circle, but still add a dot so that the line continues in time
      if (chartState.basePrice[id] == null) {
        chartState.basePrice[id] = price;
      }
      s.push({
        x: now,
        y: price,
        markerSize: changed ? 6 : 0,
      });
      const MAX_POINTS = 60 * 10;
      if (s.length > MAX_POINTS) s.shift();
    });

    ids.forEach((id) => {
      chartState.charts?.[id]?.render();
    });
  } catch (err) {
    console.error("fetchPrices error:", err);
  }
}
function getSymbolByID(id) {
  const symbolCoin = allCoinsList.find((coin) => coin.id === id);
  return symbolCoin ? symbolCoin.symbol.toUpperCase() : null;
}
// ===== Info ===== //
// ===== Info ===== //
function funInfo() {
  $("#topArea").remove();
  $("#container").empty();
    $("#container").append(`
    <div class="info-page">
      <div class="info-header text-center mb-5">
        <img src="https://img.icons8.com/fluency/96/cheap-2--v1.png" alt="crypto" class="info-icon mb-3">
        <h1 class="display-4 fw-bold">About This Project</h1>
        <p class="lead text-muted">Crypto Tracker - Real-time Cryptocurrency Information</p>
      </div>
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4">
              <div class="row align-items-center">
                <div class="col-md-4 text-center mb-3 mb-md-0">
                  <div class="developer-icon-wrapper mb-3">
                    <img width="48" height="48" src="https://img.icons8.com/pulsar-color/48/person-male.png" alt="person-male"/>
                  </div>
                  <h4 class="mb-1">Maya Haeems</h4>
                  <p class="text-muted mb-1">Full Stack Developer</p>
                  <p class="text-muted small">
                    <i class="bi bi-mortarboard-fill me-1"></i>
                    B.Sc. Information Systems
                  </p>
                </div>
                <div class="col-md-8">
                  <h5 class="mb-3"><i class="bi bi-person-badge me-2"></i>About Me</h5>
                  <p class="mb-3">
                    Full Stack Developer with a Bachelor's degree in Information Systems. 
                    Passionate about creating modern web applications and solving complex problems 
                    through elegant code solutions.
                  </p>
                  <p class="mb-2">
                    <i class="bi bi-envelope-fill text-primary me-2"></i>
                    <strong>Email:</strong> mayahaee@gmail.com
                  </p>
                  <p class="mb-2">
                    <i class="bi bi-github text-dark me-2"></i>
                    <strong>GitHub:</strong> 
                    <a href="https://github.com/mayahaeems" target="_blank">@mayahaeems</a>
                  </p>
                  <p class="mb-2">
                    <i class="bi bi-linkedin text-primary me-2"></i>
                    <strong>LinkedIn:</strong> 
                    <a href="https://linkedin.com/in/maya-haeems-a615b3302/" target="_blank">Maya Haeems</a>
                  </p>
                  <p class="mb-0">
                    <i class="bi bi-geo-alt-fill text-danger me-2"></i>
                    <strong>Location:</strong> Rehovot, Israel
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4">
              <h5 class="mb-4"><i class="bi bi-mortarboard me-2"></i>Education & Training</h5>
              <div class="timeline">
                <div class="timeline-item mb-3">
                  <div class="d-flex align-items-start">
                    <div class="timeline-icon bg-primary text-white rounded-circle p-2 me-3">
                      <i class="bi bi-code-slash"></i>
                    </div>
                    <div>
                      <h6 class="mb-1">Full Stack Web Developer Course</h6>
                      <p class="text-muted small mb-1">John Bryce Academy</p>
                      <p class="small mb-0">Specializing in modern web technologies, API integration, and responsive design</p>
                    </div>
                  </div>
                </div>
                <div class="timeline-item">
                  <div class="d-flex align-items-start">
                    <div class="timeline-icon bg-success text-white rounded-circle p-2 me-3">
                      <i class="bi bi-book"></i>
                    </div>
                    <div>
                      <h6 class="mb-1">B.Sc. Information Systems</h6>
                      <p class="text-muted small mb-1">Peres Academic Center</p>
                      <p class="small mb-0">Comprehensive studies in software development, database management, and systems analysis. Specializing in information security</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Project Description -->
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4">
              <h5 class="mb-3"><i class="bi bi-file-text me-2"></i>Project Description</h5>
              <p class="mb-3">
                This Crypto Tracker application provides real-time information about cryptocurrencies. 
                Built as a Single Page Application (SPA) using jQuery and AJAX, it demonstrates 
                modern web development techniques and API integration.
              </p>
              <p class="mb-0">
                The project showcases practical application of academic knowledge in Information Systems, 
                combined with hands-on full-stack development skills acquired at John Bryce Academy.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4">
              <h5 class="mb-4"><i class="bi bi-stars me-2"></i>Key Features</h5>
              <div class="row g-3">
                <div class="col-md-6">
                  <div class="feature-item p-3 bg-light rounded">
                    <i class="bi bi-currency-exchange text-primary fs-4 mb-2"></i>
                    <h6 class="fw-bold">100+ Cryptocurrencies</h6>
                    <p class="small text-muted mb-0">Browse and search through extensive crypto database</p>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="feature-item p-3 bg-light rounded">
                    <i class="bi bi-graph-up text-success fs-4 mb-2"></i>
                    <h6 class="fw-bold">Live Charts</h6>
                    <p class="small text-muted mb-0">Real-time price tracking and visualization</p>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="feature-item p-3 bg-light rounded">
                    <i class="bi bi-star-fill text-warning fs-4 mb-2"></i>
                    <h6 class="fw-bold">Favorites System</h6>
                    <p class="small text-muted mb-0">Save your favorite coins for quick access</p>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="feature-item p-3 bg-light rounded">
                    <i class="bi bi-search text-info fs-4 mb-2"></i>
                    <h6 class="fw-bold">Advanced Search</h6>
                    <p class="small text-muted mb-0">Filter and find coins instantly</p>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="feature-item p-3 bg-light rounded">
                    <i class="bi bi-phone text-danger fs-4 mb-2"></i>
                    <h6 class="fw-bold">Responsive Design</h6>
                    <p class="small text-muted mb-0">Works perfectly on all devices</p>
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="feature-item p-3 bg-light rounded">
                    <i class="bi bi-lightning-charge text-warning fs-4 mb-2"></i>
                    <h6 class="fw-bold">Smart Caching</h6>
                    <p class="small text-muted mb-0">Efficient data management for better performance</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Technologies Section -->
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4">
              <h5 class="mb-4"><i class="bi bi-code-slash me-2"></i>Technologies Used</h5>
              <div class="row g-3">
                <div class="col-6 col-md-4 text-center">
                  <div class="tech-badge p-3 rounded">
                    <img width="48" height="48" src="https://img.icons8.com/color/48/html-5--v1.png" alt="html-5--v1"/>
                    <p class="small fw-bold mb-0">HTML5</p>
                  </div>
                </div>
                <div class="col-6 col-md-4 text-center">
                  <div class="tech-badge p-3 rounded">
                    <img width="48" height="48" src="https://img.icons8.com/color/48/css3.png" alt="css3"/>
                    <p class="small fw-bold mb-0">CSS3</p>
                  </div>
                </div>
                <div class="col-6 col-md-4 text-center">
                  <div class="tech-badge p-3 rounded">
                    <img width="48" height="48" src="https://img.icons8.com/color/48/javascript--v1.png" alt="javascript--v1"/>
                    <p class="small fw-bold mb-0">JavaScript</p>
                  </div>
                </div>
                <div class="col-6 col-md-4 text-center">
                  <div class="tech-badge p-3 rounded">
                    <img width="48" height="48" src="https://img.icons8.com/color/48/remove-property.png" alt="remove-property"/>
                    <p class="small fw-bold mb-0">jQuery</p>
                  </div>
                </div>
                <div class="col-6 col-md-4 text-center">
                  <div class="tech-badge p-3 rounded">
                    <img width="48" height="48" src="https://img.icons8.com/fluency/48/bootstrap.png" alt="bootstrap"/>
                    <p class="small fw-bold mb-0">Bootstrap 5</p>
                  </div>
                </div>
                <div class="col-6 col-md-4 text-center">
                  <div class="tech-badge p-3 rounded">
                    <img width="48" height="48" src="https://img.icons8.com/fluency/48/api.png" alt="api"/>
                    <p class="small fw-bold mb-0">REST APIs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- APIs Section -->
      <div class="row justify-content-center mb-4">
        <div class="col-lg-8">
          <div class="card shadow-sm border-0">
            <div class="card-body p-4">
              <h5 class="mb-3"><i class="bi bi-cloud-arrow-down me-2"></i>APIs Used</h5>
              <ul class="list-unstyled mb-0">
                <li class="mb-3">
                  <strong><i class="bi bi-link-45deg text-primary"></i> CoinGecko API</strong>
                  <p class="small text-muted mb-0">Cryptocurrency data, prices, and market information</p>
                  <a href="https://www.coingecko.com/api/docs/v3" target="_blank" class="small">Documentation</a>
                </li>
                <li class="mb-0">
                  <strong><i class="bi bi-link-45deg text-success"></i> CryptoCompare API</strong>
                  <p class="small text-muted mb-0">Real-time price data for live charts</p>
                  <a href="https://www.cryptocompare.com/api/" target="_blank" class="small">Documentation</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Note -->
      <div class="row justify-content-center">
        <div class="col-lg-8 text-center">
          <div class="alert alert-info d-inline-block">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Note:</strong> This project combines academic knowledge in Information Systems with practical full-stack development skills.
          </div>
        </div>
      </div>
    </div>
  `);
}
function showError(msg) {
  $("#container").html(
    `<p class="error alert alert-danger text-center fs-3">${msg}</p>`
  );
  setTimeout(() => {
    loadTab("currencies");
  }, 60000);
}
