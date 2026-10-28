
const buttons = document.querySelectorAll(".day-button");
const menuContent = document.querySelector("#menu-content");
let dragMeals = [];
let eatMeetMeals = [];
let druzbaMeals = [];

buttons.forEach((button) => {
    button.addEventListener("click", () => {

        // Remove active class from all buttons
        buttons.forEach((item) => {
            item.classList.remove("active");
            item.setAttribute("aria-pressed", "false");
        });

        // Activate the clicked button
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");

        // Get the selected day
        const day = button.dataset.day;

        showDragMenu(day);
        showEatMeetMenu(day);
        showDruzbaMenu(day);
    });
});

const today = new Date().getDay();

let selectedDay = today;

if (today === 0 || today === 6) {
    selectedDay = 1;
}

const todayButton = document.querySelector(
    `.day-button[data-day="${selectedDay}"]`
);

const todayDateText = document.querySelector("#today-date-text");
todayDateText.textContent = "Dnes: " + dayjs().format("DD.MM.YYYY");

function updatePageTitle() {
    if (window.location.hash === "#about") {
        document.title = "O projekte | Obedové menu";
    } else {
        document.title = "Jedálny lístok | Obedové menu";
    }
}

window.addEventListener("hashchange", updatePageTitle);

updatePageTitle();

function parseFood(rawText) {
    let name = rawText.replace(/\s+/g, " ").trim();
    let weight = null;
    let allergens = null;

    // Find allergens at the end
    const allergenMatch = name.match(/\/([\d,\s]+)\/$/);

    if (allergenMatch) {
        allergens = allergenMatch[1];
        name = name.slice(0, allergenMatch.index).trim();
    }

    // Find weight at the beginning
    const weightMatch = name.match(
        /^(\d+(?:[.,]\d+)?\s*(?:kg|ml|g|l)(?:\s*\/\s*\d+(?:[.,]\d+)?\s*(?:kg|ml|g|l))?)\.?\s*/i
    );

    if (weightMatch) {
        weight = weightMatch[1];
        name = name.slice(weightMatch[0].length).trim();
    }

    return { name, weight, allergens };
}


//extract the meals
async function loadDragMenu() {
    const response = await fetch(getMenuSource("drag"));

    if (!response.ok) {
        throw new Error("Nepodarilo sa načítať menu.");
    }

    const html = await response.text();

    // 2. Convert HTML text into a document
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const days = [
        { id: "pondelok", number: "1" },
        { id: "utorok", number: "2" },
        { id: "streda", number: "3" },
        { id: "stvrtok", number: "4" },
        { id: "piatok", number: "5" }
    ];

    const meals = [];

    days.forEach((day) => {
        const daySection = doc.querySelector(`#${day.id}`);

        if (!daySection) {
            return;
        }

        const soupHeading = daySection.querySelector("h3");

        if (soupHeading) {
            let node = soupHeading.parentElement.nextSibling;
            let soupText = "";

            while (node) {
                // Stop when we reach the main dishes
                const heading = node.nodeType === 1
                    ? node.querySelector("h3")
                    : null;

                if (heading && heading.textContent.includes("HLAVNÉ JEDLO")) {
                    break;
                }

                soupText += " " + (node.textContent || "");
                node = node.nextSibling;
            }

            if (soupText.trim()) {
                meals.push({
                    day: day.number,
                    type: "Polievka",
                    ...parseFood(soupText),
                    price: null
                });
            }
        }

        const rows = daySection.querySelectorAll("table tr");

        rows.forEach((row) => {
            const cells = row.querySelectorAll("td");

            if (cells.length >= 2) {
                const food = cells[0].textContent.trim();
                const price = cells[1].textContent.trim();

                if (food && price) {
                    meals.push({
                        day: day.number,
                        type: "Hlavné jedlo",
                        ...parseFood(food),
                        price: price
                    });
                }
            }
        });
    });

    console.table(meals);

    return meals;
}


const cachedDrag = getMenuCache(getCacheKey("drag"));

if (cachedDrag !== null) {
    dragMeals = cachedDrag;
    todayButton.click();
} else {
    showLoadingMessage("drag-card", "Reštaurácia DRAG");
    loadDragMenu()
        .then((meals) => {
            dragMeals = meals;
            saveMenuCache(getCacheKey("drag"), meals);
            todayButton.click();
        })
        .catch((error) => {
            console.error("DRAG:", error);
            showRestaurantError("drag-card", "Reštaurácia DRAG");
        });
}


function showDragMenu(day) {
    document.querySelector("#drag-card")?.remove();

    const card = document.createElement("article");
    card.classList.add("restaurant-card");
    card.id = "drag-card";

    const title = document.createElement("h3");
    title.textContent = "Reštaurácia DRAG";
    card.appendChild(title);

    const link = document.createElement("a");
    link.href = "https://www.restauracia-drag.sk/denne-menu";
    link.textContent = "Oficiálna stránka";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);

    const selectedMeals = dragMeals.filter((meal) => {
        return day === "all" || meal.day === day;
    });

    const dayNames = [
        "", "Pondelok", "Utorok", "Streda",
        "Štvrtok", "Piatok"
    ];

    selectedMeals.forEach((meal) => {
        const item = document.createElement("div");
        item.classList.add("meal-card");

        const top = document.createElement("div");
        top.classList.add("meal-top");

        const name = document.createElement("strong");
        name.textContent = meal.name;

        const price = document.createElement("strong");
        price.textContent = meal.price ?? "Cena neuvedená";

        top.appendChild(name);
        top.appendChild(price);

        const details = document.createElement("div");
        details.classList.add("meal-details");

        const type = document.createElement("span");
        type.textContent = meal.type;
        details.appendChild(type);

        if (meal.weight) {
            const weight = document.createElement("span");
            weight.textContent = `⚖ ${meal.weight}`;
            details.appendChild(weight);
        }

        if (meal.allergens) {
            const allergens = document.createElement("span");
            allergens.textContent = `ⓘ Alergény: ${meal.allergens}`;
            details.appendChild(allergens);
        }

        if (day === "all") {
            const dayLabel = document.createElement("span");
            dayLabel.textContent = dayNames[Number(meal.day)];
            details.prepend(dayLabel);
        }

        item.appendChild(top);
        item.appendChild(details);
        card.appendChild(item);
    });

    if (selectedMeals.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Menu na tento deň nie je k dispozícii.";
        card.appendChild(message);
    }

    addUpdatedTime(card, getCacheKey("drag"));
    menuContent.prepend(card);
    document.querySelector("#restaurant-select").dispatchEvent(
        new Event("change")
    );
}


//-------------------------------------------------


async function loadEatMeetMenu() {
    const response = await fetch(getMenuSource("eatmeet"));

    if (!response.ok) {
        throw new Error("Nepodarilo sa načítať Eat & Meet.");
    }

    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const meals = [];

    for (let day = 1; day <= 5; day++) {
        const section = doc.querySelector(`#day-${day}`);

        if (!section) {
            continue;
        }

        const items = section.querySelectorAll(".menu-body");

        items.forEach((item) => {
            const title = item.querySelector("h4");
            const description = item.querySelector(".desc");
            const priceElement = item.querySelector(".price");

            if (!title || !description || !priceElement) {
                return;
            }

            const type = title.textContent.trim();
            const foodText = description.textContent.trim();

            const allergenElement = description.querySelector("span");
            const allergens = allergenElement
                ? allergenElement.textContent.replace(/[()]/g, "").trim()
                : null;

            const name = allergenElement
                ? foodText.replace(allergenElement.textContent, "").trim()
                : foodText;

            const priceText = priceElement.textContent.trim();
            const prices = priceText.split("/").map((p) => p.trim());

            meals.push({
                day: String(day),
                type: type,
                name: name,
                weight: null,
                allergens: allergens || null,
                price: prices[0] || null,
                discountedPrice: prices[1] || null
            });
        });
    }

    console.table(meals);

    return meals;
}


const cachedEatMeet = getMenuCache(getCacheKey("eatmeet"));

if (cachedEatMeet !== null) {
    eatMeetMeals = cachedEatMeet;

    const activeButton = document.querySelector(".day-button.active");

    if (activeButton) {
        showEatMeetMenu(activeButton.dataset.day);
    }
} else {
    showLoadingMessage("eatmeet-card", "Eat & Meet");
    loadEatMeetMenu()
        .then((meals) => {
            eatMeetMeals = meals;
            saveMenuCache(getCacheKey("eatmeet"), meals);

            const activeButton = document.querySelector(".day-button.active");

            if (activeButton) {
                showEatMeetMenu(activeButton.dataset.day);
            }
        })
        .catch((error) => {
            console.error("Eat & Meet:", error);
            showRestaurantError("eatmeet-card", "Eat & Meet");
        });
}


function showEatMeetMenu(day) {
    document.querySelector("#eatmeet-card")?.remove();

    const card = document.createElement("article");
    card.classList.add("restaurant-card");
    card.id = "eatmeet-card";

    const title = document.createElement("h3");
    title.textContent = "Eat & Meet";
    card.appendChild(title);

    const link = document.createElement("a");
    link.href = "https://eatandmeet.sk/tyzdenne-menu";
    link.textContent = "Oficiálna stránka";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);

    const selectedMeals = eatMeetMeals.filter((meal) => {
        return day === "all" || meal.day === day;
    });

    const dayNames = [
        "", "Pondelok", "Utorok", "Streda",
        "Štvrtok", "Piatok"
    ];

    selectedMeals.forEach((meal) => {
        const item = document.createElement("div");
        item.classList.add("meal-card");

        const top = document.createElement("div");
        top.classList.add("meal-top");

        const name = document.createElement("strong");
        name.textContent = meal.name;

        const price = document.createElement("strong");
        price.textContent = meal.price ?? "Cena neuvedená";

        top.appendChild(name);
        top.appendChild(price);

        const details = document.createElement("div");
        details.classList.add("meal-details");

        const type = document.createElement("span");
        type.textContent = meal.type;
        details.appendChild(type);

        if (meal.allergens) {
            const allergens = document.createElement("span");
            allergens.textContent = `ⓘ Alergény: ${meal.allergens}`;
            details.appendChild(allergens);
        }

        if (meal.discountedPrice) {
            const discount = document.createElement("span");
            discount.textContent = `Cena s ISIC: ${meal.discountedPrice}`;
            details.appendChild(discount);
        }

        if (day === "all") {
            const dayLabel = document.createElement("span");
            dayLabel.textContent = dayNames[Number(meal.day)];
            details.prepend(dayLabel);
        }

        item.appendChild(top);
        item.appendChild(details);
        card.appendChild(item);
    });

    if (selectedMeals.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Menu na tento deň nie je k dispozícii.";
        card.appendChild(message);
    }

    addUpdatedTime(card, getCacheKey("eatmeet"));
    menuContent.appendChild(card);
    document.querySelector("#restaurant-select").dispatchEvent(
        new Event("change")
    );
}


//--------------------


async function loadDruzbaMenu() {
    const response = await fetch(getMenuSource("druzba"));

    if (!response.ok) {
        throw new Error("Nepodarilo sa načítať Družba menu.");
    }

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const meals = [];

    const headings = doc.querySelectorAll(".heading-title h2");

    headings.forEach((heading) => {
        const headingText = heading.textContent.trim();

        const dayNames = [
            "Pondelok", "Utorok", "Streda",
            "Štvrtok", "Piatok"
        ];

        const dayIndex = dayNames.findIndex((name) => {
            return headingText.startsWith(name);
        });

        if (dayIndex === -1) {
            return;
        }

        const day = String(dayIndex + 1);
        const table = heading.parentElement.nextElementSibling;

        if (!table || table.tagName !== "TABLE") {
            return;
        }

        const rows = table.querySelectorAll("tr");

        rows.forEach((row) => {
            const cells = row.querySelectorAll("td");

            if (cells.length < 2) {
                return;
            }

            const foodCell = cells[0];
            const priceText = cells[1].textContent.trim();

            const isSoup = foodCell.textContent.includes("Polievka");

            const foodElement = isSoup
                ? foodCell.querySelectorAll("em")[1]
                : foodCell.querySelector("p em");

            if (!foodElement) {
                return;
            }

            let foodText = foodElement.textContent.trim();

            const allergenMatch = foodText.match(/\(([\d,\s]+)\)\s*$/);

            const allergens = allergenMatch
                ? allergenMatch[1].replace(/\s+/g, "")
                : null;

            if (allergenMatch) {
                foodText = foodText.slice(0, allergenMatch.index).trim();
            }

            const parsed = parseFood(foodText);

            const prices = priceText.match(
                /(\d+[,.]\d+)\s*€\s*\/\s*(\d+[,.]\d+)\s*€/
            );

            meals.push({
                day: day,
                date: headingText,
                type: isSoup ? "Polievka" : "Hlavné jedlo",
                name: parsed.name,
                weight: isSoup ? "0,33l" : parsed.weight,
                allergens: allergens,
                price: prices ? prices[2] + " €" : priceText,
                discountedPrice: prices ? prices[1] + " €" : null
            });
        });
    });

    console.table(meals);
    return meals;
}


const cachedDruzba = getMenuCache(getCacheKey("druzba"));

if (cachedDruzba !== null) {
    druzbaMeals = cachedDruzba;

    const activeButton = document.querySelector(".day-button.active");

    if (activeButton) {
        showDruzbaMenu(activeButton.dataset.day);
    }
} else {
    showLoadingMessage("druzba-card", "Družba Cantina");
    loadDruzbaMenu()
        .then((meals) => {
            druzbaMeals = meals;
            saveMenuCache(getCacheKey("druzba"), meals);

            const activeButton = document.querySelector(".day-button.active");

            if (activeButton) {
                showDruzbaMenu(activeButton.dataset.day);
            }
        })
        .catch((error) => {
            console.error("Družba:", error);
            showRestaurantError("druzba-card", "Družba Cantina");
        });
}


function showDruzbaMenu(day) {
    document.querySelector("#druzba-card")?.remove();

    const card = document.createElement("article");
    card.classList.add("restaurant-card");
    card.id = "druzba-card";

    const title = document.createElement("h3");
    title.textContent = "Družba Cantina";
    card.appendChild(title);

    const link = document.createElement("a");
    link.href = "https://www.druzbacatering.sk/jedalny-listok/";
    link.textContent = "Oficiálna stránka";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);

    addMenuDate(card, druzbaMeals, day);

    const selectedMeals = druzbaMeals.filter((meal) => {
        return day === "all" || meal.day === day;
    });

    const dayNames = [
        "", "Pondelok", "Utorok", "Streda",
        "Štvrtok", "Piatok"
    ];

    selectedMeals.forEach((meal) => {
        const item = document.createElement("div");
        item.classList.add("meal-card");

        const top = document.createElement("div");
        top.classList.add("meal-top");

        const name = document.createElement("strong");
        name.textContent = meal.name;

        const price = document.createElement("strong");
        price.textContent = meal.price ?? "Cena neuvedená";

        top.appendChild(name);
        top.appendChild(price);

        const details = document.createElement("div");
        details.classList.add("meal-details");

        const type = document.createElement("span");
        type.textContent = meal.type;
        details.appendChild(type);

        if (meal.weight) {
            const weight = document.createElement("span");
            weight.textContent = `⚖ ${meal.weight}`;
            details.appendChild(weight);
        }

        if (meal.allergens) {
            const allergens = document.createElement("span");
            allergens.textContent = `ⓘ Alergény: ${meal.allergens}`;
            details.appendChild(allergens);
        }

        if (meal.discountedPrice) {
            const discount = document.createElement("span");
            discount.textContent = `Cena s ISIC: ${meal.discountedPrice}`;
            details.appendChild(discount);
        }

        if (day === "all") {
            const dayLabel = document.createElement("span");
            dayLabel.textContent = dayNames[Number(meal.day)];
            details.prepend(dayLabel);
        }

        item.appendChild(top);
        item.appendChild(details);
        card.appendChild(item);
    });

    if (selectedMeals.length === 0) {
        const message = document.createElement("p");
        message.textContent = "Menu na tento deň nie je k dispozícii.";
        card.appendChild(message);
    }

    addUpdatedTime(card, getCacheKey("druzba"));
    menuContent.appendChild(card);
    document.querySelector("#restaurant-select").dispatchEvent(
        new Event("change")
    );
}


function saveMenuCache(key, meals) {
    const data = {
        date: dayjs().format("YYYY-MM-DD"),
        updatedAt: new Date().toISOString(),
        meals: meals
    };

    localStorage.setItem(key, JSON.stringify(data));
}


function getMenuCache(key) {
    const saved = localStorage.getItem(key);

    if (!saved) {
        return null;
    }

    try {
        const data = JSON.parse(saved);

        if (
            data.date === dayjs().format("YYYY-MM-DD")
            && Array.isArray(data.meals)
        ) {
            return data.meals;
        }
    } catch (error) {
        console.error("Chyba pri čítaní cache:", error);
    }

    return null;
}


const refreshButton = document.querySelector("#refresh-menu");

refreshButton.addEventListener("click", async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = "Načítavam menu...";

    const results = await Promise.allSettled([
        loadDragMenu(),
        loadEatMeetMenu(),
        loadDruzbaMenu()
    ]);

    const keys = [
        getCacheKey("drag"),
        getCacheKey("eatmeet"),
        getCacheKey("druzba")
    ];

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            if (index === 0) {
                dragMeals = result.value;
            } else if (index === 1) {
                eatMeetMeals = result.value;
            } else {
                druzbaMeals = result.value;
            }

            saveMenuCache(keys[index], result.value);
        } else {
            console.error("Chyba pri obnovení menu:", result.reason);

            const names = ["Reštaurácia DRAG", "Eat & Meet", "Družba Cantina"];
            const ids = ["drag-card", "eatmeet-card", "druzba-card"];

            showRestaurantError(ids[index], names[index]);
        }
    });

    const activeDay =
        document.querySelector(".day-button.active")?.dataset.day
        ?? String(selectedDay);

    if (results[0].status === "fulfilled") {
        showDragMenu(activeDay);
    }

    if (results[1].status === "fulfilled") {
        showEatMeetMenu(activeDay);
    }

    if (results[2].status === "fulfilled") {
        showDruzbaMenu(activeDay);
    }

    refreshButton.disabled = false;
    refreshButton.innerHTML =
        '<i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Obnoviť menu';
});


const restaurantSelect = document.querySelector("#restaurant-select");

restaurantSelect.addEventListener("change", () => {
    const selected = restaurantSelect.value;

    const restaurantCards = {
        drag: document.querySelector("#drag-card"),
        eatmeet: document.querySelector("#eatmeet-card"),
        druzba: document.querySelector("#druzba-card")
    };

    Object.entries(restaurantCards).forEach(([key, card]) => {
        if (card) {
            card.hidden = selected !== "all" && selected !== key;
        }
    });
});


//Error m

function showLoadingMessage(restaurantId, restaurantName) {
    document.querySelector(`#${restaurantId}`)?.remove();

    const card = document.createElement("article");
    card.classList.add("restaurant-card");
    card.id = restaurantId;

    const message = document.createElement("p");
    message.textContent = `Načítavam menu: ${restaurantName}...`;
    message.setAttribute("role", "status");

    card.appendChild(message);
    menuContent.appendChild(card);

    document.querySelector("#restaurant-select").dispatchEvent(
        new Event("change")
    );
}


function showRestaurantError(restaurantId, restaurantName) {
    document.querySelector(`#${restaurantId}`)?.remove();

    const card = document.createElement("article");
    card.classList.add("restaurant-card");
    card.id = restaurantId;

    const title = document.createElement("h3");
    title.textContent = restaurantName;

    const message = document.createElement("p");
    message.textContent = "Menu sa nepodarilo načítať. Skúste ho obnoviť.";
    message.setAttribute("role", "alert");

    card.appendChild(title);
    card.appendChild(message);
    menuContent.appendChild(card);

    document.querySelector("#restaurant-select").dispatchEvent(
        new Event("change")
    );
}


function addUpdatedTime(card, cacheKey) {
    const saved = localStorage.getItem(cacheKey);

    if (!saved) {
        return;
    }

    try {
        const data = JSON.parse(saved);

        if (!data.updatedAt) {
            return;
        }

        const time = document.createElement("p");
        time.classList.add("updated-time");

        time.textContent =
            "Posledná aktualizácia: " +
            dayjs(data.updatedAt).format("DD.MM.YYYY, HH:mm");

        card.appendChild(time);
    } catch (error) {
        console.error("Chyba pri načítaní času:", error);
    }
}


function addMenuDate(card, meals, day) {
    const dates = meals
        .filter((meal) => day === "all" || meal.day === day)
        .map((meal) => meal.date)
        .filter(Boolean);

    const uniqueDates = [...new Set(dates)];

    if (uniqueDates.length === 0) {
        return;
    }

    const dateText = document.createElement("p");
    dateText.classList.add("menu-date");

    dateText.textContent = day === "all"
        ? `Dátumy menu: ${uniqueDates[0]} – ${uniqueDates[uniqueDates.length - 1]}`
        : `Dátum menu: ${uniqueDates[0]}`;

    card.appendChild(dateText);
}


function getMenuSource(restaurant) {
    const sources = {
        drag: "./source/drag.html",
        eatmeet: "./source/eatandmeet.html",
        druzba: "./source/druzba.html"
    };

    return sources[restaurant];
}

function getCacheKey(restaurant) {
    return `${restaurant}-menu`;
}



document.querySelector("#clear-cache").addEventListener("click", () => {
    ["drag", "eatmeet", "druzba"].forEach((restaurant) => {
        localStorage.removeItem(getCacheKey(restaurant));
    });

    document.querySelectorAll(".updated-time").forEach((item) => {
        item.remove();
    });

    alert("Uložené údaje boli vymazané.");
});


if (!document.querySelector(".day-button.active")) {
    todayButton.classList.add("active");
    todayButton.setAttribute("aria-pressed", "true");

    if (cachedEatMeet !== null) {
        showEatMeetMenu(todayButton.dataset.day);
    }

    if (cachedDruzba !== null) {
        showDruzbaMenu(todayButton.dataset.day);
    }
}
