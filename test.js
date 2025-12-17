// ===== Global variables =====
const MAX_CACHE_SIZE = 20; // save last 20 coins
let coinCache = {}; // { id: { time: timestamp, data: object } }
let selectedCoins = JSON.parse(localStorage.getItem("selectedCoins")) || [];
let favoritesCoins = JSON.parse(localStorage.getItem("favoritesCoins")) || [];
let allCoins = [];
let cacheOrder = []; // Tracking order of use

function saveSelected() {
  localStorage.setItem("selectedCoins", JSON.stringify(selectedCoins));
}
function saveFavorites() {
  localStorage.setItem("favoritesCoins", JSON.stringify(favoritesCoins));
}

const CryptoApp = {
  init() {
    loadTab("currencies");
    updateSelectedCoinsDisplay();
  },
  getSelectedCoins() {
    return [...selectedCoins];
  },
  addCoin(id) {
    if (selectedCoins.length >= 5) return false;
    if (!selectedCoins.includes(id)) {
      selectedCoins.push(id);
      saveSelected();
      updateSelectedCoinsDisplay();
    }
    return true;
  },
};

//===== Page Load =====//
$(() => {
  CryptoApp.init();

  // Scroll events
  $(window).on("scroll resize", updateBtnTop);
  updateBtnTop();

  // back to top
  $("#btnTop").on("click", () => {
    $("html, body").animate(
      { scrollTop: $("#navBar").offset().top - 80 },
      800
    );
  });

  // Tabs
  $(".navTab a").on("click", function (e) {
    e.preventDefault();
    $(".navTab a").removeClass("active");
    $(this).addClass("active");
    const tab = $(this).data("tab");
    loadTab(tab);
  });

  // Delegated events (לא צריך לחבר מחדש בכל רינדור)
  $("#container").on("click", ".btnMoreInfo", function () {
    const coinId = $(this).closest("[id^='coin-']").attr("id").replace("coin-", "");
    showMoreInfo(coinId);
  });

  $("#container").on("change", ".toggleCoin", function () {
    const coinId = $(this).closest("[id^='coin-']").attr("id").replace("coin-", "");
    toggleCoin(coinId, this);
  });

  $("#container").on("click", ".favBtn", function () {
    const coinId = $(this).data("id");
    toggleFavorite(coinId, this);
  });
});

// ===== Back to top visibility =====
function isNavbarVisible() {
  const rect = $("#navBar")[0].getBoundingClientRect();
  const windowHeight = $(window).height();
  return rect.bottom > 0 && rect.top < windowHeight;
}
function updateBtnTop() {
  if (isNavbarVisible()) $("#btnTop").removeClass("visible");
  else $("#btnTop").addClass("visible");
}

// ===== Loader on topArea =====
function Loader() {
  const $TopArea = $('<div id="topArea"></div>');
  $("#container").append($TopArea);
  const $Loader = $(`
    <div class="miniLoader">
      <div class="loader-coin"><i class="bi bi-coin"></i></div>
      <div class="loader-pig"><i class="bi bi-piggy-bank"></i></div>
    </div>
  `);
  $TopArea.append($Loader);
  setTimeout(() => $Loader.addClass("active"), 30);
}

// ===== Tabs content loader =====
async function loadTab(tabName) {
  $("#container").empty();
  Loader();

  setTimeout(() => {
    if (tabName === "currencies") {
      funCurrencies();
    } else if (tabName === "info") {
      $("#container").append("<h2 class='text-center mt-5'>Info Page</h2>");
    } else if (tabName === "chart") {
      $("#container").append("<h2 class='text-center mt-5'>Live Chart</h2>");
    }
  }, 1500);
}

function showError(msg) {
  $("#container").html(
    `<p class="error alert alert-danger text-center fs-3">${msg}</p>`
  );
}

// ===== Currencies: fetch =====
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
      allCoins = data;
      renderCoins(allCoins);
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

// ===== Render coins + toolbar =====
function renderCoins(allCoins) {
  $("#topArea").empty();
  // search + filters UI
  $("#topArea").append(`
    <div class="input-group mb-4">
      <span class="input-group-text">
        <i class="bi bi-search"></i>
      </span>
      <input type="text" 
             class="form-control form-control-lg" 
             id="searchInput" 
             placeholder="Search for a currency by name or symbol...">
      <button class="btn btn-outline-secondary" id="btnClearSearch">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
    <div class="btn-group mb-3 d-flex" role="group">
      <button class="btn btn-outline-primary filterBtn active" data-filter="all">
        All (${allCoins.length})
      </button>
      <button class="btn btn-outline-success filterBtn" data-filter="selected">
       Tracking (${selectedCoins.length})
      </button>
      <button class="btn btn-outline-warning filterBtn" data-filter="favorites">
       Favorites (${favoritesCoins.length})
      </button>
      <button class="btn btn-outline-info filterBtn" data-filter="top10">
        Top 10
      </button>
    </div>
  `);

  if (!$("#coinsRow").length) {
    $("#container").append(`<div class="row" id="coinsRow"></div>`);
  } else {
    $("#coinsRow").empty();
  }

  displayCoins(allCoins);

  // events for search + filters
  $("#searchInput").on("input", function () {
    const query = $(this).val().toLowerCase();
    filterCoins(query);
  });

  $("#btnClearSearch").on("click", function () {
    $("#searchInput").val("");
    filterCoins("");
  });

  $(".filterBtn").on("click", function () {
    $(".filterBtn").removeClass("active");
    $(this).addClass("active");
    const filter = $(this).data("filter");
    applyFilter(filter);
  });

  updateSelectedCoinsDisplay();
}

// ===== Search filter (client-side) =====
function filterCoins(query) {
  $(".card").each(function () {
    const coinId = $(this).attr("id"); // coin-xxxx
    const coin = allCoins.find((c) => `coin-${c.id}` === coinId);
    if (!coin) return;

    const matches =
      coin.name.toLowerCase().includes(query) ||
      coin.symbol.toLowerCase().includes(query);

    $(this).closest(".col-md-4, .col-lg-3").toggle(matches);
  });

  const visibleCards = $(".col-md-4:visible, .col-lg-3:visible").length;
  $("#noResults").remove();

  if (visibleCards === 0) {
    $("#coinsRow").append(`
      <div class="col-12 text-center" id="noResults">
        <div class="alert alert-info">
          <i class="bi bi-info-circle me-2"></i>
          No currencies found matching the search "${query}"
        </div>
      </div>
    `);
  }
}

// ===== Filter buttons =====
function applyFilter(filter) {
  let coinsToShow = allCoins;
  switch (filter) {
    case "selected":
      coinsToShow = allCoins.filter((c) => selectedCoins.includes(c.id));
      break;
    case "favorites":
      coinsToShow = allCoins.filter((c) => favoritesCoins.includes(c.id));
      break;
    case "top10":
      coinsToShow = allCoins.slice(0, 10);
      break;
    case "all":
    default:
      coinsToShow = allCoins;
      break;
  }
  displayCoins(coinsToShow);
}

// ===== Display coins in grid =====
function displayCoins(coins) {
  if (!$("#coinsRow").length) {
    $("#container").append('<div class="row" id="coinsRow"></div>');
  } else {
    $("#coinsRow").empty();
  }
  coins.forEach((coin) => {
    const { id, symbol, name, image, current_price } = coin;
    $("#coinsRow").append(`
      <div class="col-md-4 col-lg-3 mb-4">
        <div class="card shadow-sm p-3 text-center" id="coin-${id}">
          <img src="${image}" class="card-img-top mx-auto d-block"
               style="width:60px;height:60px;" alt="${name}">
          <div class="card-body">
            <h5 class="card-title">${name}</h5>
            <h6 class="text-muted">${symbol.toUpperCase()}</h6>
            <p class="card-text fw-bold fs-5">$${current_price}</p>
            <button class="btn btn-primary mt-2 btnMoreInfo">More Info</button>
            <button class="favBtn" data-id="${id}">
              <i class="fa-star ${favoritesCoins.includes(id) ? "fas" : "far"}"></i>
            </button>
            <label class="switch mt-3">
              <input type="checkbox" class="toggleCoin"
                ${selectedCoins.includes(id) ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
    `);
  });
}

// ===== Cache helper =====
function addToCache(id, data) {
  if (coinCache[id]) {
    cacheOrder = cacheOrder.filter((cid) => cid !== id);
  }
  coinCache[id] = { time: Date.now(), data };
  cacheOrder.push(id);

  if (cacheOrder.length > MAX_CACHE_SIZE) {
    const oldestId = cacheOrder.shift();
    delete coinCache[oldestId];
    console.log(`🗑️ Removed ${oldestId} from cache`);
  }
}

// ===== More Info (details box) =====
function showMoreInfo(id) {
  const $card = $(`#coin-${id}`);
  if ($card.data("open")) {
    $card.find(".more-info-box").remove();
    $card.find(".loading-box").remove();
    $card.data("open", false);
    return;
  }

  $card.data("open", true);

  if (coinCache[id] && Date.now() - coinCache[id].time < 120000) {
    renderMoreInfo(id, coinCache[id].data);
    return;
  }

  // Loader inside card
  $card.append(`
    <div class="more-info-box loading-box text-center p-3">
      <div class="spinner-border text-primary"></div>
      <p class="mt-2">Loading info...</p>
    </div>
  `);

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
    error: () => {
      $(`#coin-${id} .loading-box`).html(`
        <div class="alert alert-danger mb-0">
          <i class="bi bi-exclamation-triangle me-1"></i>
          Error loading information. Try again.
        </div>
      `);
    },
  });
}

function renderMoreInfo(id, data) {
  $(`#coin-${id} .loading-box`).remove();
  $(`#coin-${id} .more-info-box`).remove();

  const {
    image,
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
  const shortDesc = description.en
    ? description.en.substring(0, 180) + "..."
    : "No description.";
  const athDateFormatted = ath_date.usd
    ? new Date(ath_date.usd).toLocaleDateString()
    : "N/A";

  $(`#coin-${id}`).append(`
    <div class="more-info-box border p-3 mt-2 rounded bg-light">
      <div class="d-flex align-items-center gap-3 mb-2">
        <img src="${image.small}" style="width:40px;">
        <h5>${data.name}</h5>
      </div>

      <p><b>Rank:</b> #${market_cap_rank}</p>
      <p><b>USD:</b> $${usd}</p>
      <p><b>EUR:</b> €${eur}</p>
      <p><b>ILS:</b> ₪${ils}</p>

      <hr>

      <p><b>24h Change:</b> <span style="color:${changeColor}">${price_change_percentage_24h.toFixed(
        2
      )}%</span></p>
      <p><b>Market Cap:</b> $${market_cap.usd?.toLocaleString() || market_cap.toLocaleString()}</p>
      <p><b>24h High:</b> $${high_24h.usd || high_24h}</p>
      <p><b>24h Low:</b> $${low_24h.usd || low_24h}</p>

      <hr>

      <p><b>All-Time-High:</b> $${ath.usd}</p>
      <p><b>ATH Date:</b> ${athDateFormatted}</p>

      <hr>

      <p><b>Description:</b><br>${shortDesc}</p>

      <div id="chart-${id}" style="height:130px; width:100%;"></div>
      <hr>
      <button class="btn btn-sm btn-secondary mt-2 btnCloseInfo">
        <i class="bi bi-x-circle me-1"></i>Close
      </button>
    </div>
  `);

  // Close button with nice slide
  $(`#coin-${id} .btnCloseInfo`).on("click", () => {
    $(`#coin-${id} .more-info-box`).slideUp(300, function () {
      $(this).remove();
    });
    $(`#coin-${id}`).data("open", false);
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

// ===== Limit modal (max 5) =====
function showLimitModal() {
  if ($("#limitModal").length) {
    $("#limitModal").modal("show");
    return;
  }
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
            <p class="mb-3">Only <strong>5 currencies</strong> can be tracked.</p>
            <p class="mb-0">To add a new currency, first remove one of the existing currencies.</p>
            <div class="alert alert-info mt-3 mb-0">
              <strong>💡 Tip:</strong> Click the star to save coins to favorites without tracking them!
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
          </div>
        </div>
      </div>
    </div>
  `);

  $("#limitModal").modal("show");
}

// ===== Selected counter (if you add #selectedCount element) =====
function updateSelectedCoinsDisplay() {
  const $el = $("#selectedCount");
  if (!$el.length) return; // אם אין אלמנט כזה – לא עושים כלום

  $el.text(`${selectedCoins.length}/5`);
  if (selectedCoins.length === 5) {
    $el.addClass("text-danger fw-bold");
  } else {
    $el.removeClass("text-danger fw-bold");
  }
}

// ===== Toggle coins - max 5 =====
function toggleCoin(id, checkboxElement) {
  const index = selectedCoins.indexOf(id);
  if (index !== -1) {
    selectedCoins.splice(index, 1);
    saveSelected();
    updateSelectedCoinsDisplay();
    return;
  }

  if (selectedCoins.length >= 5) {
    showLimitModal();
    $(checkboxElement).prop("checked", false);
    return;
  }

  selectedCoins.push(id);
  saveSelected();
  updateSelectedCoinsDisplay();
}

// ===== Favorites =====
function toggleFavorite(id, btn) {
  const index = favoritesCoins.indexOf(id);
  if (index !== -1) favoritesCoins.splice(index, 1);
  else favoritesCoins.push(id);

  saveFavorites();
  $(btn).find("i").toggleClass("fas").toggleClass("far");
}
